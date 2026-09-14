// 77select cart summary visual bridge.
// Reads the rendered cart DOM and only adds a footer breakdown. It does not
// modify cart data, pricing data, promotions, checkout, or order submission.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let scheduled = false;
let applying = false;
let cartDiscountOpen = false;
const checkoutDiscountOpen = new Set();

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

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function cartMathRow(label, operator, value, currency, extraClass = "") {
  return `<div class="cart-math-row ${extraClass}"><span class="cart-math-label">${label}</span><span class="cart-math-op">${operator}</span><b class="cart-math-value">${money(value, currency)}</b></div>`;
}

function discountToggleRow(value, currency, open) {
  return `<button class="cart-math-row discount cart-math-discount-toggle" type="button" data-cart-discount-toggle aria-expanded="${open ? "true" : "false"}" aria-controls="cart-discount-detail"><span class="cart-math-label">活動折扣明細</span><span class="cart-math-op">−</span><b class="cart-math-value">${money(value, currency)}</b></button>`;
}

function cartRowSubtotal(row) {
  const priceText = row.querySelector("p b")?.textContent || row.querySelector("p")?.textContent || "";
  const qtyText = row.querySelector(".qty b")?.textContent || row.querySelector("p")?.textContent?.match(/×\s*(\d+)/)?.[1] || "1";
  return parseMoney(priceText) * Math.max(1, Math.round(Number(qtyText) || 1));
}

function cartRowLabel(row) {
  const title = row.querySelector("h4")?.textContent?.trim() || "商品";
  const variant = row.querySelector(".cart-variant")?.textContent?.trim() || "";
  const qty = row.querySelector(".qty b")?.textContent?.trim() || row.querySelector("p")?.textContent?.match(/×\s*(\d+)/)?.[1] || "1";
  const price = row.querySelector("p b")?.textContent?.trim() || "";
  return `${title}${variant ? `｜${variant}` : ""} × ${qty}${price ? `（單件 ${price}）` : ""}`;
}

function noteDiscountTotal() {
  return $$("#cart-items .promo-bridge-note, #checkout-summary .promo-bridge-line").reduce((sum, node) => {
    const text = node.dataset.originalPromoText || node.textContent || "";
    if (!/[-−]\s*(NT\$|HK\$)/.test(text)) return sum;
    const match = text.match(/[-−]\s*((?:NT\$|HK\$)\s*[0-9,]+)/);
    return sum + parseMoney(match?.[1] || "0");
  }, 0);
}

function promotionNotes() {
  const notes = [];
  $$("#cart-items .promo-bridge-note, #checkout-summary .promo-bridge-line").forEach((node) => {
    const text = (node.dataset.originalPromoText || node.textContent || "").trim();
    if (text && !notes.includes(text)) notes.push(text);
  });
  return notes;
}

function discountDetailHtml(subtotalBeforeDiscount, discount, currency, open) {
  const promoRows = promotionNotes().map((text) => `<li>${esc(text.replace(/^已套用\s*/u, "").replace(/^促銷優惠[｜\s]*/u, ""))}</li>`).join("") || "<li>折扣明細正在同步，請稍候。</li>";
  const itemRows = $$("#cart-items .regional-cart-row,#cart-items .cart-row").map((row) => `<li>${esc(cartRowLabel(row))}</li>`).join("") || "<li>購物車目前沒有商品。</li>";
  return `<div id="cart-discount-detail" class="cart-discount-detail" ${open ? "" : "hidden"}>
    <h4>活動折扣明細</h4>
    <p>折扣前小計 ${money(subtotalBeforeDiscount, currency)}，本次活動折扣 ${money(discount, currency)}。</p>
    <ul>${promoRows}</ul>
    <h4>套用商品</h4>
    <ul>${itemRows}</ul>
  </div>`;
}

function syncCartMath() {
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
      cartDiscountOpen = false;
      if (label) label.textContent = "商品小計";
      return;
    }

    const shippingEstimate = 0;
    const html = [
      cartMathRow("小計", "", subtotalBeforeDiscount, currency),
      discountToggleRow(discount, currency, cartDiscountOpen),
      discountDetailHtml(subtotalBeforeDiscount, discount, currency, cartDiscountOpen),
      cartMathRow("運費", "+", shippingEstimate, currency),
    ].join("");

    if (existing) {
      if (existing.innerHTML !== html) existing.innerHTML = html;
    } else {
      const box = document.createElement("div");
      box.className = "cart-math-breakdown";
      box.innerHTML = html;
      foot.insertBefore(box, totalLine);
    }
    if (label) label.textContent = "總計";
  } finally {
    applying = false;
  }
}

function enhanceCheckoutDiscounts() {
  $$("#checkout-summary .promo-bridge-line").forEach((line, index) => {
    const rawText = line.dataset.originalPromoText || line.textContent.trim();
    line.dataset.originalPromoText = rawText;
    const amount = Math.abs(parseMoney(line.querySelector("b")?.textContent || rawText));
    const detailId = `checkout-promo-detail-${index + 1}`;
    const open = checkoutDiscountOpen.has(detailId);
    line.setAttribute("role", "button");
    line.setAttribute("tabindex", "0");
    line.setAttribute("aria-expanded", String(open));
    line.setAttribute("aria-controls", detailId);
    line.innerHTML = `<span>活動折扣明細</span><em>−</em><b>${money(amount, currencyOf(rawText))}</b>`;
    const next = line.nextElementSibling;
    const detailHtml = `<div id="${detailId}" class="checkout-discount-detail" ${open ? "" : "hidden"}><h4>活動折扣明細</h4><ul><li>${esc(rawText.replace(/^促銷優惠[｜\s]*/u, ""))}</li></ul></div>`;
    if (next?.classList?.contains("checkout-discount-detail")) {
      if (next.outerHTML !== detailHtml) next.outerHTML = detailHtml;
    } else {
      line.insertAdjacentHTML("afterend", detailHtml);
    }
  });

  $$("#checkout-summary .totals-line").forEach((line) => {
    const label = line.querySelector("span")?.textContent || "";
    if (!/運費|處理費/.test(label)) return;
    line.classList.add("checkout-math-line");
    if (!line.querySelector("em")) line.querySelector("b")?.insertAdjacentHTML("beforebegin", "<em>＋</em>");
  });
}

function syncAll() {
  scheduled = false;
  syncCartMath();
  enhanceCheckoutDiscounts();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(syncAll);
}

function toggleDiscount(button) {
  const controls = button.getAttribute("aria-controls") || "";
  if (button.matches("[data-cart-discount-toggle]")) {
    cartDiscountOpen = !cartDiscountOpen;
  } else if (checkoutDiscountOpen.has(controls)) {
    checkoutDiscountOpen.delete(controls);
  } else if (controls) {
    checkoutDiscountOpen.add(controls);
  }
  const detail = document.getElementById(controls);
  const open = button.matches("[data-cart-discount-toggle]") ? cartDiscountOpen : checkoutDiscountOpen.has(controls);
  if (detail) detail.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  scheduleSync();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-cart-discount-toggle], #checkout-summary .promo-bridge-line[role='button']");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  toggleDiscount(button);
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const button = event.target.closest?.("[data-cart-discount-toggle], #checkout-summary .promo-bridge-line[role='button']");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  toggleDiscount(button);
}, true);

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"],
});
window.addEventListener("storage", scheduleSync);
scheduleSync();
