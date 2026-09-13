import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const APP = "77waxing-shop-admin";
const PROMOTION_TYPES = ["bundle_price", "any_qty_bundle", "percent_off", "amount_off", "gift"];
let auth;
let db;
let products = [];
let promos = [];
let editId = "";
let active = false;
let unsubs = [];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const num = (value) => Math.max(0, Math.round(Number(value) || 0));
const uid = () => globalThis.crypto?.randomUUID?.() || `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitApp() {
  for (let i = 0; i < 160; i += 1) {
    const app = getApps().find((item) => item.name === APP);
    if (app) return app;
    await sleep(50);
  }
  throw new Error("admin app timeout");
}

async function isAdmin(user) {
  if (!user || user.isAnonymous) return false;
  const snap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
  return Boolean(snap?.exists());
}

function message(text, error = false) {
  if (error) {
    alert(text);
    return;
  }
  const el = $("#admin-message");
  if (el) el.textContent = text;
}

function flash(text) {
  message(text, false);
  setTimeout(() => {
    const el = $("#admin-message");
    if (el && el.textContent === text) el.textContent = "";
  }, 2600);
}

function variants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => ({
      id: String(variant.id || `variant-${index + 1}`),
      name: String(variant.name || variant.label || `規格 ${index + 1}`),
      capacity: String(variant.capacity || variant.size || ""),
    }));
  }
  return [{ id: "default", name: "一般規格", capacity: "" }];
}

function options() {
  return products.flatMap((product) => variants(product).map((variant) => ({
    key: `${product.id}::${variant.id}`,
    productId: product.id,
    variantId: variant.id,
    productName: product.name || "未命名商品",
    variantName: variant.name,
    capacity: variant.capacity,
    active: product.active !== false,
    label: `${product.name || "未命名商品"}｜${[variant.name, variant.capacity].filter(Boolean).join("｜") || "一般規格"}`,
  })));
}

function normalizeItem(item = {}) {
  return {
    productId: String(item.productId || ""),
    variantId: String(item.variantId || "default"),
    productName: String(item.productName || ""),
    variantName: String(item.variantName || ""),
    capacity: String(item.capacity || ""),
  };
}

function normalizePromotions(source) {
  return Array.isArray(source) ? source.map((promo, index) => {
    const promotionType = PROMOTION_TYPES.includes(promo?.promotionType) ? promo.promotionType : "bundle_price";
    const groups = Array.isArray(promo?.groups) ? promo.groups.map((group, groupIndex) => ({
      id: String(group?.id || (promotionType === "any_qty_bundle" ? "any" : (groupIndex === 0 ? "buy" : "add"))),
      title: String(group?.title || (promotionType === "any_qty_bundle" ? "參加品項" : (groupIndex === 0 ? "購買品項" : "加購品項"))),
      minQty: Math.max(1, num(group?.minQty || 1)),
      items: Array.isArray(group?.items) ? group.items.map(normalizeItem).filter((item) => item.productId && item.variantId) : [],
    })) : [];
    return {
      id: String(promo?.id || `promo-${index + 1}`),
      title: String(promo?.title || "未命名促銷"),
      active: promo?.active !== false,
      promotionType,
      groups,
      discount: {
        bundlePriceTWD: num(promo?.discount?.bundlePriceTWD),
        bundlePriceHKD: num(promo?.discount?.bundlePriceHKD),
        percentOff: num(promo?.discount?.percentOff),
        amountTWD: num(promo?.discount?.amountTWD),
        amountHKD: num(promo?.discount?.amountHKD),
      },
      gift: promo?.gift || null,
      note: String(promo?.note || ""),
      updatedAtText: String(promo?.updatedAtText || ""),
    };
  }) : [];
}

function blankPromotion() {
  return {
    id: "",
    title: "",
    active: true,
    promotionType: "bundle_price",
    groups: [
      { id: "buy", title: "購買品項", minQty: 1, items: [] },
      { id: "add", title: "加購品項", minQty: 1, items: [] },
    ],
    discount: {},
    gift: null,
    note: "",
  };
}

function label(type) {
  return {
    bundle_price: "組合固定價",
    any_qty_bundle: "任選滿件固定價",
    percent_off: "折扣百分比",
    amount_off: "現折金額",
    gift: "滿組合送商品",
  }[type] || "促銷";
}

function summary(promo) {
  const discount = promo.discount || {};
  if (promo.promotionType === "any_qty_bundle") {
    const minQty = Math.max(1, num(promo.groups?.[0]?.minQty || 1));
    return `任選滿 ${minQty} 件｜NT$${num(discount.bundlePriceTWD)}｜HK$${num(discount.bundlePriceHKD)}`;
  }
  if (promo.promotionType === "bundle_price") return `NT$${num(discount.bundlePriceTWD)}｜HK$${num(discount.bundlePriceHKD)}`;
  if (promo.promotionType === "percent_off") return `${num(discount.percentOff)}% off`;
  if (promo.promotionType === "amount_off") return `NT$${num(discount.amountTWD)}｜HK$${num(discount.amountHKD)} 現折`;
  return `送 ${promo.gift?.productName || "商品"} ${promo.gift?.quantity || 1} 件`;
}

function conditionSummary(promo) {
  const groups = promo.groups || [];
  if (promo.promotionType === "any_qty_bundle") {
    const first = groups[0] || { items: [], minQty: 1 };
    return `任選滿 ${Math.max(1, num(first.minQty || 1))} 件：${first.items.length} 個可選規格`;
  }
  return groups.slice(0, 2).map((group) => `${esc(group.title)}：${(group.items || []).length}`).join("；");
}

function ensureNav() {
  const nav = $(".admin-nav");
  if (!nav || nav.querySelector("[data-promo-nav]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "促銷活動";
  button.dataset.promoNav = "1";
  button.addEventListener("click", () => {
    active = true;
    editId = "";
    render();
    scrollTo(0, 0);
  });
  nav.insertBefore(button, nav.querySelector('[data-view="orders"]') || null);
}

function optionChecks(groupIndex, items = []) {
  const selected = new Set(items.map((item) => `${item.productId}::${item.variantId}`));
  const rows = options();
  if (!rows.length) return `<div class="promotion-empty">請先建立商品與規格。</div>`;
  return rows.map((option) => `
    <label class="promotion-item-check${option.active ? "" : " is-off"}">
      <input type="checkbox" data-g="${groupIndex}" value="${esc(option.key)}" ${selected.has(option.key) ? "checked" : ""}>
      <span><b>${esc(option.productName)}</b><small>${esc([option.variantName, option.capacity].filter(Boolean).join("｜") || "一般規格")}${option.active ? "" : "｜下架"}</small></span>
    </label>
  `).join("");
}

function formHtml(promo) {
  const type = promo.promotionType || "bundle_price";
  const groups = promo.groups?.length ? promo.groups : blankPromotion().groups;
  const firstGroup = type === "any_qty_bundle" ? (groups[0] || { title: "參加品項", minQty: 10, items: [] }) : (groups[0] || blankPromotion().groups[0]);
  const secondGroup = groups[1] || blankPromotion().groups[1];
  const discount = promo.discount || {};
  const giftKey = promo.gift ? `${promo.gift.productId}::${promo.gift.variantId}` : "";
  const opts = options();

  return `
    <form id="promotion-form" class="panel promotion-form" novalidate>
      <div class="admin-section-head">
        <div>
          <h2>${editId ? "編輯促銷" : "新增促銷"}</h2>
          <p class="order-date">促銷設定獨立儲存，不改商品、圖片、規格與購物車既有程式。</p>
        </div>
        ${editId ? `<button id="promo-cancel" class="mini-btn" type="button">取消編輯</button>` : ""}
      </div>

      <div class="settings-grid">
        <div class="field wide"><label>促銷標題</label><input id="pr-title" value="${esc(promo.title)}" placeholder="例如：滿 10 件固定優惠"></div>
        <div class="field"><label>促銷方式</label><select id="pr-type">${PROMOTION_TYPES.map((item) => `<option value="${item}" ${type === item ? "selected" : ""}>${label(item)}</option>`).join("")}</select></div>
        <label class="check-line"><input id="pr-active" type="checkbox" ${promo.active !== false ? "checked" : ""}><span>啟用</span></label>
        <div class="field wide"><label>內部備註</label><textarea id="pr-note" rows="2">${esc(promo.note || "")}</textarea></div>
      </div>

      <div class="promotion-discount-panels">
        <div data-panel="bundle_price any_qty_bundle" class="settings-grid">
          <div class="field"><label>台灣固定價 NT$</label><input id="pr-btw" type="number" min="0" value="${num(discount.bundlePriceTWD)}"></div>
          <div class="field"><label>香港固定價 HK$</label><input id="pr-bhk" type="number" min="0" value="${num(discount.bundlePriceHKD)}"></div>
          <div class="field" data-any-qty-field><label>最低成立件數</label><input id="pr-any-qty" type="number" min="2" value="${Math.max(2, num(firstGroup.minQty || 10))}"></div>
        </div>
        <div data-panel="percent_off" class="settings-grid">
          <div class="field"><label>折扣百分比</label><input id="pr-percent" type="number" min="1" max="99" value="${num(discount.percentOff)}"></div>
        </div>
        <div data-panel="amount_off" class="settings-grid">
          <div class="field"><label>台灣現折 NT$</label><input id="pr-atw" type="number" min="0" value="${num(discount.amountTWD)}"></div>
          <div class="field"><label>香港現折 HK$</label><input id="pr-ahk" type="number" min="0" value="${num(discount.amountHKD)}"></div>
        </div>
        <div data-panel="gift" class="settings-grid">
          <div class="field"><label>贈送商品／規格</label><select id="pr-gift"><option value="">請選擇</option>${opts.map((option) => `<option value="${esc(option.key)}" ${option.key === giftKey ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></div>
          <div class="field"><label>贈送數量</label><input id="pr-gqty" type="number" min="1" value="${Math.max(1, num(promo.gift?.quantity || 1))}"></div>
        </div>
      </div>

      <div class="promotion-rule-head">
        <h3>組合條件</h3>
        <p data-rule-help></p>
      </div>
      <div class="promotion-groups">
        <section class="promotion-condition-group" data-condition-group="0">
          <div class="field"><label data-g0-label>條件 1 名稱</label><input id="g0-title" value="${esc(firstGroup.title || (type === "any_qty_bundle" ? "參加品項" : "購買品項"))}"></div>
          <div class="promotion-item-grid">${optionChecks(0, firstGroup.items || [])}</div>
        </section>
        <section class="promotion-condition-group" data-condition-group="1">
          <div class="field"><label>條件 2 名稱</label><input id="g1-title" value="${esc(secondGroup.title || "加購品項")}"></div>
          <div class="promotion-item-grid">${optionChecks(1, secondGroup.items || [])}</div>
        </section>
      </div>
      <button class="primary-btn" style="margin-top:16px" type="submit">${editId ? "儲存促銷" : "新增促銷"}</button>
    </form>
  `;
}

function tableHtml() {
  return `
    <div class="table-wrap promotion-table">
      <table class="admin-table">
        <thead><tr><th>促銷</th><th>方式</th><th>設定</th><th>條件</th><th>狀態</th><th>操作</th></tr></thead>
        <tbody>${promos.map((promo) => `
          <tr>
            <td><b>${esc(promo.title)}</b></td>
            <td>${label(promo.promotionType)}</td>
            <td>${esc(summary(promo))}</td>
            <td>${conditionSummary(promo)}</td>
            <td>${promo.active ? "啟用" : "停用"}</td>
            <td><div class="admin-actions"><button class="mini-btn" type="button" data-pe="${esc(promo.id)}">編輯</button><button class="mini-btn" type="button" data-pt="${esc(promo.id)}">${promo.active ? "停用" : "啟用"}</button><button class="mini-btn danger-text" type="button" data-pd="${esc(promo.id)}">刪除</button></div></td>
          </tr>
        `).join("") || `<tr><td colspan="6">尚未建立促銷活動。</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function updatePanels() {
  const type = $("#pr-type")?.value || "bundle_price";
  $$('[data-panel]').forEach((panel) => {
    panel.hidden = !String(panel.dataset.panel || "").split(/\s+/).includes(type);
  });
  const anyMode = type === "any_qty_bundle";
  const anyField = $('[data-any-qty-field]');
  if (anyField) anyField.hidden = !anyMode;
  const secondGroup = $('[data-condition-group="1"]');
  if (secondGroup) secondGroup.hidden = anyMode;
  $('[data-condition-group="0"]')?.classList.toggle("is-wide", anyMode);
  const help = $('[data-rule-help]');
  if (help) help.textContent = anyMode ? "勾選所有可參加的商品／規格；客人從這一欄任選滿指定件數就成立。" : "條件 1 是買什麼；條件 2 是加什麼。每欄可多選，符合任一規格即可。";
  const g0Label = $('[data-g0-label]');
  if (g0Label) g0Label.textContent = anyMode ? "參加品項名稱" : "條件 1 名稱";
  const g0Title = $('#g0-title');
  if (g0Title && anyMode && !g0Title.value.trim()) g0Title.value = "參加品項";
}

function selectedItems(groupIndex) {
  const map = new Map(options().map((option) => [option.key, option]));
  return $$(`[data-g="${groupIndex}"]:checked`).map((input) => map.get(input.value)).filter(Boolean).map((option) => ({
    productId: option.productId,
    variantId: option.variantId,
    productName: option.productName,
    variantName: option.variantName,
    capacity: option.capacity,
  }));
}

function readForm() {
  const type = $("#pr-type")?.value || "bundle_price";
  const gift = new Map(options().map((option) => [option.key, option])).get($("#pr-gift")?.value || "");
  const firstTitle = $("#g0-title")?.value.trim() || (type === "any_qty_bundle" ? "參加品項" : "購買品項");
  const groups = type === "any_qty_bundle"
    ? [{ id: "any", title: firstTitle, minQty: Math.max(2, num($("#pr-any-qty")?.value || 10)), items: selectedItems(0) }]
    : [
      { id: "buy", title: firstTitle, minQty: 1, items: selectedItems(0) },
      { id: "add", title: $("#g1-title")?.value.trim() || "加購品項", minQty: 1, items: selectedItems(1) },
    ];

  return {
    id: editId || uid(),
    title: $("#pr-title")?.value.trim() || "",
    active: Boolean($("#pr-active")?.checked),
    promotionType: type,
    groups,
    discount: {
      bundlePriceTWD: num($("#pr-btw")?.value),
      bundlePriceHKD: num($("#pr-bhk")?.value),
      percentOff: num($("#pr-percent")?.value),
      amountTWD: num($("#pr-atw")?.value),
      amountHKD: num($("#pr-ahk")?.value),
    },
    gift: gift ? {
      productId: gift.productId,
      variantId: gift.variantId,
      productName: gift.productName,
      variantName: gift.variantName,
      capacity: gift.capacity,
      quantity: Math.max(1, num($("#pr-gqty")?.value || 1)),
    } : null,
    note: $("#pr-note")?.value.trim() || "",
    updatedAtText: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
  };
}

function validationProblem(promo) {
  if (!promo.title) return "請填寫促銷標題。";
  if (!options().length) return "請先建立商品與規格。";
  if (promo.promotionType === "any_qty_bundle") {
    if (!promo.groups[0].items.length) return "參加品項至少勾選一個規格。";
    if (promo.groups[0].minQty < 2) return "最低成立件數至少要 2 件。";
    if (!promo.discount.bundlePriceTWD || !promo.discount.bundlePriceHKD) return "任選滿件固定價要同時填 NT$ 與 HK$。";
    return "";
  }
  if (!promo.groups[0].items.length) return "條件 1 至少勾選一個規格。";
  if (!promo.groups[1].items.length) return "條件 2 至少勾選一個規格。";
  if (promo.promotionType === "bundle_price" && (!promo.discount.bundlePriceTWD || !promo.discount.bundlePriceHKD)) return "組合固定價要同時填 NT$ 與 HK$。";
  if (promo.promotionType === "percent_off" && (promo.discount.percentOff < 1 || promo.discount.percentOff > 99)) return "折扣百分比請填 1～99。";
  if (promo.promotionType === "amount_off" && (!promo.discount.amountTWD || !promo.discount.amountHKD)) return "現折金額要同時填 NT$ 與 HK$。";
  if (promo.promotionType === "gift" && !promo.gift) return "請選擇贈品商品規格。";
  return "";
}

async function savePromotions(list) {
  await setDoc(doc(db, "shopSettings", "public"), {
    promotions: list,
    promotionsUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

function render() {
  if (!active) return;
  ensureNav();
  $$(".admin-nav button").forEach((button) => button.classList.toggle("on", Boolean(button.dataset.promoNav)));
  const title = $("#admin-title");
  if (title) title.textContent = "促銷活動";
  const host = $("#admin-view");
  if (!host) return;
  const draft = editId ? promos.find((promo) => promo.id === editId) || blankPromotion() : blankPromotion();
  host.innerHTML = `<div class="promotion-admin-view">${formHtml(draft)}${tableHtml()}</div>`;
  bind();
  updatePanels();
}

function bind() {
  const form = $("#promotion-form");
  form?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && !event.target.closest?.("textarea")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const promotion = readForm();
    const bad = validationProblem(promotion);
    if (bad) return message(bad, true);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = "儲存中…";
    }
    try {
      await savePromotions(editId ? promos.map((item) => item.id === editId ? promotion : item) : [promotion, ...promos]);
      editId = "";
      flash("促銷活動已儲存。");
      render();
    } catch (error) {
      console.error(error);
      message(error?.message || "促銷儲存失敗，請確認權限與網路。", true);
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = editId ? "儲存促銷" : "新增促銷";
      }
    }
  }, true);
  $("#pr-type")?.addEventListener("change", updatePanels);
  $("#promo-cancel")?.addEventListener("click", () => { editId = ""; render(); });
  $$('[data-pe]').forEach((button) => button.addEventListener("click", () => { editId = button.dataset.pe; render(); scrollTo(0, 0); }));
  $$('[data-pt]').forEach((button) => button.addEventListener("click", async () => {
    const promotion = promos.find((item) => item.id === button.dataset.pt);
    if (!promotion) return;
    try {
      await savePromotions(promos.map((item) => item.id === promotion.id ? { ...item, active: !item.active } : item));
    } catch (error) {
      message(error?.message || "狀態更新失敗。", true);
    }
  }));
  $$('[data-pd]').forEach((button) => button.addEventListener("click", async () => {
    const promotion = promos.find((item) => item.id === button.dataset.pd);
    if (!promotion || !confirm(`確定刪除促銷「${promotion.title}」？`)) return;
    try {
      await savePromotions(promos.filter((item) => item.id !== promotion.id));
    } catch (error) {
      message(error?.message || "刪除失敗。", true);
    }
  }));
}

function subscribe() {
  unsubs.forEach((unsub) => unsub?.());
  unsubs = [
    onSnapshot(collection(db, "shopProducts"), (snap) => {
      products = snap.docs.map((row) => ({ id: row.id, ...row.data() }));
      if (active) render();
    }, console.error),
    onSnapshot(doc(db, "shopSettings", "public"), (snap) => {
      promos = normalizePromotions(snap.exists() ? snap.data()?.promotions : []);
      if (active) render();
    }, console.error),
  ];
}

try {
  const app = await waitApp();
  auth = getAuth(app);
  db = getFirestore(app);
  new MutationObserver(ensureNav).observe(document.documentElement, { childList: true, subtree: true });
  ensureNav();
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".admin-nav [data-view]")) {
      active = false;
      editId = "";
    }
  }, true);
  onAuthStateChanged(auth, async (user) => {
    unsubs.forEach((unsub) => unsub?.());
    unsubs = [];
    if (await isAdmin(user)) {
      subscribe();
      ensureNav();
    }
  });
} catch (error) {
  console.error("77select promotion admin failed", error);
}
