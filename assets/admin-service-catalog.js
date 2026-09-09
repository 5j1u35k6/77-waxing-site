import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { DEFAULT_CATALOG, loadCatalog, makeCatalogId, makeSlug, saveCatalog, watchCatalog } from "./service-catalog-store.js?v=20260909-2035";

const VERSION = "20260909-2035";
let catalog = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
let hydrated = false;
let hydrating = false;
let unsubCatalog = null;
let actionBusy = false;

const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const route = () => ((location.hash || "#dashboard").slice(1) || "dashboard");
const workspace = () => document.querySelector("body.admin-page #admin-preview .admin-v2-workspace");
const categoryAt = (key, source = catalog) => source.find((category) => category.key === key);
const groupAt = (category, id) => category?.groups?.find((group) => group.id === id);
const itemAt = (group, id) => group?.items?.find((item) => item.id === id);

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
      if (field.type === "select") return `<label class="${cls}">${esc(field.label)}<select name="${esc(field.name)}">${field.options.map(([v,l]) => `<option value="${esc(v)}" ${String(field.value)===String(v)?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`;
      return `<label class="${cls}">${esc(field.label)}<input name="${esc(field.name)}" type="${field.type || "text"}" value="${value}" ${field.min != null ? `min="${field.min}"` : ""} ${field.max != null ? `max="${field.max}"` : ""} ${field.required ? "required" : ""}></label>`;
    }).join("")}</form><div class="catalog-admin-modal-actions"><button type="button" class="catalog-mini-btn" data-modal-cancel>取消</button><button type="button" class="catalog-mini-btn primary" data-modal-submit>${esc(submitText)}</button></div></div>`;
    const form = modal.querySelector("form");
    const close = (value) => { modal.hidden = true; modal.innerHTML = ""; resolve(value); };
    modal.querySelector("[data-modal-cancel]").onclick = () => close(null);
    modal.querySelector("[data-modal-submit]").onclick = () => {
      if (!form.reportValidity()) return;
      close(Object.fromEntries(new FormData(form).entries()));
    };
    modal.onclick = (event) => { if (event.target === modal) close(null); };
  });
}

function servicesMarkup() {
  return `<div class="catalog-admin-shell" data-dynamic-catalog-view="services" data-catalog-version="${VERSION}"><div class="catalog-admin-head"><div><span class="tag">SERVICES</span><h3>服務管理</h3><p class="catalog-admin-note">新增或刪除後，前台服務選單、服務頁、價目表與預約項目會讀取同一份資料。</p></div><div class="catalog-category-actions"><button class="catalog-mini-btn primary" type="button" data-add-category>＋ 新增服務分類</button></div></div>${catalog.map((category) => `<section class="catalog-category-card" data-category="${esc(category.key)}"><div class="catalog-category-head"><div><h4>${esc(category.name)}</h4><small>${esc(category.en)} · /services/${esc(category.slug)}/</small></div><div class="catalog-category-actions"><label class="catalog-toggle"><input type="checkbox" data-category-toggle ${category.enabled !== false ? "checked" : ""}> 開放前台</label><button class="catalog-mini-btn" type="button" data-edit-category>編輯</button><button class="catalog-mini-btn" type="button" data-add-group>＋ 新增區塊</button><button class="catalog-mini-btn danger" type="button" data-delete-category>刪除分類</button></div></div>${category.groups.map((group) => `<div class="catalog-group-card" data-group="${esc(group.id)}"><div class="catalog-group-head"><div><h5>${esc(group.title)}</h5><span class="catalog-kind">${group.kind === "addon" ? "ADD-ON 加購" : "SERVICE 一般服務"}</span></div><div class="catalog-group-actions"><button class="catalog-mini-btn" type="button" data-add-item>＋ ${group.kind === "addon" ? "新增加購項目" : "新增服務項目"}</button><button class="catalog-mini-btn danger" type="button" data-delete-group>刪除區塊</button></div></div><div class="catalog-item-list">${group.items.length ? group.items.map((item) => `<div class="catalog-item-row" data-item="${esc(item.id)}"><div><b>${esc(item.name)}</b><small>${esc(item.description || "尚未填寫服務說明")}</small></div><div><b>${esc(item.durationLabel)}</b><small>${esc(item.durationMinutes)} 分鐘</small></div><div class="price">${esc(item.priceLabel || "尚未設定價格")}</div><div class="catalog-item-actions"><label class="catalog-toggle"><input type="checkbox" data-item-toggle ${item.enabled !== false ? "checked" : ""}> 開放</label><button class="catalog-mini-btn" type="button" data-edit-item>編輯</button><button class="catalog-mini-btn danger" type="button" data-delete-item>刪除</button></div></div>`).join("") : `<div class="catalog-admin-empty">這個區塊目前沒有項目。</div>`}</div></div>`).join("")}</section>`).join("")}</div>`;
}

