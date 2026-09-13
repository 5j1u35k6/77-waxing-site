// 77select cart + checkout breakdown disclosure.
// This file only reorganizes summary UI. It does not calculate or submit orders.
const CART_KEY = "77select_cart_v4";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let scheduled = false;
let applying = false;

function marketCurrency() {
  return document.documentElement.dataset.market === "HK" ? "HKD" : "TWD";
}

function money(value, currency = marketCurrency()) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  return currency === "HKD" ? `HK$${amount.toLocaleString("zh-HK")}` : `NT$${amount.toLocaleString("zh-TW")}`;
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "") || 0);
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

function loadCartRows() {
  try {
    const rows = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function subtotalFromCart(rows = loadCartRows()) {
  return rows.reduce((sum, row) => sum + Number(row.price || 0) * Math.max(0, Math.round(Number(row.qty) || 0)), 0);
}

function cartItemLabels(rows = loadCartRows()) {
  return rows.map((row) => {
    const qty = Math.max(0, Math.round(Number(row.qty) || 0));
    const meta = [row.variantName, row.capacity].filter(Boolean).join("｜");
    const label = [row.name || "商品", meta].filter(Boolean).join("｜");
    return `${label} × ${qty}（${money(Number(row.price || 0) * qty, row.currency || marketCurrency())}）`;
  }).filter(Boolean);
}

function promotionNotes() {
  const notes = [];
  $$("#cart-items .promo-bridge-note").forEach((node) => {
    const text = node.textContent.trim();
    if (text) notes.push(text);
  });
  $$("#checkout-summary .promo-bridge-line").forEach((node) => {
    const text = node.dataset.originalPromoText || node.textContent.trim();
    if (text && !notes.includes(text)) notes.push(text);
  });
  return notes;
}

function currentCartDiscount(subtotal) {
  const displayed = parseMoney($("#cart-subtotal")?.textContent || "0");
  const bySubtotal = Math.max(0, subtotal - displayed);
  const byNotes = promotionNotes().reduce((sum, text) => {
    const matches = [...text.matchAll(/[-−]\s*(?:NT\$|HK\$)?\s*([0-9,]+)/g)];
    return sum + matches.reduce((inner, match) => inner + Number(String(match[1] || "0").replace(/,/g, "")), 0);
  }, 0);
  return Math.max(bySubtotal, byNotes);
}

function currentShippingFee() {
  const checkoutFeeLine = [...$$("#checkout-summary .totals-line")].find((line) => /運費|處理費/.test(line.querySelector("span")?.textContent || ""));
  if (checkoutFeeLine) return Math.max(0, parseMoney(checkoutFeeLine.querySelector("b")?.textContent || "0"));
  return 0;
}

function detailPanelHtml(id, subtotal, discount) {
  const notes = promotionNotes();
  const items = cartItemLabels();
  const discountRows = notes.length
    ? notes.map((text) => `<li>${esc(text.replace(/^已套用\s*/u, ""))}</li>`).join("")
    : `<li>目前沒有偵測到活動折扣明細。</li>`;
  const itemRows = items.length
    ? items.map((text) => `<li>${esc(text)}</li>`).join("")
    : `<li>購物車目前沒有商品。</li>`;
  return `<div id="${esc(id)}" class="cart-discount-detail" hidden>
    <h4>活動折扣明細</h4>
    <div class="muted">折扣前小計 ${money(subtotal)}，本次活動折扣 ${money(discount)}。</div>
    <ul>${discountRows}</ul>
    <h4 style="margin-top:10px">本次購物車商品</h4>
    <ul>${itemRows}</ul>
  </div>`;
}

function cartBreakdownHtml(subtotal, discount, shipping, open) {
  const total = Math.max(0, subtotal - discount + shipping);
  const detailId = "cart-discount-detail";
  const discountLine = discount > 0 ? `<button class="cart-breakdown-row discount" type="button" data-discount-detail-toggle aria-expanded="${open ? "true" : "false"}" aria-controls="${detailId}"><span>活動折扣</span><em>−</em><b>${money(discount)}</b></button>${detailPanelHtml(detailId, subtotal, discount).replace(" hidden>", open ? ">" : " hidden>")}` : "";
  return `<div class="cart-breakdown-v2" data-cart-breakdown>
    <div class="cart-breakdown-row"><span>小計</span><em></em><b>${money(subtotal)}</b></div>
    ${discountLine}
    <div class="cart-breakdown-row"><span>運費／處理費</span><em>＋</em><b>${money(shipping)}</b></div>
    <div class="cart-breakdown-rule" aria-hidden="true"></div>
  </div>`;
}

function syncCartBreakdown() {
  const subtotalEl = $("#cart-subtotal");
  const totalLine = subtotalEl?.closest?.(".totals-line");
  const foot = subtotalEl?.closest?.(".drawer-foot");
  if (!subtotalEl || !totalLine || !foot) return;

  const rows = loadCartRows();
  const existing = $("[data-cart-breakdown]", foot);
  if (!rows.length) {
    existing?.remove();
    totalLine.classList.remove("cart-final-total");
    const label = totalLine.querySelector("span");
    if (label) label.textContent = "商品小計";
    return;
  }

  const subtotal = subtotalFromCart(rows);
  const discount = currentCartDiscount(subtotal);
  const shipping = currentShippingFee();
  const total = Math.max(0, subtotal - discount + shipping);
  const wasOpen = existing?.querySelector("#cart-discount-detail")?.hidden === false;
  const html = cartBreakdownHtml(subtotal, discount, shipping, wasOpen);
  if (!existing) totalLine.insertAdjacentHTML("beforebegin", html);
  else if (existing.outerHTML !== html) existing.outerHTML = html;

  const label = totalLine.querySelector("span");
  if (label) label.textContent = "總計";
  subtotalEl.textContent = money(total);
  totalLine.classList.add("cart-final-total");
}

function normalizeCheckoutMath() {
  const summary = $("#checkout-summary");
  if (!summary) return;
  const promoLines = $$(".promo-bridge-line", summary);
  promoLines.forEach((line, index) => {
    const rawText = line.dataset.originalPromoText || line.textContent.trim();
    line.dataset.originalPromoText = rawText;
    const amount = Math.abs(parseMoney(line.querySelector("b")?.textContent || rawText));
    const detailId = `checkout-discount-detail-${index + 1}`;
    line.setAttribute("role", "button");
    line.setAttribute("tabindex", "0");
    line.setAttribute("aria-expanded", line.getAttribute("aria-expanded") || "false");
    line.setAttribute("aria-controls", detailId);
    line.innerHTML = `<span>活動折扣</span><em>−</em><b>${money(amount)}</b>`;
    if (!line.nextElementSibling?.classList?.contains("checkout-discount-detail")) {
      line.insertAdjacentHTML("afterend", `<div id="${detailId}" class="checkout-discount-detail" hidden><h4>活動折扣明細</h4><ul><li>${esc(rawText.replace(/^促銷優惠[｜\s]*/u, ""))}</li></ul></div>`);
    }
  });

  $$(".totals-line", summary).forEach((line) => {
    const label = line.querySelector("span")?.textContent || "";
    if (!/運費|處理費/.test(label)) return;
    line.classList.add("checkout-math-line");
    if (!line.querySelector("em")) {
      const amount = line.querySelector("b");
      if (amount) amount.insertAdjacentHTML("beforebegin", "<em>＋</em>");
    }
  });
}

function sync() {
  if (applying) return;
  applying = true;
  try {
    syncCartBreakdown();
    normalizeCheckoutMath();
  } finally {
    applying = false;
    scheduled = false;
  }
}

function scheduleSync() {
  if (scheduled || applying) return;
  scheduled = true;
  requestAnimationFrame(sync);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-discount-detail-toggle], .promo-bridge-line[role='button']");
  if (!button) return;
  const detail = document.getElementById(button.getAttribute("aria-controls") || "");
  if (!detail) return;
  event.preventDefault();
  const open = detail.hidden;
  detail.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const button = event.target.closest?.(".promo-bridge-line[role='button']");
  if (!button) return;
  event.preventDefault();
  button.click();
});

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"],
});
window.addEventListener("storage", scheduleSync);
scheduleSync();
