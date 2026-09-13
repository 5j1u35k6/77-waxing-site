// 77select cart summary visual bridge.
// Reads the rendered cart DOM and only adds a footer breakdown. It does not
// modify cart data, pricing data, promotions, checkout, or order submission.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let scheduled = false;
let applying = false;

function parseMoney(text) {
  return Number(String(text || "").replace(/[^0-9.-]/g, "") || 0);
}

function currencyOf(text) {
  return String(text || "").includes("HK$") ? "HKD" : "TWD";
}

function money(value, currency) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (currency === "HKD") return `HK$${amount.toLocaleString("zh-HK")}`;
  return `NT$${amount.toLocaleString("zh-TW")}`;
}

function line(label, operator, value, currency, extraClass = "") {
  return `<div class="cart-math-row ${extraClass}"><span class="cart-math-label">${label}</span><span class="cart-math-op">${operator}</span><b class="cart-math-value">${money(value, currency)}</b></div>`;
}

function cartRowSubtotal(row) {
  const priceText = row.querySelector("p b")?.textContent || row.querySelector("p")?.textContent || "";
  const qtyText = row.querySelector(".qty b")?.textContent || row.querySelector("p")?.textContent?.match(/×\s*(\d+)/)?.[1] || "1";
  return parseMoney(priceText) * Math.max(1, Math.round(Number(qtyText) || 1));
}

function noteDiscountTotal() {
  return $$("#cart-items .promo-bridge-note").reduce((sum, node) => {
    const text = node.textContent || "";
    if (!/-\s*(NT\$|HK\$)/.test(text)) return sum;
    const match = text.match(/-\s*((?:NT\$|HK\$)\s*[0-9,]+)/);
    return sum + parseMoney(match?.[1] || "0");
  }, 0);
}

function syncCartMath() {
  scheduled = false;
  if (applying) return;
  applying = true;
  try {
    const foot = $("#cart-wrap .drawer-foot");
    const subtotalEl = $("#cart-subtotal");
    const totalLine = subtotalEl?.closest?.(".totals-line");
    if (!foot || !subtotalEl || !totalLine) return;

    const existing = foot.querySelector(".cart-math-breakdown");
    const rows = $$("#cart-items .regional-cart-row,#cart-items .cart-row");
    const subtotalBeforeDiscount = rows.reduce((sum, row) => sum + cartRowSubtotal(row), 0);
    const finalTotal = parseMoney(subtotalEl.textContent);
    const currency = currencyOf(subtotalEl.textContent || document.documentElement.dataset.market);
    const discountFromDiff = subtotalBeforeDiscount > finalTotal ? subtotalBeforeDiscount - finalTotal : 0;
    const discount = Math.max(discountFromDiff, noteDiscountTotal());

    const label = totalLine.querySelector("span");
    if (!subtotalBeforeDiscount || discount <= 0) {
      existing?.remove();
      if (label) label.textContent = "商品小計";
      return;
    }

    const shippingEstimate = 0;
    const html = [
      line("小計", "", subtotalBeforeDiscount, currency),
      line("活動折扣", "−", discount, currency, "discount"),
      line("運費", "+", shippingEstimate, currency),
    ].join("");

    if (existing) {
      if (existing.innerHTML !== html) existing.innerHTML = html;
    } else {
      const box = document.createElement("div");
      box.className = "cart-math-breakdown";
      box.innerHTML = html;
      foot.insertBefore(box, totalLine);
    }
    if (label) label.textContent = "折扣後小計";
  } finally {
    applying = false;
  }
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(syncCartMath);
}

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"],
});
window.addEventListener("storage", scheduleSync);
scheduleSync();