function pricingMarkup() {
  return `<div class="catalog-admin-shell" data-dynamic-catalog-view="pricing" data-catalog-version="${VERSION}"><div class="catalog-admin-head"><div><span class="tag">PRICING</span><h3>價格管理</h3><p class="catalog-admin-note">修改後會同步提供給價目頁與預約選項使用。</p></div></div><div class="catalog-pricing-list">${catalog.map((category) => `<section class="catalog-category-card" data-category="${esc(category.key)}"><div class="catalog-category-head"><div><h4>${esc(category.name)}</h4><small>${category.enabled === false ? "目前分類未開放前台" : esc(category.en)}</small></div></div>${category.groups.map((group) => `<div class="catalog-group-card" data-group="${esc(group.id)}"><div class="catalog-group-head"><h5>${esc(group.priceTitle || group.title)}</h5><span class="catalog-kind">${group.kind === "addon" ? "ADD-ON" : "SERVICE"}</span></div>${group.items.length ? group.items.map((item) => `<div class="catalog-price-row" data-item="${esc(item.id)}"><div><b>${esc(item.name)}</b><small>${item.enabled === false ? "目前未開放" : esc(item.durationLabel)}</small></div><input type="text" value="${esc(item.priceLabel || "")}" data-price-value><button class="catalog-mini-btn primary" type="button" data-save-price>儲存</button></div>`).join("") : `<div class="catalog-admin-empty">這個區塊目前沒有項目。</div>`}</div>`).join("")}</section>`).join("")}</div></div>`;
}

function render() {
  const view = route();
  if (view !== "services" && view !== "pricing") return;
  const node = workspace();
  if (!node) return setTimeout(render, 50);
  node.hidden = false;
  node.dataset.catalogOwned = view;
  node.innerHTML = view === "services" ? servicesMarkup() : pricingMarkup();
}

async function refreshFromFirestore() {
  if (hydrating) return;
  hydrating = true;
  try {
    catalog = await loadCatalog();
    hydrated = true;
    render();
    if (unsubCatalog) unsubCatalog();
    unsubCatalog = await watchCatalog((next) => {
      catalog = next;
      hydrated = true;
      render();
    });
  } catch (error) {
    console.error("77waxing catalog load failed", error);
    window.dispatchEvent(new CustomEvent("77waxing:admin-catalog-error", { detail: { code: error?.code || error?.name || "CATALOG_READ_ERROR" } }));
  } finally {
    hydrating = false;
  }
}

async function commitChange(mutator, title) {
  if (actionBusy) return;
  actionBusy = true;
  setBusy(true, title);
  try {
    const latest = hydrated ? catalog : await loadCatalog();
    const next = clone(latest);
    const result = mutator(next);
    if (result === false) return;
    catalog = await saveCatalog(next);
    hydrated = true;
    render();
  } catch (error) {
    console.error("77waxing catalog write failed", error);
    const code = error?.code || error?.name || "WRITE_ERROR";
    const detail = error?.message ? `\n${String(error.message).slice(0, 220)}` : "";
    alert(`更新失敗：${code}${detail}`);
  } finally {
    actionBusy = false;
    setBusy(false);
  }
}

