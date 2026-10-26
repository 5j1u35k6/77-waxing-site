// All checkout layers share one lock so changing promotions cannot submit twice.
const pendingForms = new WeakSet();

export function beginCheckout(form) {
  if (!form || pendingForms.has(form)) return false;
  pendingForms.add(form);
  return true;
}

export function finishCheckout(form) {
  if (form) pendingForms.delete(form);
}

export function cartFingerprint(rows) {
  return JSON.stringify(rows.map((row) => [
    row.productId || row.id, row.variantId || "", Number(row.qty),
    Number(row.price), row.region || "TW", row.currency || "TWD",
  ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

// Match the published order limits before reserving a sequential order number.
export function validateOrderData(order) {
  const text = (value, max, min = 0) => typeof value === "string" && value.length >= min && value.length <= max;
  if (!text(order.customerName, 80, 1) || !text(order.phone, 30, 1) || !text(order.email, 160, 4)) {
    throw new Error("請確認收件人姓名、電話與 Email 的填寫長度。");
  }
  if (!text(order.storeInfo, 180) || (order.note !== null && !text(order.note, 1000))) {
    throw new Error("門市資料或備註內容過長，請縮短後再送出。");
  }
  if (!Array.isArray(order.items) || !order.items.length || order.items.length > 30) {
    throw new Error("每筆訂單最多可購買 30 種商品規格（包含贈品），請分開訂購。");
  }
  if (!Number.isFinite(order.subtotal) || order.subtotal < 0 || order.subtotal > 10000000
      || !Number.isFinite(order.shippingFee) || order.shippingFee < 0 || order.shippingFee > 10000
      || order.total !== order.subtotal + order.shippingFee) {
    throw new Error("訂單金額超出可接受範圍，請重新確認購物車或聯絡我們。");
  }
}

export function savePreference(key, value) {
  try { localStorage.setItem(key, value); }
  catch (error) { console.warn("77select local preference unavailable", error); }
}
