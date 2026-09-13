import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

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
let currentUser = null;
let ownOrders = [];
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
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const count = $("#cart-count");
  if (count) count.textContent = String(cart.reduce((sum, row) => sum + int(row.qty), 0));
  renderCart();
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

function productMinPrice(product) {
  const available = normalizeVariants(product).filter((variant) => variant.stock > 0);
  const source = available.length ? available : normalizeVariants(product);
  const prices = source.map(basePriceFor);
  return prices.length ? Math.min(...prices) : 0;
}

function totalStock(product) {
  return normalizeVariants(product).reduce((sum, variant) => sum + int(variant.stock), 0);
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
    const cartButton = $("#cart-open");
    cartButton?.parentElement?.insertBefore(badge, cartButton);
  }
  if (badge) badge.innerHTML = `<b>${esc(market.label)}</b><span>${esc(market.symbol)} 專屬售價</span>`;
  document.documentElement.dataset.market = market.code;
}

function cardMediaMarkup(product) {
  const image = primaryImage(product);
  if (!image) return `<div class="product-media store-product-media">77select</div>`;
  return `<div class="product-media store-product-media"><img src="${esc(image)}" alt="${esc(product.name)}" loading="lazy"></div>`;
}

function galleryMarkup(product, variantId) {
  const media = mediaForVariant(product, variantId);
  if (!media.length) return `<div class="product-gallery"><div class="product-gallery-main product-media">77select</div></div>`;
  const first = media[0];
  return `<div class="product-gallery">
    <div class="product-gallery-main"><img data-gallery-main src="${esc(first.url)}" alt="${esc(product.name)}"></div>
    ${media.length > 1 ? `<div class="product-gallery-thumbs">${media.map((row, index) => `<button type="button" class="gallery-thumb${index === 0 ? " on" : ""}" data-gallery-thumb="${esc(row.id)}" data-gallery-url="${esc(row.url)}" aria-label="查看商品圖片 ${index + 1}"><img src="${esc(row.url)}" alt=""></button>`).join("")}</div>` : ""}
  </div>`;
}

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;
  renderingProducts = true;
  const activeCategory = $("#category-filters .filter-btn.on")?.dataset.category || "全部商品";
  const visible = activeCategory === "全部商品" ? products : products.filter((p) => (p.category || "其他") === activeCategory);
  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state">目前沒有可訂購商品。</div>`;
    renderingProducts = false;
    return;
  }

  grid.innerHTML = visible.map((product) => {
    const variants = normalizeVariants(product);
    const stock = totalStock(product);
    const minPrice = productMinPrice(product);
    const priceText = variants.length > 1 ? `${money(minPrice)} 起` : money(minPrice);
    const hasBulk = variants.some(bulkEnabled);
    return `<article class="product-card regional-product-card">
      ${cardMediaMarkup(product)}
      <div class="product-body">
        <div class="product-top"><h3 class="product-title">${esc(product.name)}</h3><div class="product-price">${priceText}</div></div>
        <div class="market-inline">${esc(market.label)}專屬售價</div>
        ${hasBulk ? `<div class="bulk-badge">多件優惠</div>` : ""}
        <p class="product-desc">${esc(product.description || "")}</p>
        <div class="product-meta"><span>${esc(product.category || "其他")}</span><span>${variants.length} 種規格${stock > 0 ? `｜共 ${stock} 件` : "｜目前售完"}</span></div>
        <div class="product-actions"><button class="primary-btn" data-regional-buy="${esc(product.id)}" ${stock <= 0 ? "disabled" : ""}>${stock <= 0 ? "售完" : variants.length > 1 || hasBulk ? "選擇規格" : "加入購物車"}</button><button class="secondary-btn" data-regional-detail="${esc(product.id)}">詳情</button></div>
      </div>
    </article>`;
  }).join("");
  renderingProducts = false;
}

function renderFilters() {
  const host = $("#category-filters");
  if (!host) return;
  const current = host.querySelector(".filter-btn.on")?.dataset.category || "全部商品";
  const categories = ["全部商品", ...new Set(products.map((p) => String(p.category || "其他").trim()).filter(Boolean))];
  const chosen = categories.includes(current) ? current : "全部商品";
  host.innerHTML = categories.map((name) => `<button class="filter-btn${name === chosen ? " on" : ""}" type="button" data-regional-category="${esc(name)}" data-category="${esc(name)}">${esc(name)}</button>`).join("");
}

