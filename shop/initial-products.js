import { firebaseConfig } from "../assets/firebase-config.js?v=20261026-audit1";

let initialRequest;
let settingsRequest;
const productRequests = new Map();

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

const databaseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/(default)/documents`;

async function publicJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      credentials: "omit", cache: "no-store", signal: controller.signal, ...options,
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Public, active products are readable without waiting for member authentication.
export function readPublicShopProduct(productId) {
  if (typeof productId !== "string" || !productId || productId === "." || productId === ".." || productId.includes("/") || productId.length > 1500) {
    return Promise.resolve(null);
  }
  if (!productRequests.has(productId)) {
    const request = publicJson(`${databaseUrl}/shopProducts/${encodeURIComponent(productId)}`).then((document) => {
      if (document?.fields?.active?.booleanValue === true) {
        return { ...firestoreFields(document.fields), id: productId };
      }
      productRequests.delete(productId);
      return null;
    });
    productRequests.set(productId, request);
  }
  return productRequests.get(productId);
}

async function readPublicCatalog() {
  const rows = await publicJson(`${databaseUrl}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        select: { fields: ["name", "category", "sortOrder", "price", "priceHKD", "stock", "variants"].map((fieldPath) => ({ fieldPath })) },
        from: [{ collectionId: "shopProducts" }],
        where: { fieldFilter: { field: { fieldPath: "active" }, op: "EQUAL", value: { booleanValue: true } } },
      },
    }),
  });
  if (!Array.isArray(rows) || !rows.length || rows.some((row) => !row.document && !row.readTime)) return null;
  return rows.filter((row) => row.document?.name).map(({ document }) => ({
    ...firestoreFields(document.fields),
    id: document.name.split("/").pop(),
    revision: document.updateTime,
  }));
}

const requestedProductId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("product");
if (requestedProductId) readPublicShopProduct(requestedProductId);
export const initialPublicCatalog = readPublicCatalog();
export const initialPublicHomeSettings = publicJson(`${databaseUrl}/shopSettings/public?mask.fieldPaths=homeContent&mask.fieldPaths=heroTitle&mask.fieldPaths=heroEyebrow&mask.fieldPaths=heroDescription&mask.fieldPaths=storeEmail`)
  .then((document) => document?.fields ? firestoreFields(document.fields) : null);

export function initialShopSettings(db) {
  settingsRequest ??= import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js")
    .then(({ doc, getDoc }) => getDoc(doc(db, "shopSettings", "public")));
  return settingsRequest;
}

// Both storefront modules use the same public read at startup.
export function initialShopProducts(db) {
  initialRequest ??= import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js")
    .then(({ collection, getDocs, query, where }) => getDocs(query(collection(db, "shopProducts"), where("active", "==", true))));
  return initialRequest;
}
