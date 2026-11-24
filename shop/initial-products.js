import { firebaseConfig } from "../assets/firebase-config.js?v=20261026-audit1";

let initialRequest;

function firestoreValue(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 32) return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (Object.hasOwn(value, "integerValue")) {
    if (typeof value.integerValue !== "string" || !/^-?\d+$/.test(value.integerValue)) return null;
    const number = Number(value.integerValue);
    return Number.isSafeInteger(number) ? number : null;
  }
  if (Object.hasOwn(value, "doubleValue")) {
    return typeof value.doubleValue === "number" && Number.isFinite(value.doubleValue) ? value.doubleValue : null;
  }
  if (typeof value.timestampValue === "string") {
    return Number.isFinite(Date.parse(value.timestampValue)) ? value.timestampValue : null;
  }
  if (typeof value.referenceValue === "string") return value.referenceValue;
  if (value.arrayValue && typeof value.arrayValue === "object") {
    const values = value.arrayValue.values;
    return Array.isArray(values) ? values.map((item) => firestoreValue(item, depth + 1)) : [];
  }
  if (value.mapValue && typeof value.mapValue === "object") {
    return firestoreFields(value.mapValue.fields, depth + 1);
  }
  return null;
}

function firestoreFields(fields, depth = 0) {
  const result = Object.create(null);
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return result;
  for (const [key, value] of Object.entries(fields)) result[key] = firestoreValue(value, depth);
  return result;
}

// Public, active products are readable without waiting for member authentication.
// This early request is shared with the product page and never sends credentials.
async function readPublicShopProduct(productId) {
  if (typeof productId !== "string" || !productId || productId === "." || productId === ".." || productId.includes("/") || productId.length > 1500) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const projectId = firebaseConfig.projectId;
    if (typeof projectId !== "string" || !projectId) return null;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/shopProducts/${encodeURIComponent(productId)}`;
    const response = await fetch(url, {
      credentials: "omit", cache: "no-store", signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const document = await response.json();
    if (document?.fields?.active?.booleanValue !== true) return null;
    return { ...firestoreFields(document.fields), id: productId };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const requestedProductId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("product");
export const initialPublicShopProduct = requestedProductId ? readPublicShopProduct(requestedProductId) : Promise.resolve(null);

// Both storefront modules use the same public read at startup.
export function initialShopProducts(db) {
  initialRequest ??= import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js")
    .then(({ collection, getDocs, query, where }) => getDocs(query(collection(db, "shopProducts"), where("active", "==", true))));
  return initialRequest;
}
