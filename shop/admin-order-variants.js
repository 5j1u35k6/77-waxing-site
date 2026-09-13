import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { addDoc, collection, doc, getDoc, getFirestore, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_APP_NAME = "77waxing-shop-admin";
const DEFAULT_EMAIL_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const int = (value) => Math.max(0, Math.round(Number(value) || 0));
const $ = (selector, root = document) => root.querySelector(selector);

async function waitForAdminApp() {
  for (let i = 0; i < 160; i += 1) {
    const app = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME);
    if (app) return app;
    await sleep(50);
  }
  throw new Error("77select admin Firebase app did not initialize in time.");
}

function flash(message, type = "ok") {
  const el = $("#admin-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = type === "error" ? "#a64b43" : "#55745b";
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { el.textContent = ""; }, 4200);
}

function normalizeVariants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => ({
      ...variant,
      id: String(variant.id || `variant-${index + 1}`),
      name: String(variant.name || variant.label || `規格 ${index + 1}`),
      capacity: String(variant.capacity || variant.size || ""),
      priceTWD: int(variant.priceTWD ?? variant.priceTW ?? variant.price ?? product.price ?? 0),
      priceHKD: int(variant.priceHKD ?? variant.priceHK ?? product.priceHKD ?? 0),
      stock: int(variant.stock ?? 0),
    }));
  }
  return [];
}

function itemPrice(variant, item, product) {
  if (!variant) return int(product.price || item.unitPrice || 0);
  return item.region === "HK" ? int(variant.priceHKD) : int(variant.priceTWD);
}

async function audit(db, auth, action, targetId, detail = "") {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, "shopAuditLogs"), {
    adminUid: user.uid,
    adminEmail: user.email || null,
    action,
    targetId,
    detail: String(detail || "").slice(0, 1000),
    createdAt: serverTimestamp(),
  }).catch(console.warn);
}

async function dispatchShopEmail(db, auth, orderId) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const settingsSnap = await getDoc(doc(db, "shopSettings", "public")).catch(() => null);
    const url = String(settingsSnap?.data?.()?.appsScriptEmailUrl || DEFAULT_EMAIL_URL).trim() || DEFAULT_EMAIL_URL;
    const idToken = await user.getIdToken();
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kind: "shop_order", orderId, idToken }),
    }).catch(() => {});
  } catch (error) {
    console.warn("77select order email dispatch failed", error);
  }
}

async function confirmVariantOrder(db, orderId) {
  const orderRef = doc(db, "shopOrders", orderId);
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("找不到訂單。");
    const order = orderSnap.data();
    if (order.status !== "pending") throw new Error("只有待確認訂單可以確認。");
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) throw new Error("訂單沒有商品內容。");

    const ids = [...new Set(items.map((item) => String(item.productId || "")).filter(Boolean))];
    const productMap = new Map();
    for (const productId of ids) {
      const ref = doc(db, "shopProducts", productId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`商品 ${productId} 不存在。`);
      const data = snap.data();
      productMap.set(productId, { ref, data, variants: normalizeVariants(data), legacyStock: int(data.stock) });
    }

    let subtotal = 0;
    const finalItems = [];
    for (const item of items) {
      const entry = productMap.get(String(item.productId || ""));
      if (!entry) throw new Error(`商品「${item.name || item.productId}」不存在。`);
      const product = entry.data;
      if (!product.active) throw new Error(`商品「${product.name}」目前已下架。`);
      const quantity = Math.max(1, int(item.quantity));

      let variant = null;
      if (item.variantId && entry.variants.length) variant = entry.variants.find((row) => row.id === item.variantId) || null;
      if (item.variantId && !variant) throw new Error(`商品「${product.name}」的指定規格已不存在。`);

      if (variant) {
        if (variant.stock < quantity) throw new Error(`「${product.name}｜${variant.name}${variant.capacity ? ` ${variant.capacity}` : ""}」庫存不足，目前 ${variant.stock} 件。`);
        variant.stock -= quantity;
      } else {
        if (entry.legacyStock < quantity) throw new Error(`商品「${product.name}」庫存不足，目前 ${entry.legacyStock} 件。`);
        entry.legacyStock -= quantity;
      }

      const unitPrice = itemPrice(variant, item, product);
      subtotal += unitPrice * quantity;
      finalItems.push({
        productId: String(item.productId || ""),
        variantId: variant?.id || item.variantId || null,
        name: product.name || item.name || "商品",
        variantName: variant?.name || item.variantName || "",
        capacity: variant?.capacity || item.capacity || "",
        region: item.region || "TW",
        currency: item.currency || (item.region === "HK" ? "HKD" : "TWD"),
        quantity,
        unitPrice,
        imageUrl: product.imageUrl || item.imageUrl || "",
      });
    }

    for (const entry of productMap.values()) {
      if (entry.variants.length) {
        const stock = entry.variants.reduce((sum, variant) => sum + int(variant.stock), 0);
        tx.update(entry.ref, { variants: entry.variants, stock, updatedAt: serverTimestamp() });
      } else {
        tx.update(entry.ref, { stock: entry.legacyStock, updatedAt: serverTimestamp() });
      }
    }

    const shippingFee = int(order.shippingFee);
    tx.update(orderRef, {
      items: finalItems,
      subtotal,
      total: subtotal + shippingFee,
      status: "confirmed",
      inventoryCommitted: true,
      updatedAt: serverTimestamp(),
    });
  });
}

