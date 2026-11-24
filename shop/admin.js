import { operationErrorText } from "../assets/interface-copy.js?v=20261026-audit1";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig } from "../assets/firebase-config.js?v=20261026-audit1";
import { allProducts, catalogCategories, catalogCategory, categoryFromCollectionKey, filterProducts, seriesSlogan } from "./series.js?v=20261124-series1";

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
const STOREFRONT_URL = "https://5j1u35k6.github.io/77select/";
const MAX_ADD_ON_PRODUCTS = 8;
const MAX_SERIES_DESCRIPTION_LENGTH = 600;
const SERIES_COVERS = [
  ["black-bottle", "./select-series-repair.jpg"],
  ["25-plus", "./select-series-25-plus.jpg"],
  ["body-polish", "./select-series-body.jpg"],
  ["five-minutes", ""],
].map(([key, image]) => [key, categoryFromCollectionKey(key), image]);

let currentUser = null;
let products = [];
let orders = [];
let messages = [];
let settings = { ...DEFAULT_SETTINGS };
let settingsReady = false;
let currentView = "dashboard";
let editingProductId = null;
let addingProduct = false;
let activeProductCategory = allProducts;
let productVisibility = "all";
let listeners = [];
let filteredOrderCache = [];
let authVersion = 0;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (value) => `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
const bool = (selector) => Boolean($(selector)?.checked);
const num = (selector, fallback = 0) => Number($(selector)?.value || fallback);

function publicImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function publicProductUrl(id) {
  const url = new URL(STOREFRONT_URL);
  url.searchParams.set("product", id);
  return url.href;
}

function productStock(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const stock = (value) => Math.max(0, Math.round(Number(value) || 0));
  return variants.length
    ? variants.reduce((total, variant) => total + stock(variant?.stock), 0)
    : stock(product.stock);
}

function productPriceRange(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const prices = variants.map((variant) => Number(variant?.priceTWD ?? variant?.priceTW ?? variant?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  if (!prices.length) return money(product.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money(min) : `${money(min)}–${money(max)}`;
}

function addOnProductLabel(product) {
  if (!product) return "已移除商品";
  if (!product.active) return `${product.name}（已下架）`;
  if (!productStock(product)) return `${product.name}（目前售完）`;
  return product.name;
}

function productCardImage(product) {
  const gallery = (Array.isArray(product.media) ? product.media : []).map((row, index) => ({
    url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
    variant: Boolean(row?.variantId),
    order: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
  })).filter(({ url }) => url).sort((a, b) => Number(a.variant) - Number(b.variant) || a.order - b.order);
  return gallery[0]?.url || product.imageUrl || "";
}

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
  if (type === "error") message = operationErrorText(message, "目前無法儲存變更，請確認管理員登入狀態與網路後再試。");
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
  return `<main class="admin-login"><section class="admin-login-card"><span class="eyebrow">SHOP ADMIN</span><h1>77waxing 產品訂購後台</h1><form id="login-form"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><div class="field" style="margin-top:12px"><label>密碼</label><input name="password" type="password" autocomplete="current-password" required></div><button class="primary-btn" style="width:100%;margin-top:18px" type="submit">登入</button><div id="login-message" class="login-message"></div></form><p class="order-date">請使用商店管理員帳號登入。</p></section></main>`;
}
function shellMarkup() {
  return `<div class="admin-shell"><aside class="admin-side"><a class="shop-brand" href="${STOREFRONT_URL}" target="_blank" rel="noopener"><b>77</b>select<small>SHOP ADMIN</small></a><nav class="admin-nav"><button data-view="dashboard">總覽</button><button data-view="homepage">首頁</button><button data-view="products">商品</button><button data-view="orders">訂單</button><button data-view="messages">顧客問答</button><button data-view="settings">商店設定</button></nav></aside><main class="admin-main"><div class="admin-top"><div><span class="eyebrow">PRODUCT ORDER</span><h1 id="admin-title">產品訂購後台</h1></div><div style="text-align:right"><div class="live-dot">● 即時同步</div><button id="logout" class="mini-btn" type="button">登出</button></div></div><div id="admin-message" class="admin-message" role="status"></div><section id="admin-view"></section></main></div>`;
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
      $("#login-message").textContent = "登入失敗，或此帳號沒有商店管理權限。";
      button.disabled = false;
    }
  };
}
function mountAdmin() {
  cleanupListeners();
  activeProductCategory = allProducts;
  productVisibility = "all";
  $("#admin-app").innerHTML = shellMarkup();
  $$("[data-view]").forEach((button) => { button.onclick = () => showView(button.dataset.view); });
  $("#logout").onclick = () => signOut(auth);
  subscribeData();
  showView(currentView);
}
function showView(view) {
  if (view !== "products") {
    editingProductId = null;
    addingProduct = false;
  }
  currentView = view;
  $$("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("on", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const titles = { dashboard: "營運總覽", homepage: "首頁編輯", products: "商品管理", orders: "訂單管理", messages: "顧客問答", settings: "商店設定" };
  $("#admin-title").textContent = titles[view] || "產品訂購後台";
  if (view === "dashboard") renderDashboard();
  else if (view === "homepage") renderHomepage();
  else if (view === "products") renderProducts();
  else if (view === "orders") renderOrders();
  else if (view === "messages") renderMessages();
  else if (view === "settings") renderSettings();
}
let renderQueued = false;
function scheduleRerender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; rerender(); });
}
function rerender() {
  if (!$("#admin-view")) return;
  if ($("#promotion-form") || $("#product-form") || $("#homepage-form")?.dataset.dirty === "1") return;
  showView(currentView);
}
function subscribeData() {
  const version = authVersion;
  listeners.push(onSnapshot(collection(db, "shopProducts"), (snap) => {
    if (version !== authVersion) return;
    products = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    if (currentView !== "settings") scheduleRerender();
  }));
  listeners.push(onSnapshot(collection(db, "shopOrders"), (snap) => {
    if (version !== authVersion) return;
    orders = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    if (currentView === "orders" || currentView === "dashboard") scheduleRerender();
  }));
  listeners.push(onSnapshot(collection(db, "shopMessages"), (snap) => {
    if (version !== authVersion) return;
    messages = snap.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    if (currentView === "messages" || currentView === "dashboard") scheduleRerender();
  }));
  listeners.push(onSnapshot(doc(db, "shopSettings", "public"), (snap) => {
    if (version !== authVersion) return;
    settings = snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : { ...DEFAULT_SETTINGS };
    settingsReady = true;
    if (currentView === "homepage" && $("#homepage-form")?.dataset.dirty !== "1") renderHomepage();
    if (currentView === "settings" && $("#settings-form")?.dataset.dirty !== "1") renderSettings();
  }));
}

function renderDashboard() {
  const completed = orders.filter((row) => row.status === "completed");
  const revenue = completed.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const pending = orders.filter((row) => row.status === "pending").length;
  const cancelled = orders.filter((row) => row.status === "cancelled").length;
  const lowStock = products.filter((row) => row.active && Number(row.stock || 0) <= 3).length;
  $("#admin-view").innerHTML = `<div class="metric-grid"><div class="metric"><small>待確認訂單</small><b>${pending}</b></div><div class="metric"><small>已完成營收</small><b>${money(revenue)}</b></div><div class="metric"><small>取消訂單</small><b>${cancelled}</b></div><div class="metric"><small>低庫存商品 ≤ 3</small><b>${lowStock}</b></div></div><div class="panel"><h2 style="margin-top:0">目前營運狀態</h2><p>商品 ${products.filter((p) => p.active).length} 個上架／${products.length} 個總計；訂單 ${orders.length} 筆；待回覆問題 ${messages.filter((m) => m.status !== "replied").length} 筆。</p><p class="order-date">確認訂單後會扣除庫存；取消已確認的訂單時會自動加回。</p></div>`;
}

function productForm(product = {}) {
  const storedCategory = product.category || "";
  const displayCategory = storedCategory ? catalogCategory(storedCategory) : "";
  return `<form id="product-form" class="panel admin-product-form" data-product-id="${esc(product.id || "")}">
    <div class="admin-section-head">
      <div>
        <h2>${product.id ? "編輯商品" : "新增商品"}</h2>
        <p class="order-date">依商品頁順序編輯圖片、購買資訊和商品說明。</p>
      </div>
      <div class="admin-editor-actions">
        ${product.id && product.active ? `<a class="mini-btn admin-editor-link" href="${esc(publicProductUrl(product.id))}" target="_blank" rel="noopener">開啟商品頁</a>` : ""}
        <button id="cancel-product-edit" class="mini-btn" type="button">返回商品清單</button>
      </div>
    </div>
    <div class="admin-product-layout">
      <section class="admin-editor-section admin-product-gallery" aria-labelledby="product-gallery-title">
        <h3 id="product-gallery-title">商品圖片</h3>
        <div class="field">
          <label for="p-image">主圖網址</label>
          <input id="p-image" type="url" value="${esc(product.imageUrl || "")}" placeholder="https://...">
        </div>
      </section>
      <section class="admin-editor-section admin-product-purchase" aria-labelledby="product-purchase-title">
        <h3 id="product-purchase-title">購買資訊</h3>
        <div class="field">
          <label for="p-category">商品系列</label>
          <input id="p-category" list="admin-product-series" value="${esc(displayCategory)}" data-stored-category="${esc(storedCategory)}" data-display-category="${esc(displayCategory)}" maxlength="80" required>
          <datalist id="admin-product-series">${SERIES_COVERS.map(([, label]) => `<option value="${esc(label)}"></option>`).join("")}</datalist>
        </div>
        <div class="field">
          <label for="p-name">商品名稱</label>
          <input id="p-name" value="${esc(product.name || "")}" maxlength="120" required>
        </div>
        <div class="field">
          <label for="p-slogan">商品標語</label>
          <input id="p-slogan" value="${esc(product.slogan || "")}" maxlength="160">
        </div>
        <div class="field">
          <label for="p-precautions">注意事項</label>
          <textarea id="p-precautions" rows="4" maxlength="2000">${esc(product.precautions || "")}</textarea>
        </div>
        <div class="field"><label for="p-price">價格 NT$</label><input id="p-price" type="number" min="0" step="1" value="${Number(product.price || 0)}" required></div>
        <div class="field"><label for="p-stock">庫存</label><input id="p-stock" type="number" min="0" step="1" value="${Number(product.stock || 0)}" required></div>
        <div data-product-variants></div>
        <section class="admin-product-add-ons" aria-labelledby="product-add-ons-title">
          <h4 id="product-add-ons-title">加購商品</h4>
          <p>顧客會依這裡的順序看到已上架且有庫存的加購商品。</p>
          <div id="p-add-on-list"></div>
          <div class="admin-add-on-picker">
            <div class="field">
              <label for="p-add-on-product">選擇商品</label>
              <select id="p-add-on-product"></select>
            </div>
            <button id="p-add-on-add" class="secondary-btn" type="button">加入加購商品</button>
          </div>
          <p class="order-date" id="p-add-on-count" aria-live="polite"></p>
        </section>
      </section>
    </div>
    <section class="admin-editor-section" aria-labelledby="product-description-title">
      <h3 id="product-description-title">商品介紹</h3>
      <div class="field">
        <label for="p-description">介紹內容</label>
        <textarea id="p-description" rows="4" maxlength="1200">${esc(product.description || "")}</textarea>
      </div>
    </section>
    <section class="admin-editor-section admin-product-spec" aria-labelledby="product-spec-title">
      <h3 id="product-spec-title">規格與使用說明</h3>
      <div class="field">
        <label for="p-spec">規格、成分及使用提醒</label>
        <textarea id="p-spec" rows="6" maxlength="1500">${esc(product.spec || "")}</textarea>
      </div>
    </section>
    <section class="admin-editor-section admin-product-status" aria-labelledby="product-status-title">
      <h3 id="product-status-title">上架與排序</h3>
      <div class="settings-grid">
        <label class="check-line"><input id="p-active" type="checkbox" ${product.active !== false ? "checked" : ""}><span>上架顯示</span></label>
        <div class="field"><label for="p-sort">商品目錄排序</label><input id="p-sort" type="number" step="1" value="${Number(product.sortOrder || 0)}"></div>
      </div>
    </section>
    <div class="admin-editor-actions"><button class="primary-btn" type="submit">${product.id ? "儲存商品" : "新增商品"}</button></div>
  </form>`;
}

function bindProductContent(form, product) {
  const existing = Array.isArray(product.addOnProductIds) ? product.addOnProductIds : [];
  let addOnIds = [...new Set(existing.filter((id) => typeof id === "string" && id && id !== product.id))]
    .slice(0, MAX_ADD_ON_PRODUCTS);
  const list = $("#p-add-on-list", form);
  const picker = $("#p-add-on-product", form);
  const add = $("#p-add-on-add", form);
  const count = $("#p-add-on-count", form);

  function renderAddOns() {
    list.innerHTML = addOnIds.length ? `<ol>${addOnIds.map((id) => {
      const item = products.find((row) => row.id === id);
      const label = esc(addOnProductLabel(item));
      return `<li><span>${label}</span><button type="button" class="mini-btn" data-remove-add-on="${esc(id)}" aria-label="移除 ${label}">移除</button></li>`;
    }).join("")}</ol>` : "";
    const candidates = products.filter((row) => row.id !== product.id && !addOnIds.includes(row.id));
    picker.innerHTML = `<option value="">請選擇商品</option>${candidates.map((row) =>
      `<option value="${esc(row.id)}">${esc(addOnProductLabel(row))}</option>`
    ).join("")}`;
    picker.disabled = addOnIds.length >= MAX_ADD_ON_PRODUCTS || !candidates.length;
    add.disabled = true;
    count.textContent = `已選 ${addOnIds.length} 件，最多 ${MAX_ADD_ON_PRODUCTS} 件。`;
  }

  picker.onchange = () => { add.disabled = !picker.value; };
  add.onclick = () => {
    if (!picker.value || picker.disabled || addOnIds.includes(picker.value)) return;
    addOnIds.push(picker.value);
    form.dataset.dirty = "1";
    renderAddOns();
    picker.focus();
  };
  list.onclick = (event) => {
    const button = event.target.closest?.("[data-remove-add-on]");
    if (!button) return;
    addOnIds = addOnIds.filter((id) => id !== button.dataset.removeAddOn);
    form.dataset.dirty = "1";
    renderAddOns();
    picker.focus();
  };
  renderAddOns();

  form.readProductContent = () => ({
    slogan: $("#p-slogan", form).value.trim(),
    precautions: $("#p-precautions", form).value.trim(),
    addOnProductIds: [...addOnIds],
  });
}

function adminProductCard(product) {
  const cover = productCardImage(product);
  const stock = productStock(product);
  const name = esc(product.name);
  const id = esc(product.id);
  return `<article class="admin-catalog-card">
    <div class="admin-catalog-media">
      ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : "<span>尚無商品圖片</span>"}
    </div>
    <div class="admin-catalog-content">
      <div class="admin-catalog-name">
        <h3>${name}</h3>
        <strong>${productPriceRange(product)}</strong>
      </div>
      <div class="admin-catalog-meta">
        <span>${esc(catalogCategory(product.category))}</span>
        <span>庫存 ${stock}</span>
        <span>排序 ${Number(product.sortOrder || 0)}</span>
      </div>
      <div class="admin-catalog-actions">
        <span class="status ${product.active ? "" : "pending"}">${product.active ? "已上架" : "已下架"}</span>
        <button class="primary-btn" type="button" data-edit="${id}" aria-label="編輯 ${name}">編輯</button>
        <button class="mini-btn" type="button" data-toggle="${id}" aria-label="${product.active ? "下架" : "上架"} ${name}">${product.active ? "下架" : "上架"}</button>
        <button class="mini-btn admin-catalog-delete" type="button" data-delete="${id}" aria-label="永久刪除 ${name}">永久刪除</button>
      </div>
    </div>
  </article>`;
}

function renderProducts() {
  const editing = editingProductId ? products.find((row) => row.id === editingProductId) : null;
  const view = $("#admin-view");
  if (editing || addingProduct) {
    const product = editing || { category: activeProductCategory === allProducts ? "" : activeProductCategory };
    view.innerHTML = productForm(product);
    const form = $("#product-form");
    form.productRecord = product;
    bindProductContent(form, product);
    form.onsubmit = saveProduct;
    $("#cancel-product-edit").onclick = () => {
      editingProductId = null;
      addingProduct = false;
      renderProducts();
      window.scrollTo(0, 0);
    };
    return;
  }

  const categories = catalogCategories(products);
  if (!categories.includes(activeProductCategory)) activeProductCategory = allProducts;
  const visibleProducts = filterProducts(products, activeProductCategory).filter((product) =>
    productVisibility === "all" || Boolean(product.active) === (productVisibility === "published")
  );
  const statusOptions = { all: "全部", published: "上架", unpublished: "下架" };
  view.innerHTML = `<section class="admin-catalog" aria-labelledby="admin-catalog-title">
    <div class="admin-section-head admin-catalog-head">
      <h2 id="admin-catalog-title">商品目錄</h2>
      <button id="new-product" class="primary-btn" type="button">新增商品</button>
    </div>
    <div class="admin-catalog-filters">
      <div class="filters" id="admin-category-filters" role="group" aria-label="商品系列">
        ${categories.map((category) => `<button type="button" class="filter-btn${category === activeProductCategory ? " on" : ""}" data-admin-category="${esc(category)}" aria-pressed="${category === activeProductCategory}">${esc(category)}</button>`).join("")}
      </div>
      <div class="field admin-catalog-visibility">
        <label for="admin-product-visibility">上架狀態</label>
        <select id="admin-product-visibility">${Object.entries(statusOptions).map(([key, label]) =>
          `<option value="${key}" ${productVisibility === key ? "selected" : ""}>${label}</option>`
        ).join("")}</select>
      </div>
    </div>
    <div class="admin-catalog-grid">
      ${visibleProducts.map(adminProductCard).join("") || '<p class="empty-state">沒有符合條件的商品。</p>'}
    </div>
  </section>`;
  $("#admin-category-filters").onclick = (event) => {
    const button = event.target.closest?.("[data-admin-category]");
    if (!button || button.dataset.adminCategory === activeProductCategory) return;
    activeProductCategory = button.dataset.adminCategory;
    renderProducts();
    $('#admin-category-filters [aria-pressed="true"]')?.focus();
  };
  $("#admin-product-visibility").onchange = (event) => {
    productVisibility = event.target.value;
    renderProducts();
    $("#admin-product-visibility")?.focus();
  };
  $("#new-product").onclick = () => {
    addingProduct = true;
    renderProducts();
    window.scrollTo(0, 0);
  };
  $$("[data-edit]").forEach((button) => { button.onclick = () => {
    editingProductId = button.dataset.edit;
    renderProducts();
    window.scrollTo(0, 0);
  }; });
  $$("[data-toggle]").forEach((button) => { button.onclick = async () => {
    const product = products.find((row) => row.id === button.dataset.toggle);
    if (!product) return;
    button.disabled = true;
    try {
      await updateDoc(doc(db, "shopProducts", product.id), { active: !product.active, updatedAt: serverTimestamp() });
      await audit("product_toggle", product.id, String(!product.active));
    } catch (error) {
      flash(error, "error");
    } finally {
      button.disabled = false;
    }
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
  const category = $("#p-category");
  const displayCategory = category.value.trim();
  const data = {
    name: $("#p-name").value.trim(),
    category: displayCategory === category.dataset.displayCategory ? category.dataset.storedCategory : displayCategory,
    price: Math.max(0, Math.round(num("#p-price"))),
    stock: Math.max(0, Math.round(num("#p-stock"))),
    sortOrder: Math.round(num("#p-sort")),
    imageUrl: $("#p-image").value.trim(),
    description: $("#p-description").value.trim(),
    spec: $("#p-spec").value.trim(),
    ...event.currentTarget.readProductContent(),
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
  addingProduct = false;
  renderProducts();
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
      const tracking = prompt("請輸入物流編號（可留空稍後補）：");
      if (tracking === null) return;
      await transitionOrder(orderId, "shipped", ["packing"], { trackingNumber: tracking.trim() || null });
    } else {
      const status = action === "packing" ? "packing" : action === "ready" ? "ready" : action === "complete" ? "completed" : "";
      if (!status) return;
      const allowed = action === "packing" ? ["confirmed"] : action === "ready" ? ["packing"] : ["ready", "shipped"];
      await transitionOrder(orderId, status, allowed);
    }
    await Promise.all([audit(`order_${action}`, orderId), dispatchShopEmail(orderId)]);
    flash("訂單狀態已更新。");
  } catch (error) {
    console.error(error);
    flash(error?.message || "更新訂單失敗。", "error");
  }
}
async function transitionOrder(orderId, status, allowed, extra = {}) {
  const ref = doc(db, "shopOrders", orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("找不到訂單。");
    if (!allowed.includes(snap.data().status)) throw new Error("訂單狀態已變更，請檢視最新狀態後再操作。");
    tx.update(ref, { ...extra, status, updatedAt: serverTimestamp() });
  });
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
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
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
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    snaps.forEach((snap, index) => {
      if (!snap.exists()) return;
      tx.update(refs[index], { stock: Number(snap.data().stock || 0) + Number(items[index].quantity || 0), updatedAt: serverTimestamp() });
    });
    tx.update(orderRef, { status: "cancelled", inventoryCommitted: false, updatedAt: serverTimestamp() });
  });
}
function exportOrders() {
  const rows = filteredOrderCache;
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

function homepageImageField(id, label, value, defaultImage = "", disclosure = "") {
  const preview = publicImageUrl(value) || defaultImage;
  const input = `<label for="${esc(id)}">${esc(label)}</label>
    <input id="${esc(id)}" ${disclosure ? 'type="text" inputmode="url"' : 'type="url"'} value="${esc(value || "")}" maxlength="2000" placeholder="https://…">`;
  return `<div class="field admin-home-image">
    <div class="admin-home-image-preview">
      <img data-preview-image="${esc(id)}" data-default-image="${esc(defaultImage)}" ${preview ? `src="${esc(preview)}"` : "hidden"} alt="${esc(label)}">
      <span ${preview ? "hidden" : ""}>尚無圖片</span>
    </div>
    ${disclosure ? `<details class="admin-series-cover-settings">
      <summary>${esc(disclosure)}</summary>
      <div class="field">${input}</div>
    </details>` : input}
  </div>`;
}

function renderHomepage() {
  const view = $("#admin-view");
  if (!settingsReady) {
    view.innerHTML = '<p class="panel" role="status">正在載入首頁內容…</p>';
    return;
  }

  const home = settings.homeContent || {};
  const featured = Array.isArray(home.featuredProductIds) ? home.featuredProductIds : [];
  const activeProducts = products.filter((product) => product.active === true);
  view.innerHTML = `<form id="homepage-form" class="panel admin-home-form">
    <div class="admin-section-head">
      <h2>首頁內容</h2>
      <a class="mini-btn admin-editor-link" href="${STOREFRONT_URL}" target="_blank" rel="noopener">開啟商店首頁</a>
    </div>
    <section class="admin-editor-section" aria-labelledby="home-banner-title">
      <h3 id="home-banner-title">首頁主視覺</h3>
      <div class="admin-home-hero">
        ${homepageImageField("h-hero-image", "主視覺圖片網址", home.heroImageUrl, "./select-studio-hero.jpg")}
        <div class="field">
          <label for="h-title">首頁主標題</label>
          <textarea id="h-title" rows="3" maxlength="160" required>${esc(settings.heroTitle)}</textarea>
        </div>
      </div>
    </section>
    <section class="admin-editor-section" aria-labelledby="home-about-title">
      <h3 id="home-about-title" lang="en">ABOUT 77 Select</h3>
      <div class="field"><label for="h-about">品牌介紹</label><textarea id="h-about" rows="5" maxlength="4000">${esc(home.about)}</textarea></div>
    </section>
    <section class="admin-editor-section" aria-labelledby="home-featured-title">
      <h3 id="home-featured-title">明星商品</h3>
      <div class="admin-home-featured">
        ${[0, 1, 2].map((index) => {
          const currentId = featured[index] || "";
          const inactive = currentId && !activeProducts.some((product) => product.id === currentId);
          return `<div class="field">
            <label for="h-feature-${index}">商品 ${index + 1}</label>
            <select id="h-feature-${index}">
              <option value="">保留空位</option>
              ${inactive ? `<option value="${esc(currentId)}" selected>原商品未上架</option>` : ""}
              ${activeProducts.map((product) => `<option value="${esc(product.id)}" ${product.id === currentId ? "selected" : ""}>${esc(product.name)}</option>`).join("")}
            </select>
          </div>`;
        }).join("")}
      </div>
    </section>
    <section class="admin-editor-section" aria-labelledby="home-series-title">
      <h3 id="home-series-title">商品系列</h3>
      <p class="order-date">首頁系列卡片和系列頁會顯示相同描述。可分段輸入，留空會恢復預設描述。</p>
      <div class="admin-home-series">
        ${SERIES_COVERS.map(([id, label, defaultImage]) => `<div class="field">
          ${homepageImageField(`h-cover-${id}`, `${label}封面圖片網址（選填）`, home.seriesImages?.[id], defaultImage, "變更系列封面")}
          <label for="h-slogan-${id}">${esc(label)}描述</label>
          <textarea id="h-slogan-${id}" rows="4" maxlength="${MAX_SERIES_DESCRIPTION_LENGTH}" placeholder="${esc(seriesSlogan(id))}">${esc(seriesSlogan(id, home.seriesSlogans))}</textarea>
        </div>`).join("")}
      </div>
    </section>
    <section class="admin-editor-section" aria-labelledby="home-reviews-title">
      <h3 id="home-reviews-title">顧客真實感受</h3>
      <div class="field"><label for="h-reviews">心得內容</label><textarea id="h-reviews" rows="5" maxlength="5000">${esc(home.reviews)}</textarea></div>
    </section>
    <section class="admin-editor-section" aria-labelledby="home-faq-title">
      <h3 id="home-faq-title">常見問題</h3>
      <div class="field"><label for="h-faq">問題與解答</label><textarea id="h-faq" rows="5" maxlength="5000">${esc(home.faq)}</textarea></div>
    </section>
    <div class="admin-editor-actions"><button class="primary-btn" type="submit">儲存首頁</button></div>
  </form>`;

  const form = $("#homepage-form");
  form.addEventListener("change", (event) => {
    const preview = event.target.closest(".admin-home-image")?.querySelector("[data-preview-image]");
    if (!preview || preview.dataset.previewImage !== event.target.id) return;
    const image = publicImageUrl(event.target.value.trim()) || preview.dataset.defaultImage;
    if (image) preview.src = image;
    else preview.removeAttribute("src");
    preview.hidden = !image;
    preview.nextElementSibling.hidden = Boolean(image);
  });
  form.onsubmit = saveHomepage;
}

async function saveHomepage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;

  const value = (id) => form.querySelector(`#${id}`).value.trim();
  const heroTitle = value("h-title");
  if (!heroTitle) return flash("請填寫首頁主標題。", "error");

  const changedSeriesFields = (field) => Object.fromEntries(SERIES_COVERS.flatMap(([id]) => {
    const input = form.querySelector(`#h-${field}-${id}`);
    const text = input.value.trim();
    return text === input.defaultValue.trim() ? [] : [[id, text]];
  }));
  const heroImageUrl = value("h-hero-image");
  const seriesImages = changedSeriesFields("cover");
  if ([heroImageUrl, ...Object.values(seriesImages)].some((url) => url && !publicImageUrl(url))) {
    return flash("請使用可公開瀏覽的 HTTPS 圖片網址。", "error");
  }

  const seriesSlogans = changedSeriesFields("slogan");
  if (Object.values(seriesSlogans).some((text) => text.length > MAX_SERIES_DESCRIPTION_LENGTH)) {
    return flash(`系列描述最多可輸入 ${MAX_SERIES_DESCRIPTION_LENGTH} 個字。`, "error");
  }

  const featuredProductIds = [0, 1, 2].map((index) => value(`h-feature-${index}`));
  const selectedProducts = featuredProductIds.filter(Boolean);
  if (new Set(selectedProducts).size !== selectedProducts.length) {
    return flash("明星商品請選擇不同的商品。", "error");
  }

  const homeContent = {
    heroImageUrl,
    about: value("h-about"),
    featuredProductIds,
    ...(Object.keys(seriesImages).length ? { seriesImages } : {}),
    ...(Object.keys(seriesSlogans).length ? { seriesSlogans } : {}),
    reviews: value("h-reviews"),
    faq: value("h-faq"),
  };

  button.disabled = true;
  form.inert = true;
  try {
    await setDoc(doc(db, "shopSettings", "public"), { heroTitle, homeContent, updatedAt: serverTimestamp() }, { merge: true });
    await audit("homepage_update", "public");
    if (!form.isConnected) return;
    for (const [id, url] of Object.entries(seriesImages)) {
      const input = form.querySelector(`#h-cover-${id}`);
      input.value = url;
      input.defaultValue = url;
    }
    for (const id of Object.keys(seriesSlogans)) {
      const input = form.querySelector(`#h-slogan-${id}`);
      input.value = seriesSlogan(id, seriesSlogans);
      input.defaultValue = input.value;
    }
    form.dataset.dirty = "";
    flash("首頁內容已儲存。");
  } catch (error) {
    if (form.isConnected) flash(error, "error");
  } finally {
    if (form.isConnected) {
      form.inert = false;
      button.disabled = false;
    }
  }
}