function renderProductDetail() {
  if (!selectedProduct) return;
  const variants = normalizeVariants(selectedProduct);
  const selectedVariant = variants.find((row) => row.id === selectedVariantId) || variants[0];
  selectedVariantId = selectedVariant?.id || null;
  const body = $("#product-detail-body");
  if (!body) return;

  body.innerHTML = `<div class="product-detail regional-product-detail">
    ${galleryMarkup(selectedProduct, selectedVariantId)}
    <div class="product-detail-copy">
      <span class="eyebrow">${esc(selectedProduct.category || "PRODUCT")}</span>
      <h2>${esc(selectedProduct.name)}</h2>
      <div class="market-inline strong">${esc(market.label)}｜${esc(market.currency)} 專屬價格</div>
      <p>${esc(selectedProduct.description || "")}</p>
      <div class="variant-picker" role="radiogroup" aria-label="選擇商品規格">
        ${variants.map((variant) => {
          const disabled = variant.stock <= 0;
          const discount = discountText(variant);
          return `<button type="button" class="variant-choice${variant.id === selectedVariantId ? " on" : ""}" data-regional-variant="${esc(variant.id)}" ${disabled ? "disabled" : ""}>
            <span><b>${esc(variant.name)}</b>${variant.capacity ? `<small>${esc(variant.capacity)}</small>` : ""}${discount ? `<small class="bulk-copy">${esc(discount)}</small>` : ""}</span>
            <span class="variant-choice-price">${money(basePriceFor(variant))}${disabled ? `<small>售完</small>` : `<small>庫存 ${variant.stock}</small>`}</span>
          </button>`;
        }).join("")}
      </div>
      ${selectedVariant && discountText(selectedVariant) ? `<div class="bulk-notice">數量優惠｜${esc(discountText(selectedVariant))}</div>` : ""}
      ${selectedProduct.spec ? `<div class="spec">${esc(selectedProduct.spec)}</div>` : ""}
    </div>
  </div>`;
  updateDetailAddButton();
}

