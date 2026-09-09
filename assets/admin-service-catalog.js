import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { loadCatalog, makeCatalogId, makeSlug, saveCatalog, watchCatalog } from "./service-catalog-store.js";

let catalog = [];
let ready = false;
let unsubCatalog = null;
let scheduled = false;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const route = () => ((location.hash || "#dashboard").slice(1) || "dashboard");
const root = () => document.querySelector("body.admin-page #admin-preview");
const workspace = () => root()?.querySelector(".admin-v2-workspace");
const clone = (value) => JSON.parse(JSON.stringify(value));

function ensureBusy() {
  let node = document.querySelector("[data-catalog-admin-busy]");
  if (!node) {
    node = document.createElement("div");
    node.className = "catalog-admin-busy";
    node.dataset.catalogAdminBusy = "1";
    node.hidden = true;
    node.innerHTML = "<div><b>正在更新服務資料…</b><small>同步服務、價目與預約設定，請稍候。</small></div>";
    document.body.appendChild(node);
  }
  return node;
}

function setBusy(show, title = "正在更新服務資料…") {
  const node = ensureBusy();
  node.querySelector("b").textContent = title;
  node.hidden = !show;
}

function ensureModal() {
  let modal = document.querySelector("[data-catalog-admin-modal]");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "catalog-admin-modal";
    modal.dataset.catalogAdminModal = "1";
    modal.hidden = true;
    document.body.appendChild(modal);
  }
  return modal;
}

