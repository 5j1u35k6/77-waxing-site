import { operationErrorText } from "../assets/interface-copy.js?v=20261026-audit1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getDocFromServer, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20261026-audit1";
import { beginCheckout, finishCheckout, cartFingerprint, validateOrderData, savePreference } from "./checkout-guard.js?v=20261026-audit1";
import { allProducts, catalogCategories, catalogCategory, filterProducts } from "./series.js?v=20261124-series1";
import { collectionHref, productHref, storeHomeHref, storeRoute } from "./select-routes.js?v=20261124-series1";
import { renderSelectHomeProducts } from "./select-home-content.js?v=20261124-series1";
import { setProductPageMetadata } from "./seo.js?v=20261124-series1";
import { selectProductCard } from "./select-product-card.js?v=20261124-series1";

const { auth, db } = getPublicFirebase();
const CART_KEY = "77select_cart_v4";
const MARKET_CACHE_KEY = "77select_market_v1";
const DEFAULT_EMAIL_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";

const MARKETS = {
  TW: { code: "TW", currency: "TWD", symbol: "NT$", locale: "zh-TW", label: "台灣" },
  HK: { code: "HK", currency: "HKD", symbol: "HK$", locale: "zh-HK", label: "香港" },
};

let market = MARKETS.TW;
let products = [];
let cart = loadCart();
let selectedProduct = null;
let selectedVariantId = null;
let selectedQuantity = 1;
const selectedAddOns = new Map();
let currentUser = null;
let ownOrders = [];
let orderUnsubscribe = null;
let orderWatchVersion = 0;
let settings = {};
let renderingOrders = false;
let renderingCart = false;
let renderingProducts = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (value) => Math.max(0, Math.round(Number(value) || 0));

function loadCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value.filter(row => row && typeof row.productId === "string" && typeof row.variantId === "string" && Number.isFinite(Number(row.qty)) && Number(row.qty) > 0) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  savePreference(CART_KEY, JSON.stringify(cart));
  const count = $("#cart-count");
  if (count) count.textContent = String(cart.reduce((sum, row) => sum + int(row.qty), 0));
  renderCart();
  updateAddOnAvailability();
  updateDetailPurchase();
}

function money(value, currency = market.currency) {
  const amount = Number(value || 0);
  if (currency === "HKD") return `HK$${amount.toLocaleString("zh-HK")}`;
  return `NT$${amount.toLocaleString("zh-TW")}`;
}

function orderCurrency(order) {
  return order?.items?.find?.((item) => item?.currency)?.currency || "TWD";
}

function cartKey(productId, variantId) {
  return `${productId}::${variantId}`;
}

function normalizeVariants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => ({
      id: String(variant.id || `variant-${index + 1}`),
      name: String(variant.name || variant.label || `規格 ${index + 1}`),
      capacity: String(variant.capacity || variant.size || ""),
      priceTWD: int(variant.priceTWD ?? variant.priceTW ?? variant.price ?? product.price ?? 0),
      priceHKD: int(variant.priceHKD ?? variant.priceHK ?? product.priceHKD ?? 0),
      stock: int(variant.stock ?? product.stock ?? 0),
      bulkMinQty: int(variant.bulkMinQty ?? variant.quantityDiscountMin ?? 0),
      bulkPriceTWD: int(variant.bulkPriceTWD ?? variant.quantityDiscountTWD ?? 0),
      bulkPriceHKD: int(variant.bulkPriceHKD ?? variant.quantityDiscountHKD ?? 0),
    }));
  }
  return [{
    id: "default",
    name: "一般規格",
    capacity: "",
    priceTWD: int(product.price || 0),
    priceHKD: int(product.priceHKD || product.price || 0),
    stock: int(product.stock || 0),
    bulkMinQty: 0,
    bulkPriceTWD: 0,
    bulkPriceHKD: 0,
  }];
}

function basePriceFor(variant) {
  return market.code === "HK" ? int(variant.priceHKD) : int(variant.priceTWD);
}

function bulkPriceFor(variant) {
  return market.code === "HK" ? int(variant.bulkPriceHKD) : int(variant.bulkPriceTWD);
}

function bulkEnabled(variant) {
  const bulk = bulkPriceFor(variant);
  return int(variant.bulkMinQty) >= 2 && bulk > 0 && bulk <= basePriceFor(variant);
}

function unitPriceFor(variant, qty = 1) {
  if (bulkEnabled(variant) && int(qty) >= int(variant.bulkMinQty)) return bulkPriceFor(variant);
  return basePriceFor(variant);
}

function variantLabel(variant) {
  return [variant.name, variant.capacity].filter(Boolean).join("｜");
}

function discountText(variant) {
  if (!bulkEnabled(variant)) return "";
  return `滿 ${variant.bulkMinQty} 件，單件 ${money(bulkPriceFor(variant))}`;
}

function normalizeMedia(product = {}) {
  const source = Array.isArray(product.media) ? product.media : [];
  const rows = source.map((row, index) => ({
    id: String(row?.id || `image-${index + 1}`),
    url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
    variantId: String(row?.variantId || ""),
    sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
  })).filter((row) => row.url).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!rows.length && product.imageUrl) rows.push({ id: "legacy-main", url: String(product.imageUrl), variantId: "", sortOrder: 0 });
  return rows;
}