function openProduct(productId) {
  const product = products.find((row) => row.id === productId);
  if (!product) return;
  selectedProduct = product;
  const variants = normalizeVariants(product);
  const firstAvailable = variants.find((variant) => variant.stock > 0) || variants[0];
  selectedVariantId = firstAvailable?.id || null;
  renderProductDetail();
  $("#product-modal-wrap")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function updateDetailAddButton() {
  const button = $("#product-detail-add");
  if (!button || !selectedProduct) return;
  const variant = normalizeVariants(selectedProduct).find((row) => row.id === selectedVariantId);
  button.disabled = !variant || variant.stock <= 0;
  button.textContent = variant && variant.stock > 0 ? `加入購物車｜${money(basePriceFor(variant))}` : "目前售完";
}

function addVariantToCart(productId, variantId) {
  const product = products.find((row) => row.id === productId);
  if (!product) return;
  const variant = normalizeVariants(product).find((row) => row.id === variantId);
  if (!variant || variant.stock <= 0) return toast("此規格目前沒有庫存。", "error");
  const key = cartKey(product.id, variant.id);
  const existing = cart.find((row) => row.key === key);
  const nextQty = int(existing?.qty) + 1;
  if (nextQty > variant.stock) return toast("購物車數量已達此規格目前庫存。", "error");
  const price = unitPriceFor(variant, nextQty);

  if (existing) {
    existing.qty = nextQty;
    existing.price = price;
    existing.listPrice = basePriceFor(variant);
    existing.discountApplied = price < existing.listPrice;
  } else {
    cart.push({
      key,
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      capacity: variant.capacity,
      region: market.code,
      currency: market.currency,
      price,
      listPrice: basePriceFor(variant),
      bulkMinQty: variant.bulkMinQty,
      discountApplied: price < basePriceFor(variant),
      imageUrl: primaryImage(product, variant.id),
      qty: 1,
    });
  }
  saveCart();
  toast(`已加入 ${product.name}｜${variantLabel(variant)}`);
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
  if (button) button.disabled = true;
  try {
    await loadProducts();
    reconcileCart();
    if (!cart.length) throw new Error("購物車內容已失效，請重新選擇商品。");
    for (const row of cart) {
      const product = products.find((item) => item.id === row.productId);
      const variant = product ? normalizeVariants(product).find((item) => item.id === row.variantId) : null;
      if (!product || !variant || variant.stock < int(row.qty)) throw new Error(`${row.name}｜${row.variantName} 庫存不足，請重新確認購物車。`);
    }

    const orderRef = doc(collection(db, "shopOrders"));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
    const orderNo = `77W-${day}-${orderRef.id.slice(0, 6).toUpperCase()}`;
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

    await setDoc(orderRef, {
      orderNo,
      ownerUid: currentUser.uid,
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
    });

    localStorage.setItem("77waxing_shop_name", name);
    localStorage.setItem("77waxing_shop_phone", phone);
    localStorage.setItem("77waxing_shop_email", email);
    cart = [];
    saveCart();
    $("#checkout-wrap")?.classList.add("hidden");
    document.body.style.overflow = "";
    toast(`訂單 ${orderNo} 已送出，等待 77select 確認。`);
    dispatchShopEmail(orderRef.id);
  } catch (error) {
    console.error(error);
    toast(error?.message || "訂單送出失敗，請稍後再試。", "error");
  } finally {
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

async function loadProducts() {
  const snap = await getDocs(query(collection(db, "shopProducts"), where("active", "==", true)));
  products = snap.docs.map((row) => ({ id: row.id, ...row.data() }))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
  renderFilters();
  renderProducts();
  reconcileCart();
  const connection = $("#connection-state");
  if (connection) connection.textContent = `${market.label}｜${market.currency} 專屬售價`;
}

function bindCaptureHandlers() {
  document.addEventListener("click", (event) => {
    const categoryButton = event.target.closest?.("[data-regional-category]");
    if (categoryButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      $$("#category-filters .filter-btn").forEach((button) => button.classList.toggle("on", button === categoryButton));
      renderProducts();
      return;
    }

    const buy = event.target.closest?.("[data-regional-buy]");
    if (buy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const product = products.find((row) => row.id === buy.dataset.regionalBuy);
      const variants = product ? normalizeVariants(product) : [];
      if (variants.length === 1 && variants[0].stock > 0 && !bulkEnabled(variants[0])) addVariantToCart(product.id, variants[0].id);
      else openProduct(buy.dataset.regionalBuy);
      return;
    }

    const detail = event.target.closest?.("[data-regional-detail]");
    if (detail) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProduct(detail.dataset.regionalDetail);
      return;
    }

    const variantButton = event.target.closest?.("[data-regional-variant]");
    if (variantButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selectedVariantId = variantButton.dataset.regionalVariant;
      renderProductDetail();
      return;
    }

    const thumb = event.target.closest?.("[data-gallery-thumb]");
    if (thumb) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const main = $("[data-gallery-main]");
      if (main) main.src = thumb.dataset.galleryUrl || "";
      $$("[data-gallery-thumb]").forEach((button) => button.classList.toggle("on", button === thumb));
      return;
    }

    if (event.target.closest?.("#product-detail-add")) {
      if (!selectedProduct || !selectedVariantId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      addVariantToCart(selectedProduct.id, selectedVariantId);
      $("#product-modal-wrap")?.classList.add("hidden");
      document.body.style.overflow = "";
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

  $("#checkout-form")?.addEventListener("submit", submitOrder, true);
}

function keepRegionalViewsAuthoritative() {
  const grid = $("#product-grid");
  if (grid) {
    new MutationObserver(() => {
      if (!renderingProducts && products.length && !grid.querySelector("[data-regional-buy]")) queueMicrotask(renderProducts);
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

market = await detectMarket();
ensureMarketBadge();
bindCaptureHandlers();
keepRegionalViewsAuthoritative();
await Promise.all([loadSettings(), loadProducts()]).catch((error) => console.error("77select regional storefront init failed", error));
saveCart();

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (!user) return;
  onSnapshot(query(collection(db, "shopOrders"), where("ownerUid", "==", user.uid)), (snap) => {
    ownOrders = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => Number(b.createdAt?.toMillis?.() || 0) - Number(a.createdAt?.toMillis?.() || 0));
    renderOrders();
  }, console.error);
});
