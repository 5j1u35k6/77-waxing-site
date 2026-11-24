import { categoryFromCollectionKey, collectionKey } from "./series.js?v=20261124-series1";

const primaryStorePath = "/77select/";
const storeLinks = [
  "a[data-shop-home-link]", "a[data-shop-collection]", "a[data-regional-detail]",
  "a.select-catalog-card-link", "a.select-featured-product", "#category-filters a[data-category]",
  ".select-product-breadcrumb a", ".select-product-add-on a", ".select-related-heading a",
  ".select-product-unavailable a",
].join(",");

const storePath = (pathname) => pathname.replace(/\/index\.html$/i, "/");

export function storeHomeHref() {
  return window.location.origin + storePath(window.location.pathname);
}

function storeHref(param, value) {
  return `${storeHomeHref()}?${new URLSearchParams([[param, value]])}`;
}

export function collectionHref(category) {
  return storeHref("collection", collectionKey(category));
}

export function productHref(id) {
  return storeHref("product", id);
}

function routeFromUrl(url) {
  const search = url.searchParams;
  if (search.has("product")) return { view: "product", productId: search.get("product") };
  if (search.has("collection")) return { view: "products", category: categoryFromCollectionKey(search.get("collection")) };
  return { view: "shop" };
}

export let storeRoute = routeFromUrl(new URL(window.location.href));

function hasStoreQuery(url) {
  const entries = [...url.searchParams];
  if (!entries.length) return true;
  const [name, value] = entries[0];
  return entries.length === 1 && Boolean(value) && (name === "product" || name === "collection");
}

export function enableStoreNavigation(onRouteChange) {
  const home = new URL(storeHomeHref());
  const isStoreUrl = (url) => url.origin === home.origin && storePath(url.pathname) === home.pathname;
  const routeLocation = (url) => storePath(url.pathname) + url.search;
  let lastLocation = routeLocation(new URL(window.location.href));

  function showRoute(url, source) {
    lastLocation = routeLocation(url);
    storeRoute = routeFromUrl(url);
    onRouteChange(storeRoute, { source, url });
  }

  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.(storeLinks);
    const href = link?.getAttribute("href")?.trim();
    if (!href || href.startsWith("#") || link.hasAttribute("download")) return;
    const target = link.getAttribute("target") || document.querySelector("base[target]")?.getAttribute("target");
    if (target && target.toLowerCase() !== "_self") return;

    let url;
    try { url = new URL(link.href); }
    catch { return; }
    if (!isStoreUrl(url) || href.includes("#") || !hasStoreQuery(url)) return;
    if (window.location.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
    if (url.href !== window.location.href) {
      try { window.history.pushState(null, "", url.href); }
      catch { return; }
    }
    event.preventDefault();
    showRoute(url, "click");
  }

  function handleHistory() {
    const url = new URL(window.location.href);
    if (isStoreUrl(url) && routeLocation(url) !== lastLocation) showRoute(url, "history");
  }

  document.addEventListener("click", handleClick);
  window.addEventListener("popstate", handleHistory);
  return () => {
    document.removeEventListener("click", handleClick);
    window.removeEventListener("popstate", handleHistory);
  };
}

export function canonicalStoreHref() {
  const url = new URL(primaryStorePath, window.location.origin);
  if (storeRoute.view === "product") url.searchParams.set("product", storeRoute.productId);
  if (storeRoute.view === "products") url.searchParams.set("collection", collectionKey(storeRoute.category));
  return url.href;
}
