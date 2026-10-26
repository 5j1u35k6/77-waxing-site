import { operationErrorText } from "../assets/interface-copy.js?v=20261026-audit1";
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
  if (type === "error") message = operationErrorText(message, "目前無法儲存變更，請確認管理員登入狀態與網路後再試。");
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
      bulkMinQty: int(variant.bulkMinQty ?? variant.quantityDiscountMin ?? 0),
      bulkPriceTWD: int(variant.bulkPriceTWD ?? variant.quantityDiscountTWD ?? 0),
      bulkPriceHKD: int(variant.bulkPriceHKD ?? variant.quantityDiscountHKD ?? 0),
    }));
  }
  return [];
}

function basePrice(variant, item, product) {
  if (!variant) return int(item.region === "HK" ? (product.priceHKD ?? product.price ?? 0) : (product.price ?? 0));
  return item.region === "HK" ? int(variant.priceHKD) : int(variant.priceTWD);
}

function itemPrice(variant, item, product, quantity) {
  const regular = basePrice(variant, item, product);
  if (!variant) return regular;
  const threshold = int(variant.bulkMinQty);
  const bulk = item.region === "HK" ? int(variant.bulkPriceHKD) : int(variant.bulkPriceTWD);
  if (threshold >= 2 && int(quantity) >= threshold && bulk > 0 && bulk <= regular) return bulk;
  return regular;
}

function productImage(product, variantId = "") {
  const media = Array.isArray(product.media) ? product.media
    .map((row, index) => ({
      url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
      variantId: String(row?.variantId || ""),
      sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
    }))
    .filter((row) => row.url)
    .sort((a, b) => a.sortOrder - b.sortOrder) : [];
  if (media.length) {
    const shared = media.filter((row) => !row.variantId);
    const specific = media.filter((row) => row.variantId === variantId);
    return [...shared, ...specific][0]?.url || media[0].url;
  }
  return product.imageUrl || "";
}