function mediaForVariant(product, variantId = "") {
  const all = normalizeMedia(product);
  if (!all.length) return [];
  const shared = all.filter((row) => !row.variantId);
  if (!variantId) return shared.length ? shared : all;
  const specific = all.filter((row) => row.variantId === variantId);
  const result = [...shared, ...specific];
  return result.length ? result : all;
}

function primaryImage(product, variantId = "") {
  return mediaForVariant(product, variantId)[0]?.url || "";
}

async function detectMarket() {
  let cached = null;
  try { cached = sessionStorage.getItem(MARKET_CACHE_KEY); } catch {}
  if (cached === "HK" || cached === "TW") return MARKETS[cached];

  let detected = null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const languages = [navigator.language, ...(navigator.languages || [])].filter(Boolean).join("|");
  if (timezone === "Asia/Hong_Kong" || /(?:^|-)HK(?:$|\|)/i.test(languages)) detected = "HK";
  if (timezone === "Asia/Taipei" || /(?:^|-)TW(?:$|\|)/i.test(languages)) detected ||= "TW";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch("https://api.country.is/", { cache: "no-store", signal: controller.signal });
    if (response.ok) {
      const data = await response.json();
      const country = String(data?.country || "").toUpperCase();
      if (country === "HK" || country === "TW") detected = country;
    }
  } catch (error) {
    console.info("77select market IP lookup unavailable; using device locale fallback.", error?.name || error);
  } finally {
    clearTimeout(timer);
  }

  const result = detected === "HK" ? MARKETS.HK : MARKETS.TW;
  try { sessionStorage.setItem(MARKET_CACHE_KEY, result.code); } catch {}
  return result;
}

function ensureMarketBadge() {
  let badge = $("#market-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "market-badge";
    badge.className = "market-badge";
  }
  const headerNav = $(".select-header .select-nav");
  if (headerNav && badge.parentElement !== headerNav) headerNav.append(badge);
  badge.textContent = market.label;
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-label", `目前地區：${market.label}`);
  document.documentElement.dataset.market = market.code;
}

