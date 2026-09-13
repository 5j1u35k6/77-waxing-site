import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig } from "../assets/firebase-config.js?v=20260913-shop2";

const app = initializeApp(firebaseConfig, "77waxing-shop-admin");
const auth = getAuth(app);
const db = getFirestore(app);
const DEFAULT_EMAIL_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
const DEFAULT_SETTINGS = {
  storeName: "77waxing",
  storeEmail: "77waxing.mail@gmail.com",
  heroEyebrow: "77WAXING SELECT",
  heroTitle: "把日常保養需要的，簡單整理給你。",
  heroDescription: "產品內容會由 77waxing 後台持續更新；價格、庫存與交付方式以訂單確認內容為準。",
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
const STATUS = { pending: "待確認", confirmed: "已確認", packing: "備貨中", ready: "待自取", shipped: "已出貨", completed: "已完成", cancelled: "已取消" };

let currentUser = null;
let products = [];
let orders = [];
let messages = [];
let settings = { ...DEFAULT_SETTINGS };
let currentView = "dashboard";
let editingProductId = null;
let listeners = [];
let filteredOrderCache = [];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (value) => `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
const bool = (selector) => Boolean($(selector)?.checked);
const num = (selector, fallback = 0) => Number($(selector)?.value || fallback);

function timestampMillis(value) {
  const firebaseMillis = value?.toMillis?.();
  if (Number.isFinite(firebaseMillis)) return firebaseMillis;
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatDate(value) {
  const date = value?.toDate?.();
  return date ? date.toLocaleString("zh-TW") : "—";
}
function dateOnly(value) {
  const date = value?.toDate?.();
  return date ? date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) : "";
}
function flash(message, type = "ok") {
  const el = $("#admin-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = type === "error" ? "#a64b43" : "#55745b";
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { el.textContent = ""; }, 3600);
}
function cleanupListeners() {
  listeners.forEach((unsubscribe) => unsubscribe?.());
  listeners = [];
}
async function isAdmin(user) {
  if (!user || user.isAnonymous) return false;
  const snap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
  return Boolean(snap?.exists());
}
async function audit(action, targetId = "", detail = "") {
  if (!currentUser) return;
  addDoc(collection(db, "shopAuditLogs"), {
    adminUid: currentUser.uid,
    adminEmail: currentUser.email || null,
    action,
    targetId,
    detail: String(detail || "").slice(0, 1000),
    createdAt: serverTimestamp(),
  }).catch(console.warn);
}
async function dispatchShopEmail(orderId) {
  try {
    if (!currentUser || !orderId) return;
    const idToken = await currentUser.getIdToken();
    const url = String(settings.appsScriptEmailUrl || DEFAULT_EMAIL_URL).trim() || DEFAULT_EMAIL_URL;
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kind: "shop_order", orderId, idToken }),
    });
  } catch (error) {
    console.warn("shop admin email dispatch failed", error);
  }
}

function loginMarkup() {
  return `<main class="admin-login"><section class="admin-login-card"><span class="eyebrow">SHOP ADMIN</span><h1>77waxing 產品訂購後台</h1><form id="login-form"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><div class="field" style="margin-top:12px"><label>密碼</label><input name="password" type="password" autocomplete="current-password" required></div><button class="primary-btn" style="width:100%;margin-top:18px" type="submit">登入</button><div id="login-message" class="login-message"></div></form><p class="order-date">只有 Firestore <code>admins/{uid}</code> 中的管理員帳號可以進入。</p></section></main>`;
}
function shellMarkup() {
  return `<div class="admin-shell"><aside class="admin-side"><a class="shop-brand" href="./" target="_blank" rel="noopener"><b>77</b>waxing<small>SHOP ADMIN</small></a><nav class="admin-nav"><button data-view="dashboard">總覽</button><button data-view="products">商品</button><button data-view="orders">訂單</button><button data-view="messages">顧客問答</button><button data-view="settings">商店設定</button></nav></aside><main class="admin-main"><div class="admin-top"><div><span class="eyebrow">PRODUCT ORDER</span><h1 id="admin-title">產品訂購後台</h1></div><div style="text-align:right"><div class="live-dot">● Firebase 即時同步</div><button id="logout" class="mini-btn" type="button">登出</button></div></div><div id="admin-message" class="admin-message"></div><section id="admin-view"></section></main></div>`;
}
async function renderLogin() {
  cleanupListeners();
  $("#admin-app").innerHTML = loginMarkup();
  $("#login-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    $("#login-message").textContent = "登入中…";
    try {
      const credential = await signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.password.value);
      if (!(await isAdmin(credential.user))) {
        await signOut(auth);
        throw new Error("NOT_ADMIN");
      }
    } catch (error) {
      console.error(error);
      $("#login-message").textContent = "登入失敗，或此帳號沒有 Shop 管理權限。";
      button.disabled = false;
    }
  };
}
function mountAdmin() {
  cleanupListeners();
  $("#admin-app").innerHTML = shellMarkup();
  $$("[data-view]").forEach((button) => { button.onclick = () => showView(button.dataset.view); });
  $("#logout").onclick = () => signOut(auth);
  subscribeData();
  showView(currentView);
}
function showView(view) {
  currentView = view;
  $$("[data-view]").forEach((button) => button.classList.toggle("on", button.dataset.view === view));
  const titles = { dashboard: "營運總覽", products: "商品管理", orders: "訂單管理", messages: "顧客問答", settings: "商店設定" };
  $("#admin-title").textContent = titles[view] || "產品訂購後台";
  if (view === "dashboard") renderDashboard();
  else if (view === "products") renderProducts();
  else if (view === "orders") renderOrders();
  else if (view === "messages") renderMessages();
  else if (view === "settings") renderSettings();
}
function rerender() {
  if (!$("#admin-view")) return;
  showView(currentView);
}
function subscribeData() {
  listeners.push(onSnapshot(collection(db, "shopProducts"), (snap) => {
    products = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    if (currentView !== "settings") rerender();
  }));
  listeners.push(onSnapshot(collection(db, "shopOrders"), (snap) => {
    orders = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    if (currentView !== "settings") rerender();
  }));
  listeners.push(onSnapshot(collection(db, "shopMessages"), (snap) => {
    messages = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    if (currentView !== "settings") rerender();
  }));
  listeners.push(onSnapshot(doc(db, "shopSettings", "public"), (snap) => {
    settings = snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : { ...DEFAULT_SETTINGS };
    if (currentView === "settings") renderSettings();
  }));
}

function renderDashboard() {
  const completed = orders.filter((row) => row.status === "completed");
  const revenue = completed.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const pending = orders.filter((row) => row.status === "pending").length;
  const cancelled = orders.filter((row) => row.status === "cancelled").length;
  const lowStock = products.filter((row) => row.active && Number(row.stock || 0) <= 3).length;
  $("#admin-view").innerHTML = `<div class="metric-grid"><div class="metric"><small>待確認訂單</small><b>${pending}</b></div><div class="metric"><small>已完成營收</small><b>${money(revenue)}</b></div><div class="metric"><small>取消訂單</small><b>${cancelled}</b></div><div class="metric"><small>低庫存商品 ≤ 3</small><b>${lowStock}</b></div></div><div class="panel"><h2 style="margin-top:0">目前營運狀態</h2><p>商品 ${products.filter((p) => p.active).length} 個上架／${products.length} 個總計；訂單 ${orders.length} 筆；待回覆問題 ${messages.filter((m) => m.status !== "replied").length} 筆。</p><p class="order-date">庫存在管理員確認訂單時才以 Firestore transaction 原子扣減；取消已確認訂單時自動回補。</p></div>`;
}

function productForm(product = {}) {
  return `<form id="product-form" class="panel" style="margin-bottom:18px"><div class="admin-section-head"><div><h2>${product.id ? "編輯商品" : "新增商品"}</h2><p class="order-date">圖片使用公開 HTTPS URL，不把 Base64 圖片塞進 Firestore。</p></div>${product.id ? `<button id="cancel-product-edit" class="mini-btn" type="button">取消編輯</button>` : ""}</div><div class="settings-grid"><div class="field"><label>商品名稱</label><input id="p-name" value="${esc(product.name || "")}" maxlength="120" required></div><div class="field"><label>分類</label><input id="p-category" value="${esc(product.category || "")}" maxlength="80" required></div><div class="field"><label>價格 NT$</label><input id="p-price" type="number" min="0" step="1" value="${Number(product.price || 0)}" required></div><div class="field"><label>庫存</label><input id="p-stock" type="number" min="0" step="1" value="${Number(product.stock || 0)}" required></div><div class="field"><label>排序</label><input id="p-sort" type="number" step="1" value="${Number(product.sortOrder || 0)}"></div><div class="field"><label>圖片 URL</label><input id="p-image" type="url" value="${esc(product.imageUrl || "")}" placeholder="https://..."></div><div class="field wide"><label>商品說明</label><textarea id="p-description" rows="3" maxlength="1200">${esc(product.description || "")}</textarea></div><div class="field wide"><label>規格／成分／使用提醒</label><textarea id="p-spec" rows="3" maxlength="1500">${esc(product.spec || "")}</textarea></div><label class="check-line wide"><input id="p-active" type="checkbox" ${product.active !== false ? "checked" : ""}><span>上架顯示</span></label></div><button class="primary-btn" style="margin-top:16px" type="submit">${product.id ? "儲存商品" : "新增商品"}</button></form>`;
}
function renderProducts() {
  const editing = editingProductId ? products.find((row) => row.id === editingProductId) : null;
  $("#admin-view").innerHTML = `${productForm(editing || {})}<div class="table-wrap"><table class="admin-table"><thead><tr><th>商品</th><th>分類</th><th>價格</th><th>庫存</th><th>排序</th><th>狀態</th><th>操作</th></tr></thead><tbody>${products.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.category || "—")}</td><td>${money(p.price)}</td><td>${Number(p.stock || 0)}</td><td>${Number(p.sortOrder || 0)}</td><td>${p.active ? "上架" : "下架"}</td><td><div class="admin-actions"><button class="mini-btn" data-edit="${p.id}">編輯</button><button class="mini-btn" data-toggle="${p.id}">${p.active ? "下架" : "上架"}</button><button class="mini-btn" data-delete="${p.id}">永久刪除</button></div></td></tr>`).join("") || `<tr><td colspan="7">尚無商品。</td></tr>`}</tbody></table></div>`;
  $("#product-form").onsubmit = saveProduct;
  if ($("#cancel-product-edit")) $("#cancel-product-edit").onclick = () => { editingProductId = null; renderProducts(); };
  $$("[data-edit]").forEach((button) => { button.onclick = () => { editingProductId = button.dataset.edit; renderProducts(); window.scrollTo(0, 0); }; });
  $$("[data-toggle]").forEach((button) => { button.onclick = async () => {
    const product = products.find((row) => row.id === button.dataset.toggle);
    if (!product) return;
    await updateDoc(doc(db, "shopProducts", product.id), { active: !product.active, updatedAt: serverTimestamp() });
    await audit("product_toggle", product.id, String(!product.active));
  }; });
  $$("[data-delete]").forEach((button) => { button.onclick = async () => {
    const product = products.find((row) => row.id === button.dataset.delete);
    if (!product || !confirm(`確定永久刪除「${product.name}」？既有訂單仍保留商品快照。`)) return;
    await deleteDoc(doc(db, "shopProducts", product.id));
    await audit("product_delete", product.id, product.name);
    if (editingProductId === product.id) editingProductId = null;
  }; });
}
async function saveProduct(event) {
  event.preventDefault();
  const data = {
    name: $("#p-name").value.trim(),
    category: $("#p-category").value.trim(),
    price: Math.max(0, Math.round(num("#p-price"))),
    stock: Math.max(0, Math.round(num("#p-stock"))),
    sortOrder: Math.round(num("#p-sort")),
    imageUrl: $("#p-image").value.trim(),
    description: $("#p-description").value.trim(),
    spec: $("#p-spec").value.trim(),
    active: bool("#p-active"),
    updatedAt: serverTimestamp(),
  };
  if (!data.name || !data.category) return flash("請填寫商品名稱與分類。", "error");
  if (editingProductId) {
    await updateDoc(doc(db, "shopProducts", editingProductId), data);
    await audit("product_update", editingProductId, data.name);
    flash("商品已更新。");
  } else {
    const ref = await addDoc(collection(db, "shopProducts"), { ...data, createdAt: serverTimestamp() });
    await audit("product_create", ref.id, data.name);
    flash("商品已新增。");
  }
  editingProductId = null;
}

