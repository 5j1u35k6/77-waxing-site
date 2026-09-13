import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

const { auth, db } = getPublicFirebase();
const DEFAULT_EMAIL_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
const DEFAULT_SETTINGS = {
  storeName: "77waxing",
  heroEyebrow: "77WAXING SELECT",
  heroTitle: "把日常保養需要的，簡單整理給你。",
  heroDescription: "產品內容會由 77waxing 後台持續更新；價格、庫存與交付方式以訂單確認內容為準。",
  storeEmail: "77waxing.mail@gmail.com",
  enablePickup: true,
  enable711: false,
  enableFamily: false,
  shippingFee711: 60,
  shippingFeeFamily: 60,
  enableCashPickup: true,
  enableTransfer: true,
  pickupNote: "工作室自取時間會在訂單確認後通知。",
  transferNote: "匯款資訊請以 77waxing 訂單確認通知為準。",
  appsScriptEmailUrl: DEFAULT_EMAIL_URL,
};
const STATUS = {
  pending: "待店家確認",
  confirmed: "已確認",
  packing: "備貨中",
  ready: "待自取",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
};

let settings = { ...DEFAULT_SETTINGS };
let products = [];
let cart = loadCart();
let category = "全部商品";
let currentUser = null;
let ordersUnsub = null;
let messagesUnsub = null;
let orderRows = [];
let messageRows = [];
let selectedProduct = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (value) => `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
const clampInt = (value, min = 0, max = 999999) => Math.min(max, Math.max(min, Math.trunc(Number(value) || 0)));

function timestampMillis(value) {
  const firebaseMillis = value?.toMillis?.();
  if (Number.isFinite(firebaseMillis)) return firebaseMillis;
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatDate(value) {
  const firebaseDate = value?.toDate?.();
  if (firebaseDate) return firebaseDate.toLocaleString("zh-TW");
  return value ? new Date(value).toLocaleString("zh-TW") : "—";
}
function loadCart() {
  try { return JSON.parse(localStorage.getItem("77waxing_cart_v2") || "[]"); }
  catch { return []; }
}
function saveCart() {
  localStorage.setItem("77waxing_cart_v2", JSON.stringify(cart));
  $("#cart-count").textContent = String(cart.reduce((sum, row) => sum + row.qty, 0));
  renderCart();
}
function toast(message, type = "ok") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 3200);
}
function setTab(name) {
  $$("[data-tab]").forEach((button) => button.classList.toggle("on", button.dataset.tab === name));
  $$("[data-view]").forEach((section) => section.classList.toggle("hidden", section.dataset.view !== name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openLayer(selector) {
  $(selector).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeLayer(selector) {
  $(selector).classList.add("hidden");
  document.body.style.overflow = "";
}

async function loadSettings() {
  const snap = await getDoc(doc(db, "shopSettings", "public")).catch(() => null);
  settings = snap?.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : { ...DEFAULT_SETTINGS };
  $("#hero-eyebrow").textContent = settings.heroEyebrow || DEFAULT_SETTINGS.heroEyebrow;
  $("#hero-title").textContent = settings.heroTitle || DEFAULT_SETTINGS.heroTitle;
  $("#hero-description").textContent = settings.heroDescription || DEFAULT_SETTINGS.heroDescription;
  const email = settings.storeEmail || DEFAULT_SETTINGS.storeEmail;
  $("#store-email-link").textContent = email;
  $("#store-email-link").href = `mailto:${email}`;
}
async function loadProducts() {
  const snap = await getDocs(query(collection(db, "shopProducts"), where("active", "==", true)));
  products = snap.docs
    .map((row) => ({ id: row.id, ...row.data() }))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
  renderFilters();
  renderProducts();
  reconcileCart();
}
function reconcileCart() {
  let changed = false;
  cart = cart.filter((row) => {
    const product = products.find((item) => item.id === row.id);
    if (!product) { changed = true; return false; }
    const qty = Math.min(Number(row.qty || 0), Math.max(0, Number(product.stock || 0)));
    if (qty !== row.qty || row.price !== Number(product.price || 0) || row.name !== product.name) changed = true;
    row.qty = qty;
    row.name = product.name || "商品";
    row.price = Number(product.price || 0);
    row.imageUrl = product.imageUrl || "";
    return qty > 0;
  });
  if (changed) saveCart(); else renderCart();
}
function renderFilters() {
  const categories = ["全部商品", ...new Set(products.map((p) => String(p.category || "其他").trim()).filter(Boolean))];
  if (!categories.includes(category)) category = "全部商品";
  $("#category-filters").innerHTML = categories.map((name) => `<button class="filter-btn${name === category ? " on" : ""}" data-category="${esc(name)}">${esc(name)}</button>`).join("");
  $$("[data-category]").forEach((button) => {
    button.onclick = () => { category = button.dataset.category; renderFilters(); renderProducts(); };
  });
}
function mediaMarkup(product) {
  if (!product.imageUrl) return `<div class="product-media">77waxing</div>`;
  return `<div class="product-media"><img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" loading="lazy"></div>`;
}
function renderProducts() {
  const visible = category === "全部商品" ? products : products.filter((p) => (p.category || "其他") === category);
  if (!visible.length) {
    $("#product-grid").innerHTML = `<div class="empty-state">目前沒有可訂購商品。後台新增或上架商品後會自動顯示在這裡。</div>`;
    return;
  }
  $("#product-grid").innerHTML = visible.map((p) => {
    const stock = Number(p.stock || 0);
    return `<article class="product-card">
      ${mediaMarkup(p)}
      <div class="product-body">
        <div class="product-top"><h3 class="product-title">${esc(p.name)}</h3><div class="product-price">${money(p.price)}</div></div>
        <p class="product-desc">${esc(p.description || "")}</p>
        <div class="product-meta"><span>${esc(p.category || "其他")}</span><span>${stock > 0 ? `庫存 ${stock}` : "目前售完"}</span></div>
        <div class="product-actions"><button class="primary-btn" data-add="${p.id}" ${stock <= 0 ? "disabled" : ""}>${stock <= 0 ? "售完" : "加入購物車"}</button><button class="secondary-btn" data-detail="${p.id}">詳情</button></div>
      </div>
    </article>`;
  }).join("");
  $$("[data-add]").forEach((button) => { button.onclick = () => addToCart(button.dataset.add); });
  $$("[data-detail]").forEach((button) => { button.onclick = () => openProduct(button.dataset.detail); });
}
function openProduct(id) {
  const product = products.find((row) => row.id === id);
  if (!product) return;
  selectedProduct = product;
  $("#product-detail-body").innerHTML = `<div class="product-detail">
    ${mediaMarkup(product)}
    <div><span class="eyebrow">${esc(product.category || "PRODUCT")}</span><h2>${esc(product.name)}</h2><div class="product-price">${money(product.price)}</div><p>${esc(product.description || "")}</p>${product.spec ? `<div class="spec">${esc(product.spec)}</div>` : ""}<p class="order-date">${Number(product.stock || 0) > 0 ? `目前庫存：${Number(product.stock)}` : "目前售完"}</p></div>
  </div>`;
  $("#product-detail-add").disabled = Number(product.stock || 0) <= 0;
  $("#product-detail-add").textContent = Number(product.stock || 0) > 0 ? "加入購物車" : "目前售完";
  openLayer("#product-modal-wrap");
}
function addToCart(id) {
  const product = products.find((row) => row.id === id);
  if (!product || Number(product.stock || 0) <= 0) return toast("此商品目前沒有庫存。", "error");
  const existing = cart.find((row) => row.id === id);
  const nextQty = Number(existing?.qty || 0) + 1;
  if (nextQty > Number(product.stock || 0)) return toast("購物車數量已達目前庫存。", "error");
  if (existing) existing.qty = nextQty;
  else cart.push({ id: product.id, name: product.name, price: Number(product.price || 0), imageUrl: product.imageUrl || "", qty: 1 });
  saveCart();
  toast(`已加入 ${product.name}`);
}
function changeQty(id, delta) {
  const row = cart.find((item) => item.id === id);
  const product = products.find((item) => item.id === id);
  if (!row || !product) return;
  row.qty = clampInt(Number(row.qty || 0) + delta, 0, Number(product.stock || 0));
  if (!row.qty) cart = cart.filter((item) => item.id !== id);
  saveCart();
}
function renderCart() {
  const container = $("#cart-items");
  if (!cart.length) {
    container.innerHTML = `<div class="empty-state">購物車目前是空的。</div>`;
  } else {
    container.innerHTML = cart.map((row) => `<div class="cart-row">
      <div class="product-media">${row.imageUrl ? `<img src="${esc(row.imageUrl)}" alt="">` : "77"}</div>
      <div><h4>${esc(row.name)}</h4><p>${money(row.price)} × ${row.qty}</p><div class="qty"><button data-qty="${row.id}" data-delta="-1">−</button><b>${row.qty}</b><button data-qty="${row.id}" data-delta="1">＋</button></div></div>
      <button class="icon-btn" data-remove="${row.id}" aria-label="移除">×</button>
    </div>`).join("");
  }
  $$("[data-qty]", container).forEach((button) => { button.onclick = () => changeQty(button.dataset.qty, Number(button.dataset.delta)); });
  $$("[data-remove]", container).forEach((button) => { button.onclick = () => { cart = cart.filter((row) => row.id !== button.dataset.remove); saveCart(); }; });
  $("#cart-subtotal").textContent = money(cart.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.qty || 0), 0));
  $("#checkout-open").disabled = !cart.length;
}

