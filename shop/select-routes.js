import { categoryFromCollectionKey, collectionKey } from "./series.js?v=20261123-select2";

const primaryStorePath = "/77select/";

export function storeHomeHref() {
  return window.location.origin + window.location.pathname.replace(/\/index\.html$/i, "/");
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

const search = new URLSearchParams(window.location.search);

export const storeRoute = search.has("product")
  ? { view: "product", productId: search.get("product") }
  : search.has("collection")
    ? { view: "products", category: categoryFromCollectionKey(search.get("collection")) }
    : { view: "shop" };

export function canonicalStoreHref() {
  const url = new URL(primaryStorePath, window.location.origin);
  if (storeRoute.view === "product") url.searchParams.set("product", storeRoute.productId);
  if (storeRoute.view === "products") url.searchParams.set("collection", collectionKey(storeRoute.category));
  return url.href;
}
