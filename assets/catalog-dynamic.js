import { loadCatalog, publicCatalog, watchCatalog } from "./service-catalog-store.js?v=20260912-1330";

const B = "/77-waxing-site";
const CACHE_KEY = "77waxing-public-catalog-v1";
let catalog = [];
let scheduled = false;
let rendering = false;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const app = () => document.querySelector("#app");
const normalizedPath = () => {
  let path = location.pathname.startsWith(B) ? location.pathname.slice(B.length) : location.pathname;
  if (!path.startsWith("/")) path = `/${path}`;
  if (path !== "/" && !path.endsWith("/")) path += "/";
  return path;
};
const servicePath = (service) => `${B}/services/${service.slug}/`;
const serviceByPath = () => catalog.find((service) => normalizedPath() === `/services/${service.slug}/`);

function readCachedCatalog() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? publicCatalog(parsed) : [];
  } catch {
    return [];
  }
}

function writeCachedCatalog(next) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
}

function renderLoading() {
  const root = app();
  if (!root || root.querySelector("[data-catalog-loading]")) return;
  const path = normalizedPath();
  if (path !== "/menu/" && path !== "/services/" && !path.startsWith("/services/")) return;
  root.innerHTML = `<section class="section" data-catalog-loading><div class="wrap narrow"><span class="tag">${path === "/menu/" ? "MENU" : "SERVICES"}</span><p class="muted">正在載入最新服務內容…</p></div></section>`;
}

function markHeader() {
  const nav = document.querySelector(".header nav");
  if (!nav) return;
  const path = normalizedPath();
  nav.querySelectorAll(":scope > a").forEach((link) => link.classList.remove("on"));
  if (path.startsWith("/services/")) [...nav.querySelectorAll("a")].find((link) => link.querySelector(".nav-zh")?.textContent.trim() === "服務")?.classList.add("on");
  if (path === "/menu/") [...nav.querySelectorAll("a")].find((link) => link.querySelector(".nav-zh")?.textContent.trim() === "價目")?.classList.add("on");
}

function serviceSwitcher(activeKey) {
  return `<nav class="service-switcher" aria-label="其他服務項目">${catalog.map((service) => `<a href="${servicePath(service)}" data-catalog-link class="${service.key === activeKey ? "on" : ""}">${esc(service.name)}</a>`).join("")}</nav>`;
}

function renderService(service) {
  const root = app(); if (!root) return;
  rendering = true;
  root.dataset.catalogPath = normalizedPath();
  root.dataset.dynamicCatalog = "1";
  const groups = service.groups.filter((group) => group.items.length);
  root.innerHTML = `<div class="catalog-page" data-catalog-page="service"><section class="catalog-hero"><div class="wrap"><span class="tag">${esc(service.en)}</span><h1>${esc(service.name)}</h1><p class="lead muted">${esc(service.intro)}</p>${serviceSwitcher(service.key)}</div></section><section class="service-detail-section"><div class="wrap">${groups.map((group) => `<div class="service-group" data-service-group="${esc(group.id)}" data-service-kind="${esc(group.kind)}"><div class="service-group-head"><div><span class="tag">${group.kind === "addon" ? "ADD ON" : "SERVICE"}</span><h2>${esc(group.title)}</h2></div>${group.desc ? `<p class="muted">${esc(group.desc)}</p>` : ""}</div><div class="service-item-grid">${group.items.map((item) => `<article class="service-item-card" data-service-item-id="${esc(item.id)}"><h3>${esc(item.name)}</h3>${item.description ? `<p>${esc(item.description)}</p>` : ""}${item.durationLabel ? `<span class="duration">${esc(item.durationLabel)}</span>` : ""}</article>`).join("")}</div></div>`).join("")}<div class="catalog-actions"><a class="btn dark" href="${B}/booking/">立即預約</a><a class="btn" href="${B}/menu/" data-catalog-link>查看價目</a></div></div></section></div>`;
  markHeader();
  rendering = false;
  if (location.hash.startsWith("#item=")) setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 0);
}