function galleryMarkup(product, variantId) {
  const media = mediaForVariant(product, variantId);
  const first = media.find((row) => row.variantId === variantId) || media[0];
  return `<section class="product-gallery select-product-gallery" aria-label="商品圖片">
    <div class="product-gallery-main">${first ? `<img data-gallery-main src="${esc(first.url)}" alt="${esc(product.name)}">` : '<span>暫無商品圖片</span>'}</div>
    ${media.length > 1 ? `<div class="product-gallery-thumbs">${media.map((row, index) => `<button type="button" class="gallery-thumb${row === first ? " on" : ""}" data-gallery-thumb data-gallery-url="${esc(row.url)}" aria-label="檢視商品圖片 ${index + 1}" aria-pressed="${row === first}"><img src="${esc(row.url)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
  </section>`;
}

function catalogPriceText(product) {
  const variants = normalizeVariants(product);
  const available = variants.filter((variant) => variant.stock > 0);
  const prices = (available.length ? available : variants).map(basePriceFor);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? money(minimum) : `${money(minimum)}–${money(maximum)}`;
}

function productCardMarkup(product) {
  const soldOut = !normalizeVariants(product).some((variant) => variant.stock > 0);
  return selectProductCard({ id: product.id, name: product.name, imageUrl: primaryImage(product) },
    catalogPriceText(product), { regional: true, soldOut });
}

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;
  renderingProducts = true;
  const activeCategory = storeRoute.category || allProducts;
  const visible = filterProducts(products, activeCategory);
  grid.innerHTML = visible.length ? visible.map(productCardMarkup).join("") :
    `<div class="empty-state" data-regional-empty>${activeCategory === allProducts ? "目前沒有可訂購的商品。" : "此系列目前尚無商品。"}</div>`;
  renderingProducts = false;
}

function renderFilters() {
  const host = $("#category-filters");
  if (!host) return;
  const chosen = storeRoute.category || allProducts;
  host.innerHTML = catalogCategories(products).map((name) => `<a class="filter-btn${name === chosen ? " on" : ""}" href="${esc(collectionHref(name))}" data-category="${esc(name)}"${name === chosen ? ' aria-current="page"' : ""}>${esc(name)}</a>`).join("");
}

function variantChoiceMarkup(variant) {
  const disabled = variant.stock <= 0;
  const selected = variant.id === selectedVariantId;
  const discount = discountText(variant);
  return `<button type="button" role="radio" aria-checked="${selected}" class="variant-choice variant-layout-v2${selected ? " on" : ""}" data-regional-variant="${esc(variant.id)}"${disabled ? " disabled" : ""}>
    <span class="variant-layout-row variant-layout-top">
      <span class="variant-layout-capacity">${esc(variant.capacity || variant.name)}</span>
      <strong class="variant-layout-price">${money(basePriceFor(variant))}</strong>
    </span>
    <span class="variant-layout-row variant-layout-bottom">
      <span class="variant-layout-pill">${esc(variant.capacity ? variant.name : "商品規格")}</span>
      <span class="variant-layout-stock">${disabled ? "售完" : `剩餘數量 ${variant.stock}`}</span>
    </span>
    ${discount ? `<span class="variant-layout-discount">多件優惠｜${esc(discount)}</span>` : ""}
  </button>`;
}

function addOnsMarkup(product) {
  const ids = Array.isArray(product.addOnProductIds) ? product.addOnProductIds : [];
  const addOns = [...new Set(ids.filter((id) => typeof id === "string" && id !== product.id))].slice(0, 8)
    .map((id) => products.find((item) => item.id === id))
    .filter((item) => item?.active === true && normalizeVariants(item).some((variant) => variant.stock > 0));
  if (!addOns.length) return "";
  return `<section class="select-product-add-ons" aria-labelledby="product-add-ons-title">
    <h2 id="product-add-ons-title">加購商品</h2>
    <ul>${addOns.map((item) => {
      const image = primaryImage(item);
      const variants = normalizeVariants(item).filter((variant) => variant.stock > 0);
      return `<li class="select-product-add-on">
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async">` : ""}
        <div>
          <a href="${esc(productHref(item.id))}">${esc(item.name)}</a>
          <p class="select-product-add-on-price">${esc(catalogPriceText(item))}</p>
          <select data-add-on-product="${esc(item.id)}" aria-label="加購 ${esc(item.name)}">
            <option value="">不加購</option>
            ${variants.map((variant) => `<option value="${esc(variant.id)}">${esc(variantLabel(variant))}｜${money(basePriceFor(variant))}</option>`).join("")}
          </select>
        </div>
      </li>`;
    }).join("")}</ul>
  </section>`;
}

function renderProductDetail() {
  const body = $("#product-detail-body");
  if (!selectedProduct || !body) return;
  const variants = normalizeVariants(selectedProduct);
  const selected = variants.find((row) => row.id === selectedVariantId) || variants[0];
  const category = catalogCategory(selectedProduct.category);
  const name = esc(selectedProduct.name);
  const specs = String(selectedProduct.spec || "").trim();
  const description = String(selectedProduct.description || "").trim();
  const slogan = String(selectedProduct.slogan || "").trim() || description;
  const precautions = String(selectedProduct.precautions || "").trim();
  const careNotes = precautions || specs;
  const categoryHref = esc(collectionHref(category));
  const related = filterProducts(products, category).filter((product) => product.id !== selectedProduct.id).slice(0, 3);
  const discount = discountText(selected);

  body.innerHTML = `<nav class="select-product-breadcrumb" aria-label="目前位置">
    <a href="${esc(storeHomeHref())}">首頁</a>
    <a href="${categoryHref}">${esc(category)}</a>
    <span aria-current="page">${name}</span>
  </nav>
  <div class="select-product-layout">
    ${galleryMarkup(selectedProduct, selected.id)}
    <section class="select-product-info" aria-labelledby="product-page-title">
      <h1 id="product-page-title">${name}</h1>
      ${slogan ? `<p class="select-product-slogan">${esc(slogan)}</p>` : ""}
      ${careNotes ? `<section class="select-product-precautions" aria-labelledby="product-precautions-title">
        <h2 id="product-precautions-title">${precautions ? "注意事項" : "使用說明與注意事項"}</h2><p>${esc(careNotes)}</p>
      </section>` : ""}
      <p class="select-product-price" id="product-detail-price" aria-live="polite">${money(basePriceFor(selected))}</p>
      <div class="variant-picker" role="radiogroup" aria-label="選擇商品規格">${variants.map(variantChoiceMarkup).join("")}</div>
      ${discount ? `<p class="bulk-notice">數量優惠｜${esc(discount)}</p>` : ""}
      <div class="select-product-purchase">
        <div id="product-detail-qty-picker" class="detail-qty-picker">
          <span class="detail-qty-label">數量</span>
          <div class="qty detail-qty-control">
            <button type="button" data-detail-qty="-1" aria-label="減少數量">−</button>
            <b id="product-detail-qty-value" aria-live="polite">1</b>
            <button type="button" data-detail-qty="1" aria-label="增加數量">＋</button>
          </div>
          <small id="product-detail-qty-stock"></small>
        </div>
        ${addOnsMarkup(selectedProduct)}
        <button id="product-detail-add" class="primary-btn" type="button">加入購物車</button>
      </div>
    </section>
  </div>
  <div class="select-product-notes">
    ${description && description !== slogan ? `<section aria-labelledby="product-description-title"><h2 id="product-description-title">商品介紹</h2><p>${esc(description)}</p></section>` : ""}
    ${specs && specs !== careNotes ? `<section aria-labelledby="product-spec-title"><h2 id="product-spec-title">規格與使用說明</h2><p>${esc(specs)}</p></section>` : ""}
    <section aria-labelledby="product-shipping-title">
      <h2 id="product-shipping-title">配送與付款</h2>
      <p>可用的取貨和付款方式會顯示在結帳頁。</p>
      <a href="./policies.html">訂購、退換貨與隱私說明</a>
    </section>
  </div>
  ${related.length ? `<section class="select-related-products" aria-labelledby="product-related-title">
    <div class="select-related-heading"><h2 id="product-related-title">同系列商品</h2><a href="${categoryHref}">瀏覽系列</a></div>
    <div class="product-grid">${related.map(productCardMarkup).join("")}</div>
  </section>` : ""}`;
  updateAddOnAvailability();
  updateDetailPurchase();
}

function renderRequestedProduct() {
  if (storeRoute.view !== "product") return;
  selectedProduct = products.find((product) => product.id === storeRoute.productId) || null;
  if (!selectedProduct) {
    $("#product-detail-body").innerHTML = `<div class="select-product-unavailable"><h1 id="product-page-title">找不到這項商品</h1><p>商品可能已下架或網址有誤。</p><a href="${esc(collectionHref(allProducts))}">瀏覽全部商品</a></div>`;
    return;
  }
  const variants = normalizeVariants(selectedProduct);
  selectedVariantId = (variants.find((variant) => variant.stock > 0) || variants[0]).id;
  selectedQuantity = 1;
  setProductPageMetadata(selectedProduct);
  renderProductDetail();
}

function selectedPurchaseVariant() {
  return selectedProduct && normalizeVariants(selectedProduct).find((variant) => variant.id === selectedVariantId);
}

function cartQuantity(productId, variantId) {
  return int(cart.find((item) => item.key === cartKey(productId, variantId))?.qty);
}

function updateAddOnAvailability() {
  $$("select[data-add-on-product]").forEach((control) => {
    const productId = control.dataset.addOnProduct;
    const product = products.find((item) => item.id === productId);
    const variants = normalizeVariants(product);
    let available = false;
    for (const option of [...control.options].slice(1)) {
      const variant = variants.find((item) => item.id === option.value);
      const quantity = cartQuantity(productId, option.value);
      option.disabled = !variant || quantity >= variant.stock;
      if (variant) option.textContent = `${variantLabel(variant)}｜${money(unitPriceFor(variant, quantity + 1))}${option.disabled ? "（已達庫存上限）" : ""}`;
      available ||= !option.disabled;
    }
    const chosen = selectedAddOns.get(productId);
    if (chosen && ![...control.options].some((option) => option.value === chosen && !option.disabled)) selectedAddOns.delete(productId);
    control.value = selectedAddOns.get(productId) || "";
    control.disabled = !available;
  });
}

function updateDetailPurchase() {
  const button = $("#product-detail-add");
  const variant = selectedPurchaseVariant();
  if (!button || !variant) return;
  const inCart = cartQuantity(selectedProduct.id, variant.id);
  const remaining = Math.max(0, variant.stock - inCart);
  selectedQuantity = remaining > 0 ? Math.min(remaining, Math.max(1, int(selectedQuantity))) : 1;
  $("#product-detail-qty-picker").hidden = remaining <= 0;
  $("#product-detail-qty-value").textContent = String(selectedQuantity);
  $("#product-detail-qty-stock").textContent = `最多 ${remaining} 件`;
  $('[data-detail-qty="-1"]').disabled = selectedQuantity <= 1;
  $('[data-detail-qty="1"]').disabled = selectedQuantity >= remaining;
  button.disabled = remaining <= 0;

  const price = unitPriceFor(variant, inCart + selectedQuantity);
  button.textContent = variant.stock <= 0 ? "目前售完" :
    remaining <= 0 ? "購物車已達庫存上限" :
    selectedAddOns.size ? "一併加入購物車" : `加入購物車｜${money(price)}${selectedQuantity > 1 ? ` × ${selectedQuantity}` : ""}`;
}

function addDetailSelectionToCart() {
  const selection = [
    { productId: selectedProduct.id, variantId: selectedVariantId, quantity: selectedQuantity },
    ...[...selectedAddOns].map(([productId, variantId]) => ({ productId, variantId, quantity: 1 })),
  ];
  const next = new Map(cart.map((row) => [row.key, row]));
  for (const { productId, variantId, quantity } of selection) {
    const product = products.find((row) => row.id === productId);
    const variant = product && normalizeVariants(product).find((row) => row.id === variantId);
    if (!variant) return toast("此規格目前沒有庫存。", "error");
    const key = cartKey(product.id, variant.id);
    const qty = int(next.get(key)?.qty) + quantity;
    if (qty > variant.stock) return toast("購物車數量已達此規格目前庫存。", "error");
    const listPrice = basePriceFor(variant);
    const price = unitPriceFor(variant, qty);
    next.set(key, {
      key,
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      capacity: variant.capacity,
      region: market.code,
      currency: market.currency,
      price,
      listPrice,
      bulkMinQty: variant.bulkMinQty,
      discountApplied: price < listPrice,
      imageUrl: primaryImage(product, variant.id),
      qty,
    });
  }
  cart = [...next.values()];
  selectedQuantity = 1;
  selectedAddOns.clear();
  saveCart();
  toast(selection.length > 1 ? `已將 ${selection.length} 項商品加入購物車` :
    `已加入 ${selectedProduct.name}｜${variantLabel(selectedPurchaseVariant())}`);
}

function reconcileCart() {
  let changed = false;
  cart = cart.filter((row) => {
    if (row.region && row.region !== market.code) { changed = true; return false; }
    const product = products.find((item) => item.id === row.productId);
    if (!product) { changed = true; return false; }
    const variant = normalizeVariants(product).find((item) => item.id === row.variantId);
    if (!variant) { changed = true; return false; }
    const qty = Math.min(int(row.qty), variant.stock);
    const listPrice = basePriceFor(variant);
    const price = unitPriceFor(variant, qty);
    const nextImage = primaryImage(product, variant.id);
    if (qty !== int(row.qty) || row.price !== price || row.listPrice !== listPrice || row.name !== product.name || row.variantName !== variant.name || row.capacity !== variant.capacity || row.imageUrl !== nextImage) changed = true;
    Object.assign(row, {
      key: cartKey(product.id, variant.id),
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      capacity: variant.capacity,
      region: market.code,
      currency: market.currency,
      price,
      listPrice,
      bulkMinQty: variant.bulkMinQty,
      discountApplied: price < listPrice,
      imageUrl: nextImage,
      qty,
    });
    return qty > 0;
  });
  if (changed) saveCart(); else renderCart();
}

function changeQty(key, delta) {
  const row = cart.find((item) => item.key === key);
  if (!row) return;
  const product = products.find((item) => item.id === row.productId);
  const variant = product ? normalizeVariants(product).find((item) => item.id === row.variantId) : null;
  if (!variant) return;
  row.qty = Math.min(variant.stock, Math.max(0, int(row.qty) + Number(delta || 0)));
  if (!row.qty) cart = cart.filter((item) => item.key !== key);
  else {
    row.listPrice = basePriceFor(variant);
    row.price = unitPriceFor(variant, row.qty);
    row.discountApplied = row.price < row.listPrice;
  }
  saveCart();
}

function renderCart() {
  const container = $("#cart-items");
  if (!container) return;
  renderingCart = true;
  if (!cart.length) {
    container.innerHTML = `<div class="empty-state" data-regional-cart>購物車目前是空的。</div>`;
  } else {
    container.innerHTML = cart.map((row) => `<div class="cart-row regional-cart-row" data-regional-cart>
      <div class="product-media">${row.imageUrl ? `<img src="${esc(row.imageUrl)}" alt="">` : "77"}</div>
      <div><h4>${esc(row.name)}</h4><div class="cart-variant">${esc([row.variantName, row.capacity].filter(Boolean).join("｜"))}</div><p>${row.discountApplied ? `<span class="cart-list-price">${money(row.listPrice, row.currency)}</span> ` : ""}<b>${money(row.price, row.currency)}</b> × ${int(row.qty)}</p>${row.discountApplied ? `<div class="cart-discount-note">已套用 ${int(row.bulkMinQty)} 件以上優惠</div>` : ""}<div class="qty"><button type="button" data-regional-qty="${esc(row.key)}" data-delta="-1">−</button><b>${int(row.qty)}</b><button type="button" data-regional-qty="${esc(row.key)}" data-delta="1">＋</button></div></div>
      <button class="icon-btn" type="button" data-regional-remove="${esc(row.key)}" aria-label="移除">×</button>
    </div>`).join("");
  }
  const subtotal = cart.reduce((sum, row) => sum + Number(row.price || 0) * int(row.qty), 0);
  const subtotalEl = $("#cart-subtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  const checkout = $("#checkout-open");
  if (checkout) {
    checkout.disabled = !cart.length || market.code === "HK";
    checkout.textContent = market.code === "HK" ? "香港配送設定中" : "填寫訂購資料";
  }
  let note = $("#hk-checkout-note");
  if (market.code === "HK") {
    if (!note) {
      note = document.createElement("p");
      note.id = "hk-checkout-note";
      note.className = "hk-checkout-note";
      checkout?.parentElement?.insertBefore(note, checkout);
    }
    note.textContent = "你目前看到的是香港專屬 HK$ 售價。香港配送與運費設定完成後會開放線上結帳。";
  } else {
    note?.remove();
  }
  renderingCart = false;
}

function deliveryOptions() {
  const rows = [];
  if (settings.enablePickup !== false) rows.push({ id: "pickup", label: "工作室自取", fee: 0 });
  if (settings.enable711) rows.push({ id: "7-11", label: "7-11 店到店", fee: int(settings.shippingFee711) });
  if (settings.enableFamily) rows.push({ id: "family", label: "全家店到店", fee: int(settings.shippingFeeFamily) });
  return rows.length ? rows : [{ id: "pickup", label: "工作室自取", fee: 0 }];
}

function paymentOptions(deliveryId) {
  const rows = [];
  if (deliveryId === "pickup" && settings.enableCashPickup !== false) rows.push({ id: "pickup_cash", label: "自取付款" });
  if (settings.enableTransfer !== false) rows.push({ id: "transfer", label: "銀行轉帳" });
  return rows.length ? rows : [{ id: "transfer", label: "銀行轉帳" }];
}

function openCheckout() {
  if (!cart.length) return;
  if (market.code === "HK") return toast("香港目前先顯示香港專屬價格；配送設定完成後才開放結帳。", "error");
  $("#cart-wrap")?.classList.add("hidden");
  const deliveries = deliveryOptions();
  $("#delivery-options").innerHTML = deliveries.map((row, index) => `<label class="check-line"><input type="radio" name="delivery" value="${esc(row.id)}" ${index === 0 ? "checked" : ""}><span>${esc(row.label)}${row.fee ? `（${money(row.fee)}）` : ""}</span></label>`).join("");
  $$("input[name=delivery]").forEach((radio) => { radio.onchange = updateCheckoutOptions; });
  updateCheckoutOptions();
  $("#checkout-wrap")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function updateCheckoutOptions() {
  const deliveryId = $("input[name=delivery]:checked")?.value || "pickup";
  const delivery = deliveryOptions().find((row) => row.id === deliveryId) || deliveryOptions()[0];
  const payments = paymentOptions(delivery.id);
  $("#payment-options").innerHTML = payments.map((row, index) => `<label class="check-line"><input type="radio" name="payment" value="${esc(row.id)}" ${index === 0 ? "checked" : ""}><span>${esc(row.label)}</span></label>`).join("");
  $("#store-fields")?.classList.toggle("hidden", delivery.id === "pickup");
  if ($("#delivery-note")) $("#delivery-note").textContent = delivery.id === "pickup" ? String(settings.pickupNote || "") : "請填寫取貨門市名稱與店號；訂單確認後再依店家通知完成付款與交付。";
  const subtotal = cart.reduce((sum, row) => sum + Number(row.price || 0) * int(row.qty), 0);
  $("#checkout-summary").innerHTML = `${cart.map((row) => `<div class="totals-line"><span>${esc(row.name)}｜${esc([row.variantName, row.capacity].filter(Boolean).join("｜"))} × ${int(row.qty)}${row.discountApplied ? "（多件優惠）" : ""}</span><b>${money(Number(row.price || 0) * int(row.qty))}</b></div>`).join("")}<div class="totals-line"><span>運費／處理費</span><b>${money(delivery.fee)}</b></div><div class="totals-line total"><span>預估總計</span><b>${money(subtotal + delivery.fee)}</b></div>`;
}

function validEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || ""));
}

function taipeiOrderDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
}

async function createSequentialOrder(orderData) {
  validateOrderData(orderData);
  const day = taipeiOrderDay();
  const hintKey = `77waxing_shop_sequence_${day}`;
  const hint = Math.min(9998, int(localStorage.getItem(hintKey)));
  const candidates = [];
  for (let sequence = Math.max(1, hint + 1); sequence <= 9999; sequence += 1) candidates.push(sequence);
  for (let sequence = 1; sequence <= hint; sequence += 1) candidates.push(sequence);

  for (const sequence of candidates) {
    const orderNo = `${day}${String(sequence).padStart(4, "0")}`;
    const orderRef = doc(db, "shopOrders", orderNo);
    try {
      await setDoc(orderRef, { ...orderData, orderNo });
      savePreference(hintKey, String(sequence));
      return { orderRef, orderNo };
    } catch (error) {
      if (error?.code === "permission-denied") continue;
      throw error;
    }
  }
  throw new Error("今日訂單流水號已達上限，請聯絡 77 Select。");
}

async function submitOrder(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (market.code !== "TW") return toast("香港配送設定完成後才會開放線上結帳。", "error");
  if (!currentUser) return toast("系統仍在連線，請稍後再送出。", "error");
  if (!cart.length) return toast("購物車是空的。", "error");

  const name = $("#checkout-name")?.value.trim() || "";
  const phone = $("#checkout-phone")?.value.trim() || "";
  const email = $("#checkout-email")?.value.trim() || "";
  const note = $("#checkout-note")?.value.trim() || "";
  const deliveryId = $("input[name=delivery]:checked")?.value || "";
  const paymentId = $("input[name=payment]:checked")?.value || "";
  const delivery = deliveryOptions().find((row) => row.id === deliveryId);
  if (!name || !phone || !validEmail(email) || !delivery || !paymentId) return toast("請完整填寫姓名、電話、Email、取貨與付款方式。", "error");
  if (!$("#checkout-terms")?.checked) return toast("請先確認並同意訂購與隱私說明。", "error");

  let storeInfo = "";
  if (delivery.id !== "pickup") {
    const storeName = $("#checkout-store-name")?.value.trim() || "";
    const storeId = $("#checkout-store-id")?.value.trim() || "";
    if (!storeName || !storeId) return toast("請填寫超商門市名稱與店號。", "error");
    storeInfo = `${storeName} (${storeId})`;
  }

  const button = $("#checkout-submit");
  const form = event.currentTarget;
  if (!beginCheckout(form)) return;
  const ownerUid = currentUser.uid;
  const originalCart = cartFingerprint(cart);
  if (button) button.disabled = true;
  try {
    await refreshCartProducts();
    reconcileCart();
    if (ownerUid !== currentUser?.uid) throw new Error("會員登入狀態已變更，請重新確認訂購資料。");
    if (!cart.length) throw new Error("購物車內容已失效，請重新選擇商品。");
    if (cartFingerprint(cart) !== originalCart) {
      updateCheckoutOptions();
      throw new Error("商品價格或可購買數量已更新，請確認購物車與總計後再送出。");
    }
    for (const row of cart) {
      const product = products.find((item) => item.id === row.productId);
      const variant = product ? normalizeVariants(product).find((item) => item.id === row.variantId) : null;
      if (!product || !variant || variant.stock < int(row.qty)) throw new Error(`${row.name}｜${row.variantName} 庫存不足，請重新確認購物車。`);
    }

    const items = cart.map((row) => ({
      productId: row.productId,
      variantId: row.variantId,
      name: row.name,
      variantName: row.variantName,
      capacity: row.capacity || "",
      region: market.code,
      currency: market.currency,
      quantity: int(row.qty),
      listUnitPrice: Number(row.listPrice || row.price || 0),
      unitPrice: Number(row.price || 0),
      discountApplied: Boolean(row.discountApplied),
      bulkMinQty: int(row.bulkMinQty || 0),
      imageUrl: row.imageUrl || "",
    }));
    const subtotal = items.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0);
    const orderData = {
      ownerUid,
      customerName: name,
      phone,
      email,
      deliveryMethod: delivery.id,
      paymentMethod: paymentId,
      storeInfo,
      shippingFee: Number(delivery.fee || 0),
      items,
      subtotal,
      total: subtotal + Number(delivery.fee || 0),
      status: "pending",
      inventoryCommitted: false,
      trackingNumber: null,
      note: note || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const { orderRef, orderNo } = await createSequentialOrder(orderData);

    savePreference("77waxing_shop_name", name);
    savePreference("77waxing_shop_phone", phone);
    savePreference("77waxing_shop_email", email);
    cart = [];
    saveCart();
    $("#checkout-wrap")?.classList.add("hidden");
    document.body.style.overflow = "";
    toast(`訂單 ${orderNo} 已送出，等待 77select 確認。77 Select 信件可能被判定為垃圾郵件；若超過 5 分鐘仍未收到信件，請與我們聯絡。`);
    dispatchShopEmail(orderRef.id);
  } catch (error) {
    console.error(error);
    toast(error?.message || "訂單送出失敗，請稍後再試。", "error");
  } finally {
    finishCheckout(form);
    if (button) button.disabled = false;
  }
}