function renderSettings() {
  $("#admin-view").innerHTML = `<form id="settings-form" class="panel"><div class="settings-grid"><div class="field"><label>商店名稱</label><input id="s-store" value="${esc(settings.storeName)}"></div><div class="field"><label>通知 Email</label><input id="s-email" type="email" value="${esc(settings.storeEmail)}"></div><label class="check-line"><input id="s-pickup" type="checkbox" ${settings.enablePickup ? "checked" : ""}><span>工作室自取</span></label><label class="check-line"><input id="s-cash" type="checkbox" ${settings.enableCashPickup ? "checked" : ""}><span>自取付款</span></label><label class="check-line"><input id="s-711" type="checkbox" ${settings.enable711 ? "checked" : ""}><span>7-11 店到店</span></label><div class="field"><label>7-11 運費</label><input id="s-fee711" type="number" min="0" value="${Number(settings.shippingFee711 || 0)}"></div><label class="check-line"><input id="s-family" type="checkbox" ${settings.enableFamily ? "checked" : ""}><span>全家店到店</span></label><div class="field"><label>全家運費</label><input id="s-feefamily" type="number" min="0" value="${Number(settings.shippingFeeFamily || 0)}"></div><label class="check-line"><input id="s-transfer" type="checkbox" ${settings.enableTransfer ? "checked" : ""}><span>銀行轉帳</span></label><div></div><div class="field wide"><label>自取說明</label><textarea id="s-pickup-note" rows="2">${esc(settings.pickupNote)}</textarea></div><div class="field wide"><label>轉帳說明</label><textarea id="s-transfer-note" rows="2">${esc(settings.transferNote)}</textarea></div><div class="field wide"><label>寄信服務網址</label><input id="s-email-url" type="url" value="${esc(settings.appsScriptEmailUrl || DEFAULT_EMAIL_URL)}"></div></div><button class="primary-btn" style="margin-top:18px" type="submit">儲存商店設定</button></form>`;
  $("#settings-form").onsubmit = saveSettings;
}
async function saveSettings(event) {
  event.preventDefault();
  const data = {
    storeName: $("#s-store").value.trim() || "77waxing",
    storeEmail: $("#s-email").value.trim() || "77waxing.mail@gmail.com",
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
  const version = ++authVersion;
  cleanupListeners();
  currentUser = null;
  products = [];
  orders = [];
  messages = [];
  settingsReady = false;
  editingProductId = null;
  addingProduct = false;
  filteredOrderCache = [];
  $("#admin-app").innerHTML = '<p class="admin-login" role="status">正在確認商店後台登入狀態…</p>';
  const allowed = user && await isAdmin(user);
  if (version !== authVersion || auth.currentUser?.uid !== user?.uid) return;
  if (allowed) {
    currentUser = user;
    mountAdmin();
  } else {
    currentUser = null;
    if (user) await signOut(auth).catch(() => {});
    renderLogin();
  }
});
document.addEventListener("input", (event) => {
  const form = event.target.closest?.("#product-form, #settings-form, #homepage-form");
  if (form) form.dataset.dirty = "1";
});
document.addEventListener("77select:product-saved", () => {
  if (!$("#admin-view") || currentView !== "products") return;
  editingProductId = null;
  addingProduct = false;
  renderProducts();
});
window.addEventListener("error", (event) => console.error("[77waxing shop admin]", event.error || event.message));
window.addEventListener("unhandledrejection", (event) => console.error("[77waxing shop admin promise]", event.reason));