function checkedPromotionTotal(order, finalItems, shopSettings) {
  const original = Array.isArray(order.items) ? order.items : [];
  const summary = original[0]?.promotionSummary;
  const invalid = () => { throw new Error("此訂單的商品價格或促銷內容已變更，請先與客人確認後再接單。"); };
  if (!summary || !Array.isArray(summary.adjustments) || !Array.isArray(summary.gifts)) return invalid();
  if (finalItems.some((item, index) => Number(original[index]?.unitPrice) !== item.unitPrice)) return invalid();
  const regularItems = finalItems.filter(item => !item.isGift);
  if (!regularItems.length) return invalid();
  const subtotal = regularItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const available = regularItems.map(item => ({ item, remaining: item.quantity }));
  const expectedAdjustments = [];
  const expectedGifts = [];
  const code = regularItems[0].region;
  if (finalItems.some(item => item.region !== code)) return invalid();
  const amount = (promo, tw, hk) => int(promo.discount?.[code === "HK" ? hk : tw]);
  const promotions = Array.isArray(shopSettings?.promotions) ? shopSettings.promotions : [];
  for (const [index, promo] of promotions.entries()) {
    if (!promo || promo.active === false) continue;
    const type = promo.promotionType;
    const groups = Array.isArray(promo.groups) ? promo.groups : [];
    const any = type === "any_qty_bundle";
    if (any ? !groups[0]?.items?.length || int(groups[0].minQty) < 2 : groups.length < 2 || groups.slice(0, 2).some(group => !group?.items?.length)) continue;
    if (!["any_qty_bundle", "bundle_price", "percent_off", "amount_off", "gift"].includes(type)) continue;
    let setCount = 0, regularTotal = 0, discountTotal = 0;
    while (true) {
      const picked = [];
      let complete = true;
      for (const group of (any ? groups.slice(0, 1) : groups.slice(0, 2))) {
        for (let count = 0; count < Math.max(any ? 2 : 1, int(group.minQty || 1)); count += 1) {
          const eligible = available.filter(entry => entry.remaining > 0 && group.items.some(item =>
            String(item.productId || "") === entry.item.productId && String(item.variantId || "default") === String(entry.item.variantId || "default")));
          const best = eligible.reduce((best, entry) => !best || entry.item.unitPrice > best.item.unitPrice ? entry : best, null);
          if (!best) { complete = false; break; }
          best.remaining -= 1;
          picked.push(best);
        }
        if (!complete) break;
      }
      const regular = picked.reduce((sum, entry) => sum + entry.item.unitPrice, 0);
      let discount = 0;
      if (any || type === "bundle_price") {
        const price = amount(promo, "bundlePriceTWD", "bundlePriceHKD");
        discount = price > 0 ? Math.max(0, regular - price) : 0;
      } else if (type === "percent_off") {
        discount = Math.round(regular * Math.min(99, Math.max(1, int(promo.discount?.percentOff))) / 100);
      } else if (type === "amount_off") discount = Math.min(regular, amount(promo, "amountTWD", "amountHKD"));
      if (!complete || (type !== "gift" && discount <= 0)) {
        picked.forEach(entry => { entry.remaining += 1; });
        break;
      }
      setCount += 1;
      regularTotal += regular;
      discountTotal += discount;
    }
    const id = String(promo.id || `promo-${index + 1}`);
    if (discountTotal > 0) expectedAdjustments.push({ id, type, setCount, amount: discountTotal, regularTotal });
    if (type === "gift" && promo.gift && setCount > 0) expectedGifts.push({
      promotionId: id, productId: String(promo.gift.productId || ""),
      variantId: String(promo.gift.variantId || "default"), quantity: Math.max(1, int(promo.gift.quantity || 1)) * setCount,
    });
  }
  const adjustmentKey = rows => JSON.stringify(rows.map(row => [row.id, row.type, Number(row.setCount), Number(row.amount), Number(row.regularTotal)]));
  const giftKey = rows => JSON.stringify(rows.map(row => [row.promotionId, row.productId, String(row.variantId || "default"), Number(row.quantity)]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const discount = Math.min(subtotal, expectedAdjustments.reduce((sum, row) => sum + row.amount, 0));
  const giftItems = finalItems.filter(item => item.isGift);
  if (adjustmentKey(summary.adjustments) !== adjustmentKey(expectedAdjustments)
      || giftKey(summary.gifts) !== giftKey(expectedGifts) || giftKey(giftItems) !== giftKey(expectedGifts)
      || Number(summary.subtotalBeforePromotions) !== subtotal || Number(summary.discountTotal) !== discount
      || Number(order.subtotal) !== subtotal - discount || Number(order.total) !== subtotal - discount + int(order.shippingFee)) return invalid();
  finalItems[0].promotionSummary = summary;
  return subtotal - discount;
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
    const [settingsSnap,idToken] = await Promise.all([getDoc(doc(db, "shopSettings", "public")).catch(() => null),user.getIdToken()]);
    const url = String(settingsSnap?.data?.()?.appsScriptEmailUrl || DEFAULT_EMAIL_URL).trim() || DEFAULT_EMAIL_URL;
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
    const hasPromotion = Boolean(items[0]?.promotionSummary || items.some(item => item.isGift));
    const promotionSettings = hasPromotion ? await tx.get(doc(db, "shopSettings", "public")) : null;

    const ids = [...new Set(items.map((item) => String(item.productId || "")).filter(Boolean))];
    const productMap = new Map();
    const snapshots = await Promise.all(ids.map(productId => tx.get(doc(db, "shopProducts", productId))));
    for (const [index, productId] of ids.entries()) {
      const ref = doc(db, "shopProducts", productId);
      const snap = snapshots[index];
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
      if (item.variantId && !variant && (entry.variants.length || item.variantId !== "default")) throw new Error(`商品「${product.name}」的指定規格已不存在。`);

      if (variant) {
        if (variant.stock < quantity) throw new Error(`「${product.name}｜${variant.name}${variant.capacity ? ` ${variant.capacity}` : ""}」庫存不足，目前 ${variant.stock} 件。`);
        variant.stock -= quantity;
      } else {
        if (entry.legacyStock < quantity) throw new Error(`商品「${product.name}」庫存不足，目前 ${entry.legacyStock} 件。`);
        entry.legacyStock -= quantity;
      }

      const listUnitPrice = basePrice(variant, item, product);
      const unitPrice = item.isGift ? 0 : itemPrice(variant, item, product, quantity);
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
        listUnitPrice,
        unitPrice,
        discountApplied: unitPrice < listUnitPrice,
        bulkMinQty: variant?.bulkMinQty || 0,
        imageUrl: productImage(product, variant?.id || item.variantId || ""),
        ...(item.isGift ? { isGift: true, promotionId: item.promotionId || "", promotionTitle: item.promotionTitle || "" } : {}),
      });
    }

    if (hasPromotion) subtotal = checkedPromotionTotal(order, finalItems, promotionSettings?.exists() ? promotionSettings.data() : {});

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
      cancellationReason: null,
      updatedAt: serverTimestamp(),
    });
  });
}