function deliveryOptions() {
  const rows = [];
  if (settings.enablePickup !== false) rows.push({ id: "pickup", label: "工作室自取", fee: 0 });
  if (settings.enable711) rows.push({ id: "7-11", label: "7-11 店到店", fee: clampInt(settings.shippingFee711) });
  if (settings.enableFamily) rows.push({ id: "family", label: "全家店到店", fee: clampInt(settings.shippingFeeFamily) });
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
  closeLayer("#cart-wrap");
  const deliveries = deliveryOptions();
  $("#delivery-options").innerHTML = deliveries.map((row, index) => `<label class="check-line"><input type="radio" name="delivery" value="${row.id}" ${index === 0 ? "checked" : ""}><span>${esc(row.label)}${row.fee ? `（${money(row.fee)}）` : ""}</span></label>`).join("");
  $$("input[name=delivery]").forEach((radio) => { radio.onchange = updateCheckoutOptions; });
  $("#checkout-email").value = localStorage.getItem("77waxing_shop_email") || "";
  $("#checkout-name").value = localStorage.getItem("77waxing_shop_name") || "";
  $("#checkout-phone").value = localStorage.getItem("77waxing_shop_phone") || "";
  updateCheckoutOptions();
  openLayer("#checkout-wrap");
}
function updateCheckoutOptions() {
  const deliveryId = $("input[name=delivery]:checked")?.value || "pickup";
  const delivery = deliveryOptions().find((row) => row.id === deliveryId) || deliveryOptions()[0];
  const payments = paymentOptions(delivery.id);
  $("#payment-options").innerHTML = payments.map((row, index) => `<label class="check-line"><input type="radio" name="payment" value="${row.id}" ${index === 0 ? "checked" : ""}><span>${esc(row.label)}</span></label>`).join("");
  $("#store-fields").classList.toggle("hidden", delivery.id === "pickup");
  $("#delivery-note").textContent = delivery.id === "pickup" ? settings.pickupNote : "請填寫取貨門市名稱與店號；訂單確認後再依店家通知完成付款與交付。";
  const subtotal = cart.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.qty || 0), 0);
  $("#checkout-summary").innerHTML = `${cart.map((row) => `<div class="totals-line"><span>${esc(row.name)} × ${row.qty}</span><b>${money(Number(row.price || 0) * Number(row.qty || 0))}</b></div>`).join("")}<div class="totals-line"><span>運費／處理費</span><b>${money(delivery.fee)}</b></div><div class="totals-line total"><span>預估總計</span><b>${money(subtotal + delivery.fee)}</b></div>`;
}
function validEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || ""));
}
async function submitOrder(event) {
  event.preventDefault();
  if (!currentUser) return toast("系統仍在連線，請稍後再送出。", "error");
  if (!cart.length) return toast("購物車是空的。", "error");

  const name = $("#checkout-name").value.trim();
  const phone = $("#checkout-phone").value.trim();
  const email = $("#checkout-email").value.trim();
  const note = $("#checkout-note").value.trim();
  const deliveryId = $("input[name=delivery]:checked")?.value || "";
  const paymentId = $("input[name=payment]:checked")?.value || "";
  const delivery = deliveryOptions().find((row) => row.id === deliveryId);
  if (!name || !phone || !validEmail(email) || !delivery || !paymentId) return toast("請完整填寫姓名、電話、Email、取貨與付款方式。", "error");
  if (!$("#checkout-terms").checked) return toast("請先確認並同意訂購與隱私說明。", "error");

  let storeInfo = "";
  if (delivery.id !== "pickup") {
    const storeName = $("#checkout-store-name").value.trim();
    const storeId = $("#checkout-store-id").value.trim();
    if (!storeName || !storeId) return toast("請填寫超商門市名稱與店號。", "error");
    storeInfo = `${storeName} (${storeId})`;
  }

  const button = $("#checkout-submit");
  button.disabled = true;
  try {
    await loadProducts();
    for (const row of cart) {
      const product = products.find((item) => item.id === row.id);
      if (!product || Number(product.stock || 0) < Number(row.qty || 0)) throw new Error(`${row.name} 庫存不足，請重新確認購物車。`);
    }

    const orderRef = doc(collection(db, "shopOrders"));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
    const orderNo = `77W-${day}-${orderRef.id.slice(0, 6).toUpperCase()}`;
    const items = cart.map((row) => ({ productId: row.id, name: row.name, quantity: Number(row.qty || 0), unitPrice: Number(row.price || 0), imageUrl: row.imageUrl || "" }));
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
    closeLayer("#checkout-wrap");
    setTab("orders");
    toast(`訂單 ${orderNo} 已送出，等待 77waxing 確認。`);
    dispatchShopEmail(orderRef.id);
  } catch (error) {
    console.error(error);
    toast(error?.message || "訂單送出失敗，請稍後再試。", "error");
  } finally {
    button.disabled = false;
  }
}
async function dispatchShopEmail(orderId) {
  try {
    const user = auth.currentUser;
    if (!user || !orderId) return;
    const idToken = await user.getIdToken();
    const url = String(settings.appsScriptEmailUrl || DEFAULT_EMAIL_URL).trim() || DEFAULT_EMAIL_URL;
    const payload = JSON.stringify({ kind: "shop_order", orderId, idToken });
    const send = () => fetch(url, { method: "POST", mode: "no-cors", cache: "no-store", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: payload }).catch(() => {});
    send();
    setTimeout(send, 3500);
  } catch (error) {
    console.warn("shop email dispatch failed", error);
  }
}