async function cancelVariantOrder(db, orderId) {
  const orderRef = doc(db, "shopOrders", orderId);
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("找不到訂單。");
    const order = orderSnap.data();
    if (["completed", "cancelled"].includes(order.status)) throw new Error("此訂單目前不可取消。");
    const items = Array.isArray(order.items) ? order.items : [];

    if (order.inventoryCommitted) {
      const ids = [...new Set(items.map((item) => String(item.productId || "")).filter(Boolean))];
      const productMap = new Map();
      for (const productId of ids) {
        const ref = doc(db, "shopProducts", productId);
        const snap = await tx.get(ref);
        if (!snap.exists()) continue;
        const data = snap.data();
        productMap.set(productId, { ref, data, variants: normalizeVariants(data), legacyStock: int(data.stock) });
      }

      for (const item of items) {
        const entry = productMap.get(String(item.productId || ""));
        if (!entry) continue;
        const quantity = Math.max(1, int(item.quantity));
        const variant = item.variantId && entry.variants.length ? entry.variants.find((row) => row.id === item.variantId) : null;
        if (variant) variant.stock += quantity;
        else entry.legacyStock += quantity;
      }

      for (const entry of productMap.values()) {
        if (entry.variants.length) {
          const stock = entry.variants.reduce((sum, variant) => sum + int(variant.stock), 0);
          tx.update(entry.ref, { variants: entry.variants, stock, updatedAt: serverTimestamp() });
        } else {
          tx.update(entry.ref, { stock: entry.legacyStock, updatedAt: serverTimestamp() });
        }
      }
    }

    tx.update(orderRef, { status: "cancelled", inventoryCommitted: false, updatedAt: serverTimestamp() });
  });
}

const app = await waitForAdminApp();
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-order][data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action !== "confirm" && action !== "cancel") return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.disabled) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = action === "confirm" ? "確認中…" : "取消中…";

  try {
    if (action === "confirm") await confirmVariantOrder(db, button.dataset.order);
    else await cancelVariantOrder(db, button.dataset.order);
    await audit(db, auth, `order_${action}_variants`, button.dataset.order);
    await dispatchShopEmail(db, auth, button.dataset.order);
    flash(action === "confirm" ? "訂單已確認，規格庫存已正確扣減。" : "訂單已取消，規格庫存已回補。");
  } catch (error) {
    console.error("77select variant order action failed", error);
    flash(error?.message || "更新訂單失敗。", "error");
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}, true);