async function cancelVariantOrder(db, orderId, reason) {
  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw new Error("取消訂單時必須填寫原因。");
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
      const snapshots = await Promise.all(ids.map(productId => tx.get(doc(db, "shopProducts", productId))));
      for (const [index, productId] of ids.entries()) {
        const ref = doc(db, "shopProducts", productId);
        const snap = snapshots[index];
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

    tx.update(orderRef, {
      status: "cancelled",
      inventoryCommitted: false,
      cancellationReason: cleanReason.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  });
}

function polishOrderUi() {
  const actionLabels = {
    confirm: "已接單",
    packing: "處理中",
    ready: "已準備完成・待取貨",
    cancel: "已取消",
  };
  document.querySelectorAll("[data-order][data-action]").forEach((button) => {
    if (button.disabled) return;
    const label = actionLabels[button.dataset.action];
    if (label && button.textContent.trim() !== label) button.textContent = label;
  });

  const statusLabels = {
    "待確認": "待接單",
    "已確認": "已接單",
    "備貨中": "處理中",
    "待自取": "已準備完成・待取貨",
  };
  document.querySelectorAll(".admin-table .status").forEach((status) => {
    const next = statusLabels[status.textContent.trim()];
    if (next) status.textContent = next;
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

  let cancellationReason = "";
  if (action === "cancel") {
    const input = window.prompt("請輸入取消原因（客人會在訂單頁看到，Email 通知也會使用這段文字）：", "");
    if (input === null) return;
    cancellationReason = input.trim();
    if (!cancellationReason) {
      flash("取消訂單時必須填寫原因。", "error");
      return;
    }
  }

  button.disabled = true;
  const original = button.textContent;
  button.textContent = action === "confirm" ? "接單中…" : "取消中…";

  try {
    if (action === "confirm") await confirmVariantOrder(db, button.dataset.order);
    else await cancelVariantOrder(db, button.dataset.order, cancellationReason);
    await Promise.all([
      audit(db, auth, `order_${action}_variants`, button.dataset.order, cancellationReason),
      dispatchShopEmail(db, auth, button.dataset.order),
    ]);
    flash(action === "confirm" ? "訂單已接單，規格庫存與數量優惠已重新核對。" : "訂單已取消，原因已儲存並同步給客人。 ");
  } catch (error) {
    console.error("77select variant order action failed", error);
    flash(error?.message || "更新訂單失敗。", "error");
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = original;
      polishOrderUi();
    }
  }
}, true);

let polishScheduled = false;
const polishObserver = new MutationObserver(() => {
  if (polishScheduled) return;
  polishScheduled = true;
  requestAnimationFrame(() => {
    polishScheduled = false;
    polishOrderUi();
  });
});
polishObserver.observe(document.documentElement, { childList: true, subtree: true });
polishOrderUi();
