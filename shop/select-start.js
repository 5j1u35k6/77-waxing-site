import { allProducts, catalogCategories, catalogCategory, categoryFromCollectionKey, filterProducts } from "./series.js?v=20261124-series1";
import { collectionHref, enableStoreNavigation, storeHomeHref, storeRoute } from "./select-routes.js?v=20261124-speed2";
import { renderSelectCatalogSlogan, renderSelectHomeSettings } from "./select-home-content.js?v=20261125-review1";
import { setStorePageMetadata } from "./seo.js?v=20261125-brand1";
import { initialPublicCatalog, initialPublicHomeSettings, readPublicShopProduct } from "./initial-products.js?v=20261124-series-ready";
import { catalogPriceText, compareProducts, normalizeVariants, primaryImage } from "./select-catalog-model.js?v=20261124-series-ready";
import { catalogThumbnailById } from "./select-catalog-thumbnails.js?v=20261124-series-ready";
import { selectProductCard } from "./select-product-card.js?v=20261124-series-ready";
import { initialMarket } from "./select-market.js?v=20261124-series-ready";

const grid = document.querySelector("#product-grid");
const title = document.querySelector("#shop-catalog-title");
const details = document.querySelector("#product-detail-body");
let catalogReady = false;
let routeVersion = 0;
let failureTimer;
let authoritativeHomeApplied = false;

export function setStoreView(name) {
  document.documentElement.dataset.selectRoute = name;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("on", button.dataset.tab === name));
  document.querySelectorAll("[data-view]").forEach((section) => section.classList.toggle("hidden", section.dataset.view !== name));
  document.querySelectorAll(".select-nav [data-tab], .select-nav [data-select-nav]").forEach((link) => {
    const active = (link.dataset.tab || link.dataset.selectNav) === name;
    link.classList.toggle("on", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function applyStoreHomeSettings(settings, authoritative = false) {
  if (!settings || (!authoritative && authoritativeHomeApplied)) return;
  authoritativeHomeApplied ||= authoritative;
  for (const [id, value] of Object.entries({
    "hero-title": settings.heroTitle,
    "hero-eyebrow": settings.heroEyebrow,
    "hero-description": settings.heroDescription,
    "store-email-link": settings.storeEmail,
  })) {
    const el = document.getElementById(id);
    if (el && typeof value === "string" && value.trim()) el.textContent = value;
  }
  if (settings.storeEmail) document.getElementById("store-email-link").href = `mailto:${settings.storeEmail}`;
  renderSelectHomeSettings(settings.homeContent);
  document.documentElement.classList.remove("shop-hero-pending");
}

function thumbnail(product) {
  const match = catalogThumbnailById[product.id];
  return match && match.revision === product.revision ? new URL(match.file, import.meta.url).href : "";
}

async function loadCard(product) {
  const fastImage = thumbnail(product);
  if (fastImage) return { ...product, imageUrl: fastImage };
  // A changed or newly published product must get its current cover.
  const live = await readPublicShopProduct(product.id);
  return live && { ...live, imageUrl: primaryImage(live) };
}

function showFailure(panel, view) {
  if (view === "product") {
    details.querySelector(".select-product-placeholder")?.remove();
    details.setAttribute("aria-busy", "false");
  }
  grid.removeAttribute("aria-busy");
  panel.hidden = false;
}

async function showCatalogPreview(version, category, panel) {
  const rows = await initialPublicCatalog;
  if (!rows || catalogReady || version !== routeVersion) return;
  const ordered = filterProducts(rows, category).sort(compareProducts);
  const [market, cards] = await Promise.all([initialMarket, Promise.all(ordered.map(loadCard))]);
  // Let the full catalog resolve any rows that could not be checked.
  if (catalogReady || version !== routeVersion || cards.some((card) => !card)) return;
  const filters = document.querySelector("#category-filters");
  filters.replaceChildren(...catalogCategories(rows).map((name) => {
    const link = document.createElement("a");
    link.className = `filter-btn${name === category ? " on" : ""}`;
    link.href = collectionHref(name);
    link.dataset.category = name;
    link.textContent = name;
    if (name === category) link.setAttribute("aria-current", "page");
    return link;
  }));
  grid.innerHTML = cards.length ? cards.map((product, index) => selectProductCard(product, catalogPriceText(product, market), {
    regional: true,
    soldOut: !normalizeVariants(product).some((variant) => variant.stock > 0),
    priority: index === 0,
  })).join("") : `<div class="empty-state" data-regional-empty>${category === allProducts ? "目前沒有可訂購的商品。" : "此系列目前尚無商品。"}</div>`;
  window.clearTimeout(failureTimer);
  grid.removeAttribute("aria-busy");
  panel.hidden = true;
}

function showRoute(route, { source } = {}) {
  const version = ++routeVersion;
  window.clearTimeout(failureTimer);
  const panel = document.querySelector(`[data-view="${route.view}"] [data-product-load-panel]`);
  if (panel) panel.hidden = true;
  if (route.view === "products") {
    title.textContent = route.category === allProducts ? "商品目錄" : route.category;
    renderSelectCatalogSlogan();
  }
  if (!catalogReady && panel) {
    if (route.view === "products") {
      grid.replaceChildren();
      grid.setAttribute("aria-busy", "true");
      showCatalogPreview(version, route.category, panel);
    }
    failureTimer = window.setTimeout(() => showFailure(panel, route.view), 12000);
  }
  setStoreView(route.view);
  setStorePageMetadata();
  window.dispatchEvent(new Event("77select:route-change"));
  if (source === "click") {
    window.scrollTo({ top: 0, behavior: "instant" });
    (route.view === "product" ? document.querySelector("#product-page-title") : route.view === "products" ? title : null)
      ?.focus({ preventScroll: true });
  }
}

document.querySelectorAll("a[data-shop-home-link]").forEach((link) => {
  link.href = storeHomeHref() + link.hash;
});
document.querySelectorAll("a[data-shop-collection]").forEach((link) => {
  link.href = collectionHref(categoryFromCollectionKey(link.dataset.shopCollection));
});
document.querySelectorAll("[data-product-load-retry]").forEach((button) => {
  button.addEventListener("click", () => window.location.reload());
});
window.addEventListener("77select:catalog-ready", () => {
  catalogReady = true;
  window.clearTimeout(failureTimer);
  grid.removeAttribute("aria-busy");
  document.querySelectorAll("[data-product-load-panel]").forEach((panel) => { panel.hidden = true; });
});
window.addEventListener("77select:catalog-unavailable", () => {
  // A healthy lightweight catalog can still display its verified cards.
  const route = storeRoute;
  if (route.view === "product") {
    showFailure(document.querySelector('[data-view="product"] [data-product-load-panel]'), route.view);
  } else if (route.view === "products") {
    const version = routeVersion;
    initialPublicCatalog.then((rows) => {
      if (!rows && version === routeVersion) {
        showFailure(document.querySelector('[data-view="products"] [data-product-load-panel]'), route.view);
      }
    });
  }
});
initialPublicHomeSettings.then((settings) => applyStoreHomeSettings(settings));
initialPublicCatalog.then((products) => {
  if (!products || storeRoute.view !== "shop") return;
  const warmed = new Set();
  for (const product of products.sort(compareProducts)) {
    const url = thumbnail(product);
    const category = catalogCategory(product.category);
    if (!url || warmed.has(category)) continue;
    const image = new Image();
    image.fetchPriority = "low";
    image.src = url;
    warmed.add(category);
  }
});
showRoute(storeRoute);
enableStoreNavigation(showRoute);
window.dispatchEvent(new Event("77select:navigation-ready"));