async function dispatchShopEmail(orderId) {
  try {
    const user = auth.currentUser;
    if (!user || !orderId) return;
    const idToken = await user.getIdToken();
    const url = String(settings.appsScriptEmailUrl || DEFAULT_EMAIL_URL).trim() || DEFAULT_EMAIL_URL;
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kind: "shop_order", orderId, idToken }),
    }).catch(() => {});
  } catch (error) {
    console.warn("77select shop email dispatch failed", error);
  }
}

function toast(message, type = "ok") {
  if (type === "error") message = operationErrorText(message, "目前無法完成操作，請稍後再試或聯絡我們。");
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 3200);
}

function renderOrders() {
  if (renderingOrders) return;
  const host = $("#orders-list");
  if (!host) return;
  renderingOrders = true;
  if (!ownOrders.length) {
    host.innerHTML = `<div class="empty-state">目前還沒有訂單。從商品頁加入購物車後即可建立第一筆訂單。</div>`;
  } else {
    const STATUS = { pending: "待店家確認", confirmed: "已確認", packing: "備貨中", ready: "待自取", shipped: "已出貨", completed: "已完成", cancelled: "已取消" };
    host.innerHTML = ownOrders.map((order) => {
      const currency = orderCurrency(order);
      const statusClass = order.status === "cancelled" ? "cancelled" : order.status === "pending" ? "pending" : "";
      const deliveryText = order.deliveryMethod === "pickup" ? "工作室自取" : order.deliveryMethod === "7-11" ? "7-11" : order.deliveryMethod === "family" ? "全家" : order.deliveryMethod || "—";
      return `<article class="order-card"><div class="order-head"><div><div class="order-no">${esc(order.orderNo || order.id)}</div></div><span class="status ${statusClass}">${esc(STATUS[order.status] || order.status || "處理中")}</span></div><div class="order-items">${(order.items || []).map((item) => `<div class="order-line"><span>${esc(item.name)}${item.variantName || item.capacity ? `｜${esc([item.variantName, item.capacity].filter(Boolean).join("｜"))}` : ""} × ${int(item.quantity)}${item.discountApplied ? "（多件優惠）" : ""}</span><b>${money(Number(item.unitPrice || 0) * int(item.quantity), item.currency || currency)}</b></div>`).join("")}</div><div class="order-line"><span>交付方式</span><span>${esc(deliveryText)}${order.storeInfo ? `｜${esc(order.storeInfo)}` : ""}</span></div>${order.trackingNumber ? `<div class="order-line"><span>物流編號</span><b>${esc(order.trackingNumber)}</b></div>` : ""}<div class="totals-line total"><span>總計</span><b>${money(order.total, currency)}</b></div></article>`;
    }).join("");
  }
  renderingOrders = false;
}

