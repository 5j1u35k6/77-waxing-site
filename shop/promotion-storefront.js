import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

// Promotion storefront bridge. This stays isolated from regional-store.js so the
// existing product, detail, and cart behavior remains intact.
const { auth, db } = getPublicFirebase();
const CART_KEY = "77select_cart_v4";
const DEFAULT_EMAIL_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
let market = document.documentElement.dataset.market === "HK"
  ? { code: "HK", currency: "HKD", symbol: "HK$" }
  : { code: "TW", currency: "TWD", symbol: "NT$" };

let products = [];
let settings = {};
let currentUser = auth.currentUser || null;
let applying = false;
let scheduled = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const int = (value) => Math.max(0, Math.round(Number(value) || 0));
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function refreshMarket() {
  market = document.documentElement.dataset.market === "HK"
    ? { code: "HK", currency: "HKD", symbol: "HK$" }
    : { code: "TW", currency: "TWD", symbol: "NT$" };
}

function money(value, currency = market.currency) {
  const amount = Number(value || 0);
  if (currency === "HKD") return `HK$${amount.toLocaleString("zh-HK")}`;
  return `NT$${amount.toLocaleString("zh-TW")}`;
}

function parseMoney(text) {
  return Number(String(text || "").replace(/[^0-9.-]/g, "") || 0);
}

function loadCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
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
  return [{ id: "default", name: "一般規格", capacity: "", priceTWD: int(product.price || 0), priceHKD: int(product.priceHKD || product.price || 0), stock: int(product.stock || 0), bulkMinQty: 0, bulkPriceTWD: 0, bulkPriceHKD: 0 }];
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

function primaryImage(product, variantId = "") {
  const media = normalizeMedia(product);
  const shared = media.filter((row) => !row.variantId);
  const specific = variantId ? media.filter((row) => row.variantId === variantId) : [];
  return [...shared, ...specific][0]?.url || media[0]?.url || "";
}

function normalizePromotionItem(item = {}) {
  return {
    productId: String(item.productId || ""),
    variantId: String(item.variantId || "default"),
    productName: String(item.productName || ""),
    variantName: String(item.variantName || ""),
    capacity: String(item.capacity || ""),
  };
}

function normalizePromotions() {
  const source = Array.isArray(settings.promotions) ? settings.promotions : [];
  return source.map((promo, index) => {
    const groups = Array.isArray(promo?.groups) ? promo.groups.slice(0, 2).map((group, groupIndex) => ({
      id: String(group?.id || (groupIndex === 0 ? "buy" : "add")),
      title: String(group?.title || (groupIndex === 0 ? "購買品項" : "加購品項")),
      minQty: Math.max(1, int(group?.minQty || 1)),
      items: Array.isArray(group?.items) ? group.items.map(normalizePromotionItem).filter((item) => item.productId && item.variantId) : [],
    })) : [];
    return {
      id: String(promo?.id || `promo-${index + 1}`),
      title: String(promo?.title || "促銷優惠"),
      active: promo?.active !== false,
      promotionType: ["bundle_price", "percent_off", "amount_off", "gift"].includes(promo?.promotionType) ? promo.promotionType : "bundle_price",
      groups,
      discount: promo?.discount || {},
      gift: promo?.gift || null,
    };
  }).filter((promo) => promo.active && promo.groups.length >= 2 && promo.groups.slice(0, 2).every((group) => group.items.length));
}

function rowMatchesPromotionItem(row, item) {
  return row.productId === item.productId && String(row.variantId || "default") === String(item.variantId || "default");
}

function rowMatchesPromotionGroup(row, group) {
  return group.items.some((item) => rowMatchesPromotionItem(row, item));
}

function promotionAmount(promo, twKey, hkKey) {
  return market.code === "HK" ? int(promo.discount?.[hkKey]) : int(promo.discount?.[twKey]);
}

function findVariant(productId, variantId) {
  const product = products.find((item) => item.id === productId);
  const variant = product ? normalizeVariants(product).find((item) => item.id === variantId) : null;
  return { product, variant };
}

function reconcileCartRows(rows = loadCart()) {
  refreshMarket();
  return rows.map((row) => {
    const { product, variant } = findVariant(row.productId, row.variantId);
    if (!product || !variant) return null;
    const qty = Math.min(int(row.qty), variant.stock);
    if (qty <= 0) return null;
    const listPrice = basePriceFor(variant);
    const price = unitPriceFor(variant, qty);
    return {
      key: `${product.id}::${variant.id}`,
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
    };
  }).filter(Boolean);
}