async function handleClick(event) {
  const button = event.target.closest?.(".catalog-admin-shell button");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();

  const categoryNode = button.closest("[data-category]");
  const groupNode = button.closest("[data-group]");
  const itemNode = button.closest("[data-item]");
  const key = categoryNode?.dataset.category || "";
  const groupId = groupNode?.dataset.group || "";
  const itemId = itemNode?.dataset.item || "";

  if (button.matches("[data-add-category]")) {
    const values = await openForm({ title: "新增服務分類", fields: [
      { name: "name", label: "分類名稱，例如：身體保養", required: true },
      { name: "en", label: "英文標題", value: "SERVICE" },
      { name: "slug", label: "網址代碼（英文，例如 body-care）", required: true },
      { name: "intro", label: "服務頁小標語／簡介", type: "textarea", full: true },
    ], submitText: "新增分類" });
    if (!values) return;
    return commitChange((next) => {
      const slug = makeSlug(values.slug);
      if (next.some((category) => category.slug === slug)) { alert("這個網址代碼已經存在，請換一個。"); return false; }
      next.push({ key: makeCatalogId("cat"), slug, name: values.name.trim(), en: values.en.trim() || "SERVICE", intro: values.intro.trim(), enabled: true, groups: [
        { id: makeCatalogId("group"), title: "服務項目", priceTitle: "服務項目", kind: "main", desc: "", items: [] },
        { id: makeCatalogId("addon"), title: "加購項目", priceTitle: "加購項目", kind: "addon", desc: "", items: [] },
      ], notes: [] });
    }, "正在新增服務分類…");
  }

  if (!key) return;
  const currentCategory = categoryAt(key);
  if (!currentCategory) return;

  if (button.matches("[data-edit-category]")) {
    const values = await openForm({ title: `編輯 ${currentCategory.name}`, fields: [
      { name: "name", label: "分類名稱", value: currentCategory.name, required: true },
      { name: "en", label: "英文標題", value: currentCategory.en },
      { name: "slug", label: "網址代碼", value: currentCategory.slug, required: true },
      { name: "intro", label: "服務頁小標語／簡介", type: "textarea", value: currentCategory.intro, full: true },
    ] });
    if (!values) return;
    return commitChange((next) => {
      const target = categoryAt(key, next);
      const slug = makeSlug(values.slug);
      if (next.some((category) => category.key !== key && category.slug === slug)) { alert("這個網址代碼已經存在，請換一個。"); return false; }
      Object.assign(target, { name: values.name.trim(), en: values.en.trim() || "SERVICE", slug, intro: values.intro.trim() });
    }, "正在更新服務分類…");
  }

  if (button.matches("[data-delete-category]")) {
    if (!confirm(`確定刪除「${currentCategory.name}」？\n\n前台服務選單、價目表與預約分類都會同步移除；既有預約紀錄不會被刪除。`)) return;
    return commitChange((next) => { const index = next.findIndex((category) => category.key === key); if (index >= 0) next.splice(index, 1); }, "正在刪除服務分類…");
  }

  if (button.matches("[data-add-group]")) {
    const values = await openForm({ title: `在 ${currentCategory.name} 新增區塊`, fields: [
      { name: "title", label: "區塊名稱", required: true },
      { name: "priceTitle", label: "價目表區塊名稱（可相同）" },
      { name: "kind", label: "區塊類型", type: "select", value: "main", options: [["main","一般服務"],["addon","加購項目"]] },
      { name: "desc", label: "區塊說明", type: "textarea", full: true },
    ], submitText: "新增區塊" });
    if (!values) return;
    return commitChange((next) => {
      categoryAt(key, next).groups.push({ id: makeCatalogId("group"), title: values.title.trim(), priceTitle: values.priceTitle.trim() || values.title.trim(), kind: values.kind, desc: values.desc.trim(), items: [] });
    }, "正在新增服務區塊…");
  }

  if (!groupId) return;
  const currentGroup = groupAt(currentCategory, groupId);
  if (!currentGroup) return;

  if (button.matches("[data-delete-group]")) {
    if (!confirm(`確定刪除「${currentGroup.title}」以及裡面的 ${currentGroup.items.length} 個項目？`)) return;
    return commitChange((next) => { const target = categoryAt(key, next); target.groups = target.groups.filter((group) => group.id !== groupId); }, "正在刪除服務區塊…");
  }

  if (button.matches("[data-add-item],[data-edit-item]")) {
    const currentItem = itemId ? itemAt(currentGroup, itemId) : null;
    const values = await openForm({ title: currentItem ? `編輯 ${currentItem.name}` : `新增${currentGroup.kind === "addon" ? "加購" : "服務"}項目`, fields: [
      { name: "name", label: "項目名稱", value: currentItem?.name || "", required: true },
      { name: "description", label: "服務頁說明", value: currentItem?.description || "", full: true },
      { name: "durationMinutes", label: "施作時間（分鐘）", type: "number", value: currentItem?.durationMinutes || 90, min: 1, max: 180, required: true },
      { name: "durationLabel", label: "顯示時間文字", value: currentItem?.durationLabel || "約 90 分鐘" },
      { name: "priceLabel", label: "價格，例如 $1399 或 視範圍", value: currentItem?.priceLabel || "", full: true },
    ], submitText: currentItem ? "儲存修改" : "新增項目" });
    if (!values) return;
    return commitChange((next) => {
      const targetGroup = groupAt(categoryAt(key, next), groupId);
      const payload = { id: currentItem?.id || makeCatalogId(currentGroup.kind === "addon" ? "addon" : "item"), name: values.name.trim(), description: values.description.trim(), durationMinutes: Number(values.durationMinutes || 90), durationLabel: values.durationLabel.trim() || `約 ${Number(values.durationMinutes || 90)} 分鐘`, priceLabel: values.priceLabel.trim(), enabled: currentItem?.enabled !== false };
      if (currentItem) Object.assign(itemAt(targetGroup, itemId), payload); else targetGroup.items.push(payload);
    }, currentItem ? "正在更新服務項目…" : "正在新增服務項目…");
  }

  if (button.matches("[data-delete-item]")) {
    const currentItem = itemAt(currentGroup, itemId);
    if (!currentItem || !confirm(`確定刪除「${currentItem.name}」？\n\n前台服務、價目與預約選項會同步移除。`)) return;
    return commitChange((next) => { const targetGroup = groupAt(categoryAt(key, next), groupId); targetGroup.items = targetGroup.items.filter((item) => item.id !== itemId); }, "正在刪除服務項目…");
  }

  if (button.matches("[data-save-price]")) {
    const value = itemNode?.querySelector("[data-price-value]")?.value ?? "";
    return commitChange((next) => { itemAt(groupAt(categoryAt(key, next), groupId), itemId).priceLabel = value.trim(); }, "正在同步價格…");
  }
}