function watchOrders(user) {
  ordersUnsub?.();
  ordersUnsub = onSnapshot(query(collection(db, "shopOrders"), where("ownerUid", "==", user.uid)), (snap) => {
    orderRows = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    renderOrders();
  }, (error) => {
    console.error(error);
    $("#orders-list").innerHTML = `<div class="empty-state">目前無法讀取訂單，請稍後再試。</div>`;
  });
}
function renderOrders() {
  if (!orderRows.length) {
    $("#orders-list").innerHTML = `<div class="empty-state">目前還沒有訂單。從商品頁加入購物車後即可建立第一筆訂單。</div>`;
    return;
  }
  $("#orders-list").innerHTML = orderRows.map((order) => {
    const statusClass = order.status === "cancelled" ? "cancelled" : order.status === "pending" ? "pending" : "";
    const deliveryText = order.deliveryMethod === "pickup" ? "工作室自取" : order.deliveryMethod === "7-11" ? "7-11" : order.deliveryMethod === "family" ? "全家" : order.deliveryMethod || "—";
    return `<article class="order-card">
      <div class="order-head"><div><div class="order-no">${esc(order.orderNo || order.id)}</div><div class="order-date">${formatDate(order.createdAt)}</div></div><span class="status ${statusClass}">${esc(STATUS[order.status] || order.status || "處理中")}</span></div>
      <div class="order-items">${(order.items || []).map((item) => `<div class="order-line"><span>${esc(item.name)} × ${Number(item.quantity || 0)}</span><b>${money(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</b></div>`).join("")}</div>
      <div class="order-line"><span>交付方式</span><span>${esc(deliveryText)}${order.storeInfo ? `｜${esc(order.storeInfo)}` : ""}</span></div>
      ${order.trackingNumber ? `<div class="order-line"><span>物流編號</span><b>${esc(order.trackingNumber)}</b></div>` : ""}
      <div class="totals-line total"><span>總計</span><b>${money(order.total)}</b></div>
    </article>`;
  }).join("");
}
function watchMessages(user) {
  messagesUnsub?.();
  messagesUnsub = onSnapshot(query(collection(db, "shopMessages"), where("ownerUid", "==", user.uid)), (snap) => {
    messageRows = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    renderMessages();
  }, console.error);
}
function renderMessages() {
  if (!messageRows.length) {
    $("#messages-list").innerHTML = `<div class="empty-state">尚無留言紀錄。</div>`;
    return;
  }
  $("#messages-list").innerHTML = messageRows.map((message) => `<div class="message-card"><div class="message-meta"><b>${esc(message.name || "顧客")}</b><span>${formatDate(message.createdAt)}</span><span>${message.status === "replied" ? "已回覆" : "待回覆"}</span></div><p>${esc(message.content || "")}</p>${message.reply ? `<div class="message-reply"><b>77waxing 回覆</b><div>${esc(message.reply)}</div></div>` : ""}</div>`).join("");
}
async function submitQuestion(event) {
  event.preventDefault();
  if (!currentUser) return toast("系統仍在連線，請稍後再試。", "error");
  const name = $("#qa-name").value.trim();
  const email = $("#qa-email").value.trim();
  const content = $("#qa-content").value.trim();
  if (!name || !validEmail(email) || content.length < 2) return toast("請填寫姓名、有效 Email 與問題內容。", "error");
  const submit = $("#qa-submit");
  submit.disabled = true;
  try {
    await addDoc(collection(db, "shopMessages"), { ownerUid: currentUser.uid, name, email, content: content.slice(0, 1500), reply: null, status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    $("#qa-content").value = "";
    toast("留言已送出。77waxing 回覆後會顯示在這裡。");
  } catch (error) {
    console.error(error);
    toast("留言送出失敗，請稍後再試。", "error");
  } finally {
    submit.disabled = false;
  }
}

async function ensureAuth() {
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  if (!auth.currentUser) await signInAnonymously(auth);
}
function bindUI() {
  $$("[data-tab]").forEach((button) => { button.onclick = () => setTab(button.dataset.tab); });
  $("#hero-shop").onclick = () => setTab("shop");
  $("#cart-open").onclick = () => openLayer("#cart-wrap");
  $("#cart-close").onclick = () => closeLayer("#cart-wrap");
  $("#cart-backdrop").onclick = () => closeLayer("#cart-wrap");
  $("#checkout-open").onclick = openCheckout;
  $("#checkout-close").onclick = () => closeLayer("#checkout-wrap");
  $("#checkout-backdrop").onclick = () => closeLayer("#checkout-wrap");
  $("#checkout-form").onsubmit = submitOrder;
  $("#product-detail-close").onclick = () => closeLayer("#product-modal-wrap");
  $("#product-detail-backdrop").onclick = () => closeLayer("#product-modal-wrap");
  $("#product-detail-add").onclick = () => { if (selectedProduct) addToCart(selectedProduct.id); closeLayer("#product-modal-wrap"); };
  $("#qa-form").onsubmit = submitQuestion;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    ["#cart-wrap", "#checkout-wrap", "#product-modal-wrap"].forEach((selector) => {
      if (!$(selector).classList.contains("hidden")) closeLayer(selector);
    });
  });
}

window.addEventListener("error", (event) => console.error("[77waxing shop]", event.error || event.message));
window.addEventListener("unhandledrejection", (event) => console.error("[77waxing shop promise]", event.reason));
bindUI();
saveCart();
await Promise.all([loadSettings(), loadProducts()]).catch((error) => {
  console.error(error);
  toast("商品資料暫時無法載入，請稍後重新整理。", "error");
});
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  $("#connection-state").textContent = user ? "購物資料已安全連線" : "正在建立安全連線…";
  if (user) { watchOrders(user); watchMessages(user); }
});
ensureAuth().catch((error) => {
  console.error(error);
  toast("目前無法建立購物連線，請重新整理頁面。", "error");
});