function openForm({ title, fields, submitText = "儲存" }) {
  return new Promise((resolve) => {
    const modal = ensureModal();
    modal.hidden = false;
    modal.innerHTML = `<div class="catalog-admin-dialog" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><form class="catalog-admin-form">${fields.map((field) => {
      const cls = field.full ? "full" : "";
      const value = esc(field.value ?? "");
      if (field.type === "textarea") return `<label class="${cls}">${esc(field.label)}<textarea name="${esc(field.name)}" rows="3" ${field.required ? "required" : ""}>${value}</textarea></label>`;
      if (field.type === "select") return `<label class="${cls}">${esc(field.label)}<select name="${esc(field.name)}">${field.options.map(([v,l])=>`<option value="${esc(v)}" ${String(field.value)===String(v)?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`;
      return `<label class="${cls}">${esc(field.label)}<input name="${esc(field.name)}" type="${field.type || "text"}" value="${value}" ${field.min != null ? `min="${field.min}"` : ""} ${field.max != null ? `max="${field.max}"` : ""} ${field.required ? "required" : ""}></label>`;
    }).join("")}</form><div class="catalog-admin-modal-actions"><button type="button" class="catalog-mini-btn" data-modal-cancel>取消</button><button type="button" class="catalog-mini-btn primary" data-modal-submit>${esc(submitText)}</button></div></div>`;
    const form = modal.querySelector("form");
    const close = (value) => { modal.hidden = true; modal.innerHTML = ""; resolve(value); };
    modal.querySelector("[data-modal-cancel]").onclick = () => close(null);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(null); }, { once: true });
    modal.querySelector("[data-modal-submit]").onclick = () => {
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      close(data);
    };
  });
}

async function persist(nextCatalog, title = "正在更新服務資料…") {
  setBusy(true, title);
  try {
    catalog = await saveCatalog(nextCatalog);
    renderCurrent(true);
  } catch (error) {
    console.error(error);
    alert("更新失敗，請稍後再試。資料尚未套用。");
  } finally {
    setBusy(false);
  }
}

function categoryAt(key, source = catalog) { return source.find((category) => category.key === key); }
function groupAt(category, id) { return category?.groups.find((group) => group.id === id); }
function itemAt(group, id) { return group?.items.find((item) => item.id === id); }

async function addCategory() {
  const values = await openForm({
    title: "新增服務分類",
    fields: [
      { name: "name", label: "分類名稱，例如：身體保養", required: true },
      { name: "en", label: "英文標題", value: "SERVICE" },
      { name: "slug", label: "網址代碼（英文，例如 body-care）", required: true },
      { name: "intro", label: "服務頁小標語／簡介", type: "textarea", full: true },
    ],
    submitText: "新增分類",
  });
  if (!values) return;
  const slug = makeSlug(values.slug);
  if (catalog.some((category) => category.slug === slug)) return alert("這個網址代碼已經存在，請換一個。");
  const next = clone(catalog);
  next.push({
    key: makeCatalogId("cat"),
    slug,
    name: values.name.trim(),
    en: values.en.trim() || "SERVICE",
    intro: values.intro.trim(),
    enabled: true,
    groups: [
      { id: makeCatalogId("group"), title: "服務項目", priceTitle: "服務項目", kind: "main", desc: "", items: [] },
      { id: makeCatalogId("addon"), title: "加購項目", priceTitle: "加購項目", kind: "addon", desc: "", items: [] },
    ],
    notes: [],
  });
  await persist(next, "正在新增服務分類…");
}

async function editCategory(key) {
  const current = categoryAt(key); if (!current) return;
  const values = await openForm({
    title: `編輯 ${current.name}`,
    fields: [
      { name: "name", label: "分類名稱", value: current.name, required: true },
      { name: "en", label: "英文標題", value: current.en },
      { name: "slug", label: "網址代碼", value: current.slug, required: true },
      { name: "intro", label: "服務頁小標語／簡介", type: "textarea", value: current.intro, full: true },
    ],
  });
  if (!values) return;
  const slug = makeSlug(values.slug);
  if (catalog.some((category) => category.key !== key && category.slug === slug)) return alert("這個網址代碼已經存在，請換一個。");
  const next = clone(catalog); const target = categoryAt(key, next);
  Object.assign(target, { name: values.name.trim(), en: values.en.trim() || "SERVICE", slug, intro: values.intro.trim() });
  await persist(next, "正在更新服務分類…");
}

async function deleteCategory(key) {
  const current = categoryAt(key); if (!current) return;
  if (!confirm(`確定刪除「${current.name}」？\n\n前台服務選單、價目表與預約分類都會同步移除；既有預約紀錄不會被刪除。`)) return;
  await persist(catalog.filter((category) => category.key !== key), "正在刪除服務分類…");
}

async function addGroup(key) {
  const current = categoryAt(key); if (!current) return;
  const values = await openForm({
    title: `在 ${current.name} 新增區塊`,
    fields: [
      { name: "title", label: "區塊名稱", required: true },
      { name: "priceTitle", label: "價目表區塊名稱（可相同）" },
      { name: "kind", label: "區塊類型", type: "select", value: "main", options: [["main","一般服務"],["addon","加購項目"]] },
      { name: "desc", label: "區塊說明", type: "textarea", full: true },
    ],
    submitText: "新增區塊",
  });
  if (!values) return;
  const next = clone(catalog); const target = categoryAt(key, next);
  target.groups.push({ id: makeCatalogId("group"), title: values.title.trim(), priceTitle: values.priceTitle.trim() || values.title.trim(), kind: values.kind, desc: values.desc.trim(), items: [] });
  await persist(next, "正在新增服務區塊…");
}

async function deleteGroup(key, groupId) {
  const current = categoryAt(key); const group = groupAt(current, groupId); if (!group) return;
  if (!confirm(`確定刪除「${group.title}」以及裡面的 ${group.items.length} 個項目？`)) return;
  const next = clone(catalog); const target = categoryAt(key, next); target.groups = target.groups.filter((entry) => entry.id !== groupId);
  await persist(next, "正在刪除服務區塊…");
}

async function editItem(key, groupId, itemId = "") {
  const current = categoryAt(key); const group = groupAt(current, groupId); if (!group) return;
  const currentItem = itemId ? itemAt(group, itemId) : null;
  const values = await openForm({
    title: currentItem ? `編輯 ${currentItem.name}` : `新增${group.kind === "addon" ? "加購" : "服務"}項目`,
    fields: [
      { name: "name", label: "項目名稱", value: currentItem?.name || "", required: true },
      { name: "description", label: "服務頁說明", value: currentItem?.description || "", full: true },
      { name: "durationMinutes", label: "施作時間（分鐘）", type: "number", value: currentItem?.durationMinutes || 90, min: 1, max: 180, required: true },
      { name: "durationLabel", label: "顯示時間文字", value: currentItem?.durationLabel || "約 90 分鐘" },
      { name: "priceLabel", label: "價格，例如 $1399 或 視範圍", value: currentItem?.priceLabel || "", full: true },
    ],
    submitText: currentItem ? "儲存修改" : "新增項目",
  });
  if (!values) return;
  const next = clone(catalog); const targetGroup = groupAt(categoryAt(key, next), groupId);
  const payload = {
    id: currentItem?.id || makeCatalogId(group.kind === "addon" ? "addon" : "item"),
    name: values.name.trim(),
    description: values.description.trim(),
    durationMinutes: Number(values.durationMinutes || 90),
    durationLabel: values.durationLabel.trim() || `約 ${Number(values.durationMinutes || 90)} 分鐘`,
    priceLabel: values.priceLabel.trim(),
    enabled: currentItem?.enabled !== false,
  };
  if (currentItem) Object.assign(itemAt(targetGroup, itemId), payload); else targetGroup.items.push(payload);
  await persist(next, currentItem ? "正在更新服務項目…" : "正在新增服務項目…");
}

async function deleteItem(key, groupId, itemId) {
  const current = categoryAt(key); const group = groupAt(current, groupId); const item = itemAt(group, itemId); if (!item) return;
  if (!confirm(`確定刪除「${item.name}」？\n\n前台服務、價目與預約選項會同步移除。`)) return;
  const next = clone(catalog); const targetGroup = groupAt(categoryAt(key, next), groupId); targetGroup.items = targetGroup.items.filter((entry) => entry.id !== itemId);
  await persist(next, "正在刪除服務項目…");
}

async function toggleCategory(key, enabled) {
  const next = clone(catalog); categoryAt(key, next).enabled = enabled; await persist(next, "正在更新服務開放狀態…");
}
async function toggleItem(key, groupId, itemId, enabled) {
  const next = clone(catalog); itemAt(groupAt(categoryAt(key, next), groupId), itemId).enabled = enabled; await persist(next, "正在更新項目開放狀態…");
}
async function savePrice(key, groupId, itemId, value) {
  const next = clone(catalog); itemAt(groupAt(categoryAt(key, next), groupId), itemId).priceLabel = value.trim(); await persist(next, "正在同步價格…");
}

function servicesMarkup() {
  return `<div class="catalog-admin-shell" data-dynamic-catalog-view="services"><div class="catalog-admin-head"><div><span class="tag">SERVICES</span><h3>服務管理</h3><p class="catalog-admin-note">新增或刪除後，前台服務選單、服務頁、價目表與預約項目會讀取同一份資料。</p></div><div class="catalog-category-actions"><button class="catalog-mini-btn primary" type="button" data-add-category>＋ 新增服務分類</button></div></div>${catalog.map((category) => `<section class="catalog-category-card" data-category="${esc(category.key)}"><div class="catalog-category-head"><div><h4>${esc(category.name)}</h4><small>${esc(category.en)} · /services/${esc(category.slug)}/</small></div><div class="catalog-category-actions"><label class="catalog-toggle"><input type="checkbox" data-category-toggle ${category.enabled !== false ? "checked" : ""}> 開放前台</label><button class="catalog-mini-btn" data-edit-category>編輯</button><button class="catalog-mini-btn" data-add-group>＋ 新增區塊</button><button class="catalog-mini-btn danger" data-delete-category>刪除分類</button></div></div>${category.groups.map((group) => `<div class="catalog-group-card" data-group="${esc(group.id)}"><div class="catalog-group-head"><div><h5>${esc(group.title)}</h5><span class="catalog-kind">${group.kind === "addon" ? "ADD-ON 加購" : "SERVICE 一般服務"}</span></div><div class="catalog-group-actions"><button class="catalog-mini-btn" data-add-item>＋ ${group.kind === "addon" ? "新增加購項目" : "新增服務項目"}</button><button class="catalog-mini-btn danger" data-delete-group>刪除區塊</button></div></div><div class="catalog-item-list">${group.items.length ? group.items.map((item) => `<div class="catalog-item-row" data-item="${esc(item.id)}"><div><b>${esc(item.name)}</b><small>${esc(item.description || "尚未填寫服務說明")}</small></div><div><b>${esc(item.durationLabel)}</b><small>${esc(item.durationMinutes)} 分鐘</small></div><div class="price">${esc(item.priceLabel || "尚未設定價格")}</div><div class="catalog-item-actions"><label class="catalog-toggle"><input type="checkbox" data-item-toggle ${item.enabled !== false ? "checked" : ""}> 開放</label><button class="catalog-mini-btn" data-edit-item>編輯</button><button class="catalog-mini-btn danger" data-delete-item>刪除</button></div></div>`).join("") : `<div class="catalog-admin-empty">這個區塊目前沒有項目。</div>`}</div></div>`).join("")}</section>`).join("")}</div>`;
}

function pricingMarkup() {
  return `<div class="catalog-admin-shell" data-dynamic-catalog-view="pricing"><div class="catalog-admin-head"><div><span class="tag">PRICING</span><h3>價格管理</h3><p class="catalog-admin-note">修改後會同步提供給價目頁與預約選項使用。</p></div></div><div class="catalog-pricing-list">${catalog.map((category) => `<section class="catalog-category-card" data-category="${esc(category.key)}"><div class="catalog-category-head"><div><h4>${esc(category.name)}</h4><small>${category.enabled === false ? "目前分類未開放前台" : esc(category.en)}</small></div></div>${category.groups.map((group) => `<div class="catalog-group-card" data-group="${esc(group.id)}"><div class="catalog-group-head"><h5>${esc(group.priceTitle || group.title)}</h5><span class="catalog-kind">${group.kind === "addon" ? "ADD-ON" : "SERVICE"}</span></div>${group.items.length ? group.items.map((item) => `<div class="catalog-price-row" data-item="${esc(item.id)}"><div><b>${esc(item.name)}</b><small>${item.enabled === false ? "目前未開放" : esc(item.durationLabel)}</small></div><input type="text" value="${esc(item.priceLabel || "")}" data-price-value><button class="catalog-mini-btn primary" type="button" data-save-price>儲存</button></div>`).join("") : `<div class="catalog-admin-empty">這個區塊目前沒有項目。</div>`}</div>`).join("")}</section>`).join("")}</div></div>`;
}

function bindServices(node) {
  node.querySelector("[data-add-category]")?.addEventListener("click", addCategory);
  node.querySelectorAll("[data-category]").forEach((categoryNode) => {
    const key = categoryNode.dataset.category;
    categoryNode.querySelector("[data-edit-category]")?.addEventListener("click", () => editCategory(key));
    categoryNode.querySelector("[data-delete-category]")?.addEventListener("click", () => deleteCategory(key));
    categoryNode.querySelector("[data-add-group]")?.addEventListener("click", () => addGroup(key));
    categoryNode.querySelector("[data-category-toggle]")?.addEventListener("change", (event) => toggleCategory(key, event.target.checked));
    categoryNode.querySelectorAll("[data-group]").forEach((groupNode) => {
      const groupId = groupNode.dataset.group;
      groupNode.querySelector("[data-add-item]")?.addEventListener("click", () => editItem(key, groupId));
      groupNode.querySelector("[data-delete-group]")?.addEventListener("click", () => deleteGroup(key, groupId));
      groupNode.querySelectorAll("[data-item]").forEach((itemNode) => {
        const itemId = itemNode.dataset.item;
        itemNode.querySelector("[data-edit-item]")?.addEventListener("click", () => editItem(key, groupId, itemId));
        itemNode.querySelector("[data-delete-item]")?.addEventListener("click", () => deleteItem(key, groupId, itemId));
        itemNode.querySelector("[data-item-toggle]")?.addEventListener("change", (event) => toggleItem(key, groupId, itemId, event.target.checked));
      });
    });
  });
}

function bindPricing(node) {
  node.querySelectorAll("[data-category]").forEach((categoryNode) => {
    const key = categoryNode.dataset.category;
    categoryNode.querySelectorAll("[data-group]").forEach((groupNode) => {
      const groupId = groupNode.dataset.group;
      groupNode.querySelectorAll("[data-item]").forEach((itemNode) => {
        const itemId = itemNode.dataset.item;
        itemNode.querySelector("[data-save-price]")?.addEventListener("click", () => savePrice(key, groupId, itemId, itemNode.querySelector("[data-price-value]").value));
      });
    });
  });
}

function renderCurrent(force = false) {
  if (!ready) return;
  const view = route();
  if (view !== "services" && view !== "pricing") return;
  const node = workspace();
  if (!node) return scheduleTakeover();
  if (!force && node.dataset.catalogOwned === view && node.querySelector(`[data-dynamic-catalog-view="${view}"]`)) return;
  node.hidden = false;
  node.dataset.catalogOwned = view;
  node.innerHTML = view === "services" ? servicesMarkup() : pricingMarkup();
  if (view === "services") bindServices(node); else bindPricing(node);
}

function scheduleTakeover() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; renderCurrent(); });
}

async function start() {
  if (ready) return;
  catalog = await loadCatalog();
  ready = true;
  renderCurrent(true);
  unsubCatalog = await watchCatalog((next) => {
    catalog = next;
    renderCurrent(true);
  });
}

function waitForAdmin() {
  const timer = setInterval(() => {
    if (!getApps().length) return;
    clearInterval(timer);
    const auth = getAuth(getApp());
    onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) start().catch(console.error);
    });
  }, 100);
  setTimeout(() => clearInterval(timer), 20000);
}

addEventListener("hashchange", () => setTimeout(() => renderCurrent(true), 0));
document.addEventListener("click", (event) => {
  if (event.target.closest?.("#admin-preview .sidebar a")) setTimeout(() => renderCurrent(true), 20);
});
new MutationObserver(() => {
  const view = route();
  if (view !== "services" && view !== "pricing") return;
  const node = workspace();
  if (!node || node.dataset.catalogOwned !== view || !node.querySelector(`[data-dynamic-catalog-view="${view}"]`)) scheduleTakeover();
}).observe(document.querySelector("#app") || document.body, { childList: true, subtree: true });

waitForAdmin();