async function loadSettings() {
  const snap = await getDoc(doc(db, "shopSettings", "public")).catch(() => null);
  settings = snap?.exists() ? snap.data() : {};
}

// Recheck current cart products from the server; do not download unrelated photos.
async function refreshCartProducts() {
  const ids = [...new Set(cart.map(row => row.productId))];
  const snapshots = await Promise.all(ids.map(id => getDocFromServer(doc(db, "shopProducts", id))));
  const refreshed = snapshots.filter(row => row.exists() && row.data().active === true)
    .map(row => ({ id: row.id, ...row.data() }));
  const selected = new Set(ids);
  products = [...products.filter(row => !selected.has(row.id)), ...refreshed]
    .sort((a,b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''),'zh-Hant'));
}

async function loadProducts() {
  const snap = await getDocs(query(collection(db, "shopProducts"), where("active", "==", true)));
  products = snap.docs.map((row) => ({ id: row.id, ...row.data() }))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
}
function renderLoadedCatalog() {
  renderFilters();
  renderProducts();
  reconcileCart();
  renderRequestedProduct();
  renderSelectHomeProducts(products.map((product) => ({
    id: product.id, name: product.name, imageUrl: primaryImage(product), priceText: catalogPriceText(product),
  })));
  const connection = $("#connection-state");
  if (connection) {
    connection.textContent = "";
    connection.hidden = true;
  }
}