function renderPrice() {
  const root = app(); if (!root) return;
  rendering = true;
  root.dataset.catalogPath = normalizedPath();
  root.dataset.dynamicCatalog = "1";
  root.innerHTML = `<div class="price-page" data-catalog-page="price"><section class="pagehero price-hero"><div class="wrap narrow"><span class="tag">MENU</span><h1>價目表</h1><p class="lead muted">依服務項目依序整理。可用上方分類按鈕快速移動到指定區塊。</p></div></section><div class="price-jump-shell"><nav class="price-jump" aria-label="價目分類">${catalog.map((service, index) => `<button type="button" data-price-jump="price-${esc(service.key)}" class="${index === 0 ? "on" : ""}">${esc(service.name)}</button>`).join("")}</nav></div><section class="price-sections"><div class="wrap narrow">${catalog.map((service) => `<section id="price-${esc(service.key)}" class="price-section" data-price-section="${esc(service.key)}" data-service-slug="${esc(service.slug)}"><div class="price-section-title"><h2>${esc(service.name)}</h2><small>${esc(service.en)}</small></div>${service.groups.filter((group) => group.items.length).map((group) => `<div class="price-group" data-price-kind="${esc(group.kind)}"><h3>${esc(group.priceTitle || group.title)}</h3><div class="price-list">${group.items.map((item) => `<div class="price-row" data-price-item-id="${esc(item.id)}"><b>${esc(item.name)}</b><span class="price">${esc(item.priceLabel || "—")}</span>${item.durationLabel && (group.kind !== "main" || item.durationMinutes !== 90) ? `<p>${esc(item.durationLabel)}</p>` : ""}</div>`).join("")}</div></div>`).join("")}${service.notes?.length ? `<div class="price-note">${service.notes.map((note) => `<div>｜${esc(note)}</div>`).join("")}</div>` : ""}</section>`).join("")}</div></section></div>`;
  bindPriceJump();
  markHeader();
  rendering = false;
  if (location.hash.startsWith("#price-")) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

function bindPriceJump() {
  document.querySelectorAll("[data-price-jump]").forEach((button) => {
    button.onclick = () => {
      const target = document.getElementById(button.dataset.priceJump);
      if (!target) return;
      document.querySelectorAll("[data-price-jump]").forEach((entry) => entry.classList.toggle("on", entry === button));
      history.replaceState(null, "", `${location.pathname}#${button.dataset.priceJump}`);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });
}

function syncServiceMenus() {
  const html = catalog.map((service) => `<a href="${servicePath(service)}" data-catalog-link><span>${esc(service.name)}</span><small>${esc(service.en)}</small></a>`).join("");
  const flyout = document.querySelector(".header nav .service-flyout");
  if (flyout && flyout.dataset.dynamicCatalog !== "1") { flyout.innerHTML = html; flyout.dataset.dynamicCatalog = "1"; }
  const dropdown = document.querySelector(".header nav .service-dropdown");
  if (dropdown) {
    const current = serviceByPath();
    dropdown.innerHTML = catalog.map((service) => `<a href="${servicePath(service)}" data-catalog-link class="${service.key === current?.key ? "on" : ""}"><strong>${esc(service.name)}</strong><small>${esc(service.en)}</small></a>`).join("");
    dropdown.dataset.dynamicCatalog = "1";
  }
}

function syncHomeCards() {
  if (normalizedPath() !== "/") return;
  const sections = [...document.querySelectorAll("#app .section")];
  const section = sections.find((node) => node.querySelector(".tag")?.textContent.trim() === "START HERE");
  const grid = section?.querySelector(".grid4");
  if (!grid || grid.dataset.dynamicCatalog === "1") return;
  const known = {
    women: "VIO 私密處、腋下、四肢與細部熱蠟整理",
    men: "男士私密處、胸腹背、四肢與細部熱蠟整理",
    skin: "臉部、粉刺、撥筋與身體肌膚保養",
    bust: "依時間與需求選擇不同美胸保養流程",
  };
  grid.innerHTML = catalog.map((service, index) => `<article class="card"><div class="num">${String(index + 1).padStart(2, "0")}</div><h3>${esc(service.name)}</h3><p>${esc(known[service.key] || service.intro || "查看服務項目與內容")}</p><a href="${servicePath(service)}" data-catalog-link>了解服務 →</a></article>`).join("");
  grid.dataset.dynamicCatalog = "1";
}

function renderCurrent(force = false) {
  if (rendering) return;
  if (!catalog.length) { renderLoading(); return; }
  syncServiceMenus();
  syncHomeCards();
  const root = app(); if (!root) return;
  const path = normalizedPath();
  if (path === "/services/") {
    history.replaceState(null, "", servicePath(catalog[0]));
  }
  const service = serviceByPath() || (path === "/services/" ? catalog[0] : null);
  if (service) {
    if (!force && root.dataset.dynamicCatalog === "1" && root.dataset.catalogPath === normalizedPath() && root.querySelector('[data-catalog-page="service"]')) return;
    renderService(service);
    return;
  }
  if (path === "/menu/") {
    if (!force && root.dataset.dynamicCatalog === "1" && root.dataset.catalogPath === path && root.querySelector('[data-catalog-page="price"]')) return;
    renderPrice();
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; renderCurrent(); });
}

async function start() {
  const cached = readCachedCatalog();
  if (cached.length) {
    catalog = cached;
    renderCurrent(true);
  } else {
    renderLoading();
  }

  const fresh = publicCatalog(await loadCatalog());
  catalog = fresh;
  writeCachedCatalog(fresh);
  renderCurrent(true);

  await watchCatalog((next) => {
    const publicNext = publicCatalog(next);
    catalog = publicNext;
    writeCachedCatalog(publicNext);
    document.querySelectorAll("[data-dynamic-catalog]").forEach((node) => delete node.dataset.dynamicCatalog);
    renderCurrent(true);
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest?.("a[data-catalog-link]");
  if (!link) return;
  let url;
  try { url = new URL(link.href, location.href); } catch { return; }
  if (url.origin !== location.origin || !url.pathname.startsWith(B)) return;
  const relative = url.pathname.slice(B.length) || "/";
  if (relative !== "/menu/" && relative !== "/services/" && !relative.startsWith("/services/")) return;
  event.preventDefault();
  history.pushState(null, "", url.pathname + url.search + url.hash);
  renderCurrent(true);
  if (!url.hash) requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}, true);

new MutationObserver(() => schedule()).observe(document.querySelector("#app") || document.body, { childList: true, subtree: true });
addEventListener("popstate", () => setTimeout(() => renderCurrent(true), 0));
addEventListener("hashchange", () => schedule());
start().catch((error) => console.error("77waxing dynamic catalog failed", error));