async function handleChange(event) {
  const input = event.target;
  if (!input.closest?.(".catalog-admin-shell")) return;
  const categoryNode = input.closest("[data-category]");
  const groupNode = input.closest("[data-group]");
  const itemNode = input.closest("[data-item]");
  const key = categoryNode?.dataset.category || "";
  const groupId = groupNode?.dataset.group || "";
  const itemId = itemNode?.dataset.item || "";

  if (input.matches("[data-category-toggle]")) {
    return commitChange((next) => { categoryAt(key, next).enabled = input.checked; }, "正在更新服務開放狀態…");
  }
  if (input.matches("[data-item-toggle]")) {
    return commitChange((next) => { itemAt(groupAt(categoryAt(key, next), groupId), itemId).enabled = input.checked; }, "正在更新項目開放狀態…");
  }
}

document.addEventListener("click", handleClick, true);
document.addEventListener("change", handleChange, true);
addEventListener("hashchange", () => setTimeout(render, 0));
addEventListener("popstate", () => setTimeout(render, 0));
new MutationObserver(() => {
  const view = route();
  if (view !== "services" && view !== "pricing") return;
  const node = workspace();
  if (!node || !node.querySelector(`[data-dynamic-catalog-view="${view}"][data-catalog-version="${VERSION}"]`)) render();
}).observe(document.querySelector("#app") || document.body, { childList: true, subtree: true });

function boot() {
  render();
  const timer = setInterval(() => {
    if (!getApps().length) return;
    clearInterval(timer);
    const auth = getAuth(getApp());
    const tryStart = (user) => { if (user && !user.isAnonymous) refreshFromFirestore(); };
    tryStart(auth.currentUser);
    onAuthStateChanged(auth, tryStart);
  }, 100);
  setTimeout(() => clearInterval(timer), 20000);
}

boot();