function bindCaptureHandlers() {
  document.addEventListener("click", (event) => {
    const variantButton = event.target.closest?.("[data-regional-variant]");
    if (variantButton && !variantButton.disabled && selectedVariantId !== variantButton.dataset.regionalVariant) {
      selectedVariantId = variantButton.dataset.regionalVariant;
      selectedQuantity = 1;
      renderProductDetail();
      $("[data-regional-variant][aria-checked='true']")?.focus({ preventScroll: true });
      return;
    }

    const thumb = event.target.closest?.("[data-gallery-thumb]");
    if (thumb) {
      const main = $("[data-gallery-main]");
      if (main) main.src = thumb.dataset.galleryUrl || "";
      $$("[data-gallery-thumb]").forEach((button) => {
        button.classList.toggle("on", button === thumb);
        button.setAttribute("aria-pressed", String(button === thumb));
      });
      return;
    }

    const detailQuantity = event.target.closest?.("[data-detail-qty]");
    if (detailQuantity && !detailQuantity.disabled) {
      selectedQuantity += Number(detailQuantity.dataset.detailQty);
      updateDetailPurchase();
      return;
    }

    const detailAdd = event.target.closest?.("#product-detail-add");
    if (detailAdd && !detailAdd.disabled && selectedProduct && selectedVariantId) {
      addDetailSelectionToCart();
      return;
    }

    const qty = event.target.closest?.("[data-regional-qty]");
    if (qty) {
      event.preventDefault();
      event.stopImmediatePropagation();
      changeQty(qty.dataset.regionalQty, Number(qty.dataset.delta || 0));
      return;
    }

    const remove = event.target.closest?.("[data-regional-remove]");
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cart = cart.filter((row) => row.key !== remove.dataset.regionalRemove);
      saveCart();
      return;
    }

    if (event.target.closest?.("#checkout-open")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openCheckout();
    }
  }, true);

  $("#product-detail-body")?.addEventListener("change", (event) => {
    const select = event.target.closest?.("select[data-add-on-product]");
    if (!select) return;
    const productId = select.dataset.addOnProduct;
    if (select.value) selectedAddOns.set(productId, select.value);
    else selectedAddOns.delete(productId);
    updateDetailPurchase();
  });
  $("#checkout-form")?.addEventListener("submit", submitOrder, true);
}