function pickPromotionUnit(group, available) {
  let best = null;
  for (const entry of available) {
    if (entry.remaining <= 0 || !rowMatchesPromotionGroup(entry.row, group)) continue;
    if (!best || entry.unitPrice > best.unitPrice) best = entry;
  }
  return best;
}

function buildGiftLine(promo, setCount) {
  if (promo.promotionType !== "gift" || !promo.gift || setCount <= 0) return null;
  const gift = normalizePromotionItem(promo.gift);
  if (!gift.productId) return null;
  const { product, variant } = findVariant(gift.productId, gift.variantId);
  return {
    key: `gift::${promo.id}::${gift.productId}::${gift.variantId}`,
    promotionId: promo.id,
    promotionTitle: promo.title,
    productId: gift.productId,
    variantId: gift.variantId,
    name: product?.name || gift.productName || "贈品",
    variantName: variant?.name || gift.variantName || "",
    capacity: variant?.capacity || gift.capacity || "",
    quantity: Math.max(1, int(promo.gift.quantity || 1)) * setCount,
    currency: market.currency,
    imageUrl: product ? primaryImage(product, gift.variantId) : "",
  };
}

function calculateOnePromotion(promo, available) {
  let setCount = 0;
  let regularTotal = 0;
  let discountTotal = 0;
  while (true) {
    const picked = [];
    const touched = [];
    for (const group of promo.groups.slice(0, 2)) {
      for (let i = 0; i < Math.max(1, int(group.minQty || 1)); i += 1) {
        const entry = pickPromotionUnit(group, available);
        if (!entry) {
          touched.forEach((row) => { row.remaining += 1; });
          return { setCount, regularTotal, discountTotal, gift: buildGiftLine(promo, setCount) };
        }
        entry.remaining -= 1;
        touched.push(entry);
        picked.push(entry);
      }
    }
    const regular = picked.reduce((sum, entry) => sum + Number(entry.unitPrice || 0), 0);
    let discount = 0;
    if (promo.promotionType === "bundle_price") {
      const bundlePrice = promotionAmount(promo, "bundlePriceTWD", "bundlePriceHKD");
      discount = bundlePrice > 0 ? Math.max(0, regular - bundlePrice) : 0;
    } else if (promo.promotionType === "percent_off") {
      const percent = Math.min(99, Math.max(1, int(promo.discount?.percentOff)));
      discount = Math.round(regular * (percent / 100));
    } else if (promo.promotionType === "amount_off") {
      discount = Math.min(regular, promotionAmount(promo, "amountTWD", "amountHKD"));
    }
    if (promo.promotionType !== "gift" && discount <= 0) {
      touched.forEach((row) => { row.remaining += 1; });
      return { setCount, regularTotal, discountTotal, gift: buildGiftLine(promo, setCount) };
    }
    regularTotal += regular;
    discountTotal += discount;
    setCount += 1;
  }
}