function renderOrders() {
  $("#admin-view").innerHTML = `<div class="admin-filters"><div class="field"><label>狀態</label><select id="order-status"><option value="">全部</option>${Object.entries(STATUS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div><div class="field"><label>開始日期</label><input id="order-from" type="date"></div><div class="field"><label>結束日期</label><input id="order-to" type="date"></div><button id="apply-order-filter" class="secondary-btn" type="button">套用</button><button id="export-orders" class="mini-btn" type="button">匯出 CSV</button></div><div id="orders-table"></div>`;
  $("#apply-order-filter").onclick = renderOrderTable;
  $("#export-orders").onclick = exportOrders;
  renderOrderTable();
}
function filteredOrders() {
  const status = $("#order-status")?.value || "";
  const from = $("#order-from")?.value || "";
  const to = $("#order-to")?.value || "";
  return orders.filter((row) => (!status || row.status === status) && (!from || dateOnly(row.createdAt) >= from) && (!to || dateOnly(row.createdAt) <= to));
}
function orderActions(order) {
  const rows = [];
  if (order.status === "pending") rows.push(["confirm", "確認訂單"]);
  if (order.status === "confirmed") rows.push(["packing", "開始備貨"]);
  if (order.status === "packing") rows.push([order.deliveryMethod === "pickup" ? "ready" : "ship", order.deliveryMethod === "pickup" ? "待自取" : "出貨"]);
  if (["ready", "shipped"].includes(order.status)) rows.push(["complete", "完成"]);
  if (!["completed", "cancelled"].includes(order.status)) rows.push(["cancel", "取消"]);
  return `<div class="admin-actions">${rows.map(([action, label]) => `<button class="mini-btn" data-order="${order.id}" data-action="${action}">${label}</button>`).join("")}</div>`;
}
function renderOrderTable() {
  filteredOrderCache = filteredOrders();
  $("#orders-table").innerHTML = `<div class="table-wrap"><table class="admin-table"><thead><tr><th>訂單</th><th>顧客</th><th>內容</th><th>金額</th><th>交付</th><th>狀態</th><th>操作</th></tr></thead><tbody>${filteredOrderCache.map((o) => `<tr><td><b>${esc(o.orderNo || o.id)}</b><div class="order-date">${formatDate(o.createdAt)}</div></td><td>${esc(o.customerName || "—")}<div>${esc(o.phone || "")}</div><div>${esc(o.email || "")}</div></td><td>${(o.items || []).map((i) => `${esc(i.name)} × ${Number(i.quantity || 0)}`).join("<br>")}</td><td>${money(o.total)}</td><td>${esc(o.deliveryMethod || "—")}${o.storeInfo ? `<br>${esc(o.storeInfo)}` : ""}${o.trackingNumber ? `<br>物流：${esc(o.trackingNumber)}` : ""}</td><td><span class="status ${o.status === "cancelled" ? "cancelled" : o.status === "pending" ? "pending" : ""}">${esc(STATUS[o.status] || o.status || "—")}</span></td><td>${orderActions(o)}</td></tr>`).join("") || `<tr><td colspan="7">沒有符合條件的訂單。</td></tr>`}</tbody></table></div>`;
  $$("[data-order][data-action]").forEach((button) => { button.onclick = () => handleOrderAction(button.dataset.order, button.dataset.action); });
}
async function handleOrderAction(orderId, action) {
  try {
    if (action === "confirm") await confirmOrder(orderId);
    else if (action === "cancel") await cancelOrder(orderId);
    else if (action === "ship") {
      const tracking = prompt("請輸入物流編號（可留空稍後補）：") || "";
      await updateDoc(doc(db, "shopOrders", orderId), { status: "shipped", trackingNumber: tracking.trim() || null, updatedAt: serverTimestamp() });
    } else {
      const status = action === "packing" ? "packing" : action === "ready" ? "ready" : action === "complete" ? "completed" : "";
      if (!status) return;
      await updateDoc(doc(db, "shopOrders", orderId), { status, updatedAt: serverTimestamp() });
    }
    await audit(`order_${action}`, orderId);
    await dispatchShopEmail(orderId);
    flash("訂單狀態已更新。");
  } catch (error) {
    console.error(error);
    flash(error?.message || "更新訂單失敗。", "error");
  }
}
async function confirmOrder(orderId) {
  const orderRef = doc(db, "shopOrders", orderId);
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("找不到訂單。");
    const order = orderSnap.data();
    if (order.status !== "pending") throw new Error("只有待確認訂單可以確認。");
    const items = Array.isArray(order.items) ? order.items : [];
    const refs = items.map((item) => doc(db, "shopProducts", item.productId));
    const snaps = [];
    for (const ref of refs) snaps.push(await tx.get(ref));
    let subtotal = 0;
    const finalItems = items.map((item, index) => {
      const productSnap = snaps[index];
      if (!productSnap.exists()) throw new Error(`商品「${item.name || item.productId}」不存在。`);
      const product = productSnap.data();
      const quantity = Math.max(1, Math.round(Number(item.quantity || 0)));
      const stock = Math.max(0, Math.round(Number(product.stock || 0)));
      if (!product.active) throw new Error(`商品「${product.name}」目前已下架。`);
      if (stock < quantity) throw new Error(`商品「${product.name}」庫存不足，目前 ${stock} 件。`);
      const unitPrice = Math.max(0, Math.round(Number(product.price || 0)));
      subtotal += unitPrice * quantity;
      return { productId: productSnap.id, name: product.name, quantity, unitPrice, imageUrl: product.imageUrl || "" };
    });
    snaps.forEach((snap, index) => {
      tx.update(refs[index], { stock: Number(snap.data().stock || 0) - finalItems[index].quantity, updatedAt: serverTimestamp() });
    });
    const shippingFee = Math.max(0, Math.round(Number(order.shippingFee || 0)));
    tx.update(orderRef, { items: finalItems, subtotal, total: subtotal + shippingFee, status: "confirmed", inventoryCommitted: true, updatedAt: serverTimestamp() });
  });
}
async function cancelOrder(orderId) {
  const orderRef = doc(db, "shopOrders", orderId);
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("找不到訂單。");
    const order = orderSnap.data();
    if (["completed", "cancelled"].includes(order.status)) throw new Error("此訂單目前不可取消。");
    const items = Array.isArray(order.items) ? order.items : [];
    const refs = order.inventoryCommitted ? items.map((item) => doc(db, "shopProducts", item.productId)) : [];
    const snaps = [];
    for (const ref of refs) snaps.push(await tx.get(ref));
    snaps.forEach((snap, index) => {
      if (!snap.exists()) return;
      tx.update(refs[index], { stock: Number(snap.data().stock || 0) + Number(items[index].quantity || 0), updatedAt: serverTimestamp() });
    });
    tx.update(orderRef, { status: "cancelled", inventoryCommitted: false, updatedAt: serverTimestamp() });
  });
}
function exportOrders() {
  const rows = filteredOrderCache.length ? filteredOrderCache : orders;
  const data = [["訂單編號", "日期", "姓名", "電話", "Email", "狀態", "交付", "門市", "金額", "品項"], ...rows.map((o) => [o.orderNo || o.id, formatDate(o.createdAt), o.customerName || "", o.phone || "", o.email || "", STATUS[o.status] || o.status || "", o.deliveryMethod || "", o.storeInfo || "", Number(o.total || 0), (o.items || []).map((i) => `${i.name}x${i.quantity}`).join(" | ")])];
  const csv = data.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `77waxing-shop-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderMessages() {
  $("#admin-view").innerHTML = `<div class="table-wrap"><table class="admin-table"><thead><tr><th>時間</th><th>顧客</th><th>問題</th><th>回覆</th><th>操作</th></tr></thead><tbody>${messages.map((m) => `<tr><td>${formatDate(m.createdAt)}</td><td>${esc(m.name || "—")}<div>${esc(m.email || "")}</div></td><td>${esc(m.content || "")}</td><td>${m.reply ? esc(m.reply) : "—"}</td><td><button class="mini-btn" data-reply="${m.id}">${m.reply ? "修改回覆" : "回覆"}</button></td></tr>`).join("") || `<tr><td colspan="5">目前沒有問題。</td></tr>`}</tbody></table></div>`;
  $$("[data-reply]").forEach((button) => { button.onclick = async () => {
    const message = messages.find((row) => row.id === button.dataset.reply);
    if (!message) return;
    const reply = prompt("輸入 77waxing 回覆：", message.reply || "");
    if (reply === null) return;
    await updateDoc(doc(db, "shopMessages", message.id), { reply: reply.trim() || null, status: reply.trim() ? "replied" : "pending", updatedAt: serverTimestamp() });
    await audit("message_reply", message.id);
    flash("回覆已儲存。");
  }; });
}

function renderSettings() {
  $("#admin-view").innerHTML = `<form id="settings-form" class="panel"><div class="settings-grid"><div class="field"><label>商店名稱</label><input id="s-store" value="${esc(settings.storeName)}"></div><div class="field"><label>通知 Email</label><input id="s-email" type="email" value="${esc(settings.storeEmail)}"></div><div class="field"><label>Hero 小標</label><input id="s-eyebrow" value="${esc(settings.heroEyebrow)}"></div><div class="field"><label>Hero 主標</label><input id="s-title" value="${esc(settings.heroTitle)}"></div><div class="field wide"><label>Hero 說明</label><textarea id="s-description" rows="3">${esc(settings.heroDescription)}</textarea></div><label class="check-line"><input id="s-pickup" type="checkbox" ${settings.enablePickup ? "checked" : ""}><span>工作室自取</span></label><label class="check-line"><input id="s-cash" type="checkbox" ${settings.enableCashPickup ? "checked" : ""}><span>自取付款</span></label><label class="check-line"><input id="s-711" type="checkbox" ${settings.enable711 ? "checked" : ""}><span>7-11 店到店</span></label><div class="field"><label>7-11 運費</label><input id="s-fee711" type="number" min="0" value="${Number(settings.shippingFee711 || 0)}"></div><label class="check-line"><input id="s-family" type="checkbox" ${settings.enableFamily ? "checked" : ""}><span>全家店到店</span></label><div class="field"><label>全家運費</label><input id="s-feefamily" type="number" min="0" value="${Number(settings.shippingFeeFamily || 0)}"></div><label class="check-line"><input id="s-transfer" type="checkbox" ${settings.enableTransfer ? "checked" : ""}><span>銀行轉帳</span></label><div></div><div class="field wide"><label>自取說明</label><textarea id="s-pickup-note" rows="2">${esc(settings.pickupNote)}</textarea></div><div class="field wide"><label>轉帳說明</label><textarea id="s-transfer-note" rows="2">${esc(settings.transferNote)}</textarea></div><div class="field wide"><label>Apps Script Email URL</label><input id="s-email-url" type="url" value="${esc(settings.appsScriptEmailUrl || DEFAULT_EMAIL_URL)}"></div></div><button class="primary-btn" style="margin-top:18px" type="submit">儲存商店設定</button></form>`;
  $("#settings-form").onsubmit = saveSettings;
}
async function saveSettings(event) {
  event.preventDefault();
  const data = {
    storeName: $("#s-store").value.trim() || "77waxing",
    storeEmail: $("#s-email").value.trim() || "77waxing.mail@gmail.com",
    heroEyebrow: $("#s-eyebrow").value.trim(),
    heroTitle: $("#s-title").value.trim(),
    heroDescription: $("#s-description").value.trim(),
    enablePickup: bool("#s-pickup"),
    enableCashPickup: bool("#s-cash"),
    enable711: bool("#s-711"),
    shippingFee711: Math.max(0, Math.round(num("#s-fee711"))),
    enableFamily: bool("#s-family"),
    shippingFeeFamily: Math.max(0, Math.round(num("#s-feefamily"))),
    enableTransfer: bool("#s-transfer"),
    pickupNote: $("#s-pickup-note").value.trim(),
    transferNote: $("#s-transfer-note").value.trim(),
    appsScriptEmailUrl: $("#s-email-url").value.trim() || DEFAULT_EMAIL_URL,
    updatedAt: serverTimestamp(),
  };
  if (!data.enablePickup && !data.enable711 && !data.enableFamily) return flash("至少啟用一種交付方式。", "error");
  if (!data.enableCashPickup && !data.enableTransfer) return flash("至少啟用一種付款方式。", "error");
  await setDoc(doc(db, "shopSettings", "public"), data, { merge: true });
  await audit("settings_update", "public");
  flash("商店設定已儲存。");
}

await setPersistence(auth, browserLocalPersistence).catch(() => {});
onAuthStateChanged(auth, async (user) => {
  cleanupListeners();
  if (user && await isAdmin(user)) {
    currentUser = user;
    mountAdmin();
  } else {
    currentUser = null;
    if (user) await signOut(auth).catch(() => {});
    renderLogin();
  }
});
window.addEventListener("error", (event) => console.error("[77waxing shop admin]", event.error || event.message));
window.addEventListener("unhandledrejection", (event) => console.error("[77waxing shop admin promise]", event.reason));