function keepRegionalViewsAuthoritative() {
  const grid = $("#product-grid");
  if (grid) {
    new MutationObserver(() => {
      if (!renderingProducts && products.length && !grid.querySelector("[data-regional-detail], [data-regional-empty]")) {
        queueMicrotask(() => {
          renderFilters();
          renderProducts();
        });
      }
    }).observe(grid, { childList: true, subtree: true });
  }
  const orders = $("#orders-list");
  if (orders) {
    new MutationObserver(() => {
      if (!renderingOrders && ownOrders.length && !orders.querySelector(".order-card")) queueMicrotask(renderOrders);
    }).observe(orders, { childList: true, subtree: true });
  }
  const cartHost = $("#cart-items");
  if (cartHost) {
    new MutationObserver(() => {
      if (!renderingCart && !cartHost.querySelector("[data-regional-cart]") && (cart.length || cartHost.children.length)) queueMicrotask(renderCart);
    }).observe(cartHost, { childList: true, subtree: true });
  }
}

// Geography and public catalog/settings are independent network requests.
const initialSettings = loadSettings();
const initialCatalog = loadProducts().then(() => true, (error) => {
  console.error("77select regional storefront init failed", error);
  return false;
});
market = await detectMarket();
ensureMarketBadge();
bindCaptureHandlers();
keepRegionalViewsAuthoritative();
if (await initialCatalog) {
  renderLoadedCatalog();
  saveCart();
} else if (storeRoute.view === "product") {
  $("#product-detail-body").innerHTML = '<div class="select-product-unavailable"><h1 id="product-page-title">商品資料暫時無法載入</h1><p>請重新整理網頁再試一次。</p></div>';
}
await initialSettings;

onAuthStateChanged(auth, (user) => {
  const version = ++orderWatchVersion;
  orderUnsubscribe?.();
  orderUnsubscribe = null;
  currentUser = user || null;
  ownOrders = [];
  renderOrders();
  if (!user) return;
  orderUnsubscribe = onSnapshot(query(collection(db, "shopOrders"), where("ownerUid", "==", user.uid)), (snap) => {
    if (version !== orderWatchVersion || currentUser?.uid !== user.uid) return;
    ownOrders = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => Number(b.createdAt?.toMillis?.() || 0) - Number(a.createdAt?.toMillis?.() || 0));
    renderOrders();
  }, (error) => {
    if (version !== orderWatchVersion || currentUser?.uid !== user.uid) return;
    ownOrders = [];
    renderOrders();
    console.error(error);
  });
});

// A same-page promotion checkout changes storage without a browser storage event.
window.addEventListener("77select:cart-updated", (event) => {
  cart = Array.isArray(event.detail?.cart) ? event.detail.cart.map(row => ({ ...row })) : loadCart();
  reconcileCart();
});
window.addEventListener("storage", (event) => {
  if (event.key !== CART_KEY) return;
  cart = loadCart();
  reconcileCart();
});