function cartPricing(rows = reconcileCartRows()) {
  refreshMarket();
  const subtotal = rows.reduce((sum, row) => sum + Number(row.price || 0) * int(row.qty), 0);
  const available = rows.map((row) => ({ row, remaining: int(row.qty), unitPrice: Number(row.price || 0) })).filter((entry) => entry.remaining > 0);
  const adjustments = [];
  const gifts = [];
  for (const promo of normalizePromotions()) {
    const result = calculateOnePromotion(promo, available);
    if (result.discountTotal > 0) adjustments.push({ id: promo.id, title: promo.title, type: promo.promotionType, setCount: result.setCount, amount: result.discountTotal, regularTotal: result.regularTotal });
    if (result.gift) gifts.push(result.gift);
  }
  const discountTotal = Math.min(subtotal, adjustments.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  return { rows, subtotal, discountTotal, total: Math.max(0, subtotal - discountTotal), adjustments, gifts };
}

function hasPromotionEffect(pricing = cartPricing()) {
  return pricing.adjustments.length > 0 || pricing.gifts.length > 0;
}

function promotionSummaryHtml(pricing) {
  if (!hasPromotionEffect(pricing)) return "";
  const discounts = pricing.adjustments.map((row) => `<div class="cart-discount-note promo-bridge-note">已套用 ${esc(row.title)}${row.setCount > 1 ? ` × ${row.setCount}` : ""}｜-${money(row.amount)}</div>`).join("");
  const gifts = pricing.gifts.map((row) => `<div class="cart-discount-note promo-bridge-note">贈品 ${esc(row.name)}${row.variantName || row.capacity ? `｜${esc([row.variantName, row.capacity].filter(Boolean).join("｜"))}` : ""} × ${int(row.quantity)}</div>`).join("");
  return `<div class="promo-bridge-summary" data-regional-cart>${discounts}${gifts}</div>`;
}

function patchCartUi() {
  const container = $("#cart-items");
  const subtotal = $("#cart-subtotal");
  if (!container || !subtotal) return;
  const pricing = cartPricing();
  container.querySelectorAll(".promo-bridge-summary").forEach((node) => node.remove());
  if (hasPromotionEffect(pricing)) container.insertAdjacentHTML("beforeend", promotionSummaryHtml(pricing));
  subtotal.textContent = money(pricing.total);
  const label = subtotal.closest?.(".totals-line")?.querySelector("span");
  if (label) label.textContent = pricing.discountTotal ? "折扣後小計" : "商品小計";
}

function checkoutPromotionLines(pricing) {
  const discountLines = pricing.adjustments.map((row) => `<div class="totals-line promo-bridge-line"><span>促銷優惠｜${esc(row.title)}${row.setCount > 1 ? ` × ${row.setCount}` : ""}</span><b>-${money(row.amount)}</b></div>`).join("");
  const giftLines = pricing.gifts.map((row) => `<div class="totals-line promo-bridge-line"><span>贈品｜${esc(row.name)}${row.variantName || row.capacity ? `｜${esc([row.variantName, row.capacity].filter(Boolean).join("｜"))}` : ""} × ${int(row.quantity)}</span><b>${money(0)}</b></div>`).join("");
  return `${discountLines}${giftLines}`;
}

function patchCheckoutUi() {
  const summary = $("#checkout-summary");
  if (!summary || !summary.children.length) return;
  const pricing = cartPricing();
  summary.querySelectorAll(".promo-bridge-line").forEach((node) => node.remove());
  const totalLine = summary.querySelector(".totals-line.total");
  if (!totalLine) return;
  const feeLine = totalLine.previousElementSibling;
  const fee = feeLine ? parseMoney(feeLine.querySelector("b")?.textContent || "0") : 0;
  if (hasPromotionEffect(pricing)) (feeLine || totalLine).insertAdjacentHTML("beforebegin", checkoutPromotionLines(pricing));
  const totalValue = totalLine.querySelector("b");
  if (totalValue) totalValue.textContent = money(pricing.total + fee);
}

function syncUi() {
  if (applying) return;
  applying = true;
  try {
    patchCartUi();
    patchCheckoutUi();
  } finally {
    applying = false;
    scheduled = false;
  }
}

function scheduleSync() {
  if (scheduled || applying) return;
  scheduled = true;
  requestAnimationFrame(syncUi);
}

function deliveryOptions() {
  const rows = [];
  if (settings.enablePickup !== false) rows.push({ id: "pickup", label: "工作室自取", fee: 0 });
  if (settings.enable711) rows.push({ id: "7-11", label: "7-11 店到店", fee: int(settings.shippingFee711) });
  if (settings.enableFamily) rows.push({ id: "family", label: "全家店到店", fee: int(settings.shippingFeeFamily) });
  return rows.length ? rows : [{ id: "pickup", label: "工作室自取", fee: 0 }];
}

function validEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || ""));
}

function toast(message, type = "ok") {
  const el = $("#toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 3200);
}

async function refreshData() {
  const [settingsSnap, productSnap] = await Promise.all([
    getDoc(doc(db, "shopSettings", "public")).catch(() => null),
    getDocs(query(collection(db, "shopProducts"), where("active", "==", true))),
  ]);
  settings = settingsSnap?.exists() ? settingsSnap.data() : {};
  products = productSnap.docs.map((row) => ({ id: row.id, ...row.data() }));
}

function demandKey(productId, variantId) {
  return `${productId}::${variantId}`;
}

function assertStock(rows, gifts) {
  const demand = new Map();
  for (const row of rows) demand.set(demandKey(row.productId, row.variantId), int(row.qty) + int(demand.get(demandKey(row.productId, row.variantId))));
  for (const gift of gifts) demand.set(demandKey(gift.productId, gift.variantId), int(gift.quantity) + int(demand.get(demandKey(gift.productId, gift.variantId))));
  for (const [key, quantity] of demand.entries()) {
    const [productId, variantId] = key.split("::");
    const { product, variant } = findVariant(productId, variantId);
    if (!product || !variant || variant.stock < quantity) throw new Error(`${product?.name || "商品"}｜${variant?.name || "規格"} 庫存不足，請重新確認購物車。`);
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

async function submitPromotedOrder(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  if (market.code !== "TW") return toast("香港配送設定完成後才會開放線上結帳。", "error");
  if (!currentUser) return toast("系統仍在連線，請稍後再送出。", "error");

  const button = $("#checkout-submit");
  if (button) button.disabled = true;
  try {
    await refreshData();
    const rows = reconcileCartRows(loadCart());
    const pricing = cartPricing(rows);
    if (!rows.length) throw new Error("購物車是空的。");
    if (!hasPromotionEffect(pricing)) throw new Error("目前沒有可套用的促銷，請重新整理後再送出。");

    const name = $("#checkout-name")?.value.trim() || "";
    const phone = $("#checkout-phone")?.value.trim() || "";
    const email = $("#checkout-email")?.value.trim() || "";
    const note = $("#checkout-note")?.value.trim() || "";
    const deliveryId = $("input[name=delivery]:checked")?.value || "";
    const paymentId = $("input[name=payment]:checked")?.value || "";
    const delivery = deliveryOptions().find((row) => row.id === deliveryId);
    if (!name || !phone || !validEmail(email) || !delivery || !paymentId) throw new Error("請完整填寫姓名、電話、Email、取貨與付款方式。");
    if (!$("#checkout-terms")?.checked) throw new Error("請先確認並同意訂購與隱私說明。");

    let storeInfo = "";
    if (delivery.id !== "pickup") {
      const storeName = $("#checkout-store-name")?.value.trim() || "";
      const storeId = $("#checkout-store-id")?.value.trim() || "";
      if (!storeName || !storeId) throw new Error("請填寫超商門市名稱與店號。");
      storeInfo = `${storeName} (${storeId})`;
    }

    assertStock(rows, pricing.gifts);

    const orderRef = doc(collection(db, "shopOrders"));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
    const orderNo = `77W-${day}-${orderRef.id.slice(0, 6).toUpperCase()}`;
    const items = rows.map((row) => ({
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
    const giftItems = pricing.gifts.map((row) => ({
      productId: row.productId,
      variantId: row.variantId,
      name: row.name,
      variantName: row.variantName,
      capacity: row.capacity || "",
      region: market.code,
      currency: market.currency,
      quantity: int(row.quantity),
      listUnitPrice: 0,
      unitPrice: 0,
      discountApplied: true,
      isGift: true,
      promotionId: row.promotionId,
      promotionTitle: row.promotionTitle,
      imageUrl: row.imageUrl || "",
    }));

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
      items: [...items, ...giftItems],
      subtotalBeforePromotions: pricing.subtotal,
      promotionDiscountTotal: pricing.discountTotal,
      promotions: pricing.adjustments.map((row) => ({ id: row.id, title: row.title, type: row.type, setCount: row.setCount, amount: row.amount, regularTotal: row.regularTotal })),
      promotionGifts: pricing.gifts.map((row) => ({ promotionId: row.promotionId, promotionTitle: row.promotionTitle, productId: row.productId, variantId: row.variantId, name: row.name, variantName: row.variantName, capacity: row.capacity || "", quantity: int(row.quantity) })),
      subtotal: pricing.total,
      total: pricing.total + Number(delivery.fee || 0),
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
    localStorage.setItem(CART_KEY, "[]");
    const count = $("#cart-count");
    if (count) count.textContent = "0";
    const cartItems = $("#cart-items");
    if (cartItems) cartItems.innerHTML = `<div class="empty-state" data-regional-cart>購物車目前是空的。</div>`;
    $("#checkout-wrap")?.classList.add("hidden");
    document.body.style.overflow = "";
    toast(`訂單 ${orderNo} 已送出，已套用促銷優惠。`);
    dispatchShopEmail(orderRef.id);
  } catch (error) {
    console.error(error);
    toast(error?.message || "促銷訂單送出失敗，請稍後再試。", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function bindSubmitBridge() {
  document.addEventListener("submit", (event) => {
    if (!event.target?.matches?.("#checkout-form")) return;
    const pricing = cartPricing();
    if (!hasPromotionEffect(pricing)) return;
    submitPromotedOrder(event);
  }, true);
}

onAuthStateChanged(auth, (user) => { currentUser = user || null; });
onSnapshot(doc(db, "shopSettings", "public"), (snap) => {
  settings = snap.exists() ? snap.data() : {};
  scheduleSync();
}, console.error);
onSnapshot(query(collection(db, "shopProducts"), where("active", "==", true)), (snap) => {
  products = snap.docs.map((row) => ({ id: row.id, ...row.data() }));
  scheduleSync();
}, console.error);

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"],
});
window.addEventListener("storage", scheduleSync);
bindSubmitBridge();
scheduleSync();
