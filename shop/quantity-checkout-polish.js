// 77select quantity + checkout visual polish.
// This file is intentionally layered after regional-store.js so it does not
// rewrite product, cart, or order data models.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const int = (value) => Math.max(0, Math.round(Number(value) || 0));

let detailQty = 1;
let lastSignature = "";
let modalWasOpen = false;
let scheduled = false;

function closest(target, selector) {
  return target?.closest?.(selector) || target?.parentElement?.closest?.(selector) || null;
}

function cleanAddText(value) {
  return String(value || "").replace(/\s*×\s*\d+\s*$/u, "").trim();
}

function selectedVariantButton() {
  return $("#product-detail-body [data-regional-variant].on") ||
    $("#product-detail-body [data-regional-variant][aria-checked='true']") ||
    $("#product-detail-body [data-regional-variant]");
}

function selectedSignature() {
  const product = $("#product-detail-body h2")?.textContent?.trim() || "";
  const variant = selectedVariantButton()?.dataset?.regionalVariant || selectedVariantButton()?.textContent?.trim() || "";
  return `${product}::${variant}`;
}

function selectedDetailMeta() {
  const variant = selectedVariantButton();
  const labels = [
    variant?.querySelector(".variant-layout-capacity")?.textContent?.trim(),
    variant?.querySelector(".variant-layout-pill")?.textContent?.trim(),
  ].filter((value) => value && value !== "商品規格");
  return {
    title: $("#product-detail-body h2")?.textContent?.trim() || "",
    labels,
  };
}

function selectedMaxQty() {
  const addButton = $("#product-detail-add");
  if (!addButton || addButton.disabled) return 0;
  const stockText = selectedVariantButton()?.querySelector(".variant-layout-stock")?.textContent || "";
  if (/售完/.test(stockText)) return 0;
  const match = stockText.match(/(\d+)/);
  return match ? Math.max(1, Number(match[1])) : 99;
}

function clampDetailQty() {
  const max = selectedMaxQty();
  detailQty = max > 0 ? Math.min(max, Math.max(1, int(detailQty) || 1)) : 0;
  return max;
}

function baseAddText(button, signature) {
  if (button.dataset.qtySignature !== signature) {
    button.dataset.qtySignature = signature;
    button.dataset.qtyBaseText = cleanAddText(button.textContent);
  }
  return button.dataset.qtyBaseText || cleanAddText(button.textContent) || "加入購物車";
}

function ensureDetailQtyControl() {
  const wrap = $("#product-modal-wrap");
  const foot = wrap?.querySelector(".modal-foot");
  const addButton = $("#product-detail-add");
  if (!wrap || !foot || !addButton) return;

  const isOpen = !wrap.classList.contains("hidden");
  if (isOpen && !modalWasOpen) {
    detailQty = 1;
    lastSignature = "";
    addButton.dataset.qtySignature = "";
    addButton.dataset.qtyBaseText = cleanAddText(addButton.textContent);
  }
  modalWasOpen = isOpen;

  const signature = selectedSignature();
  if (signature && signature !== lastSignature) {
    detailQty = 1;
    lastSignature = signature;
    addButton.dataset.qtySignature = "";
  }

  let picker = $("#product-detail-qty-picker");
  if (!picker) {
    picker = document.createElement("div");
    picker.id = "product-detail-qty-picker";
    picker.className = "detail-qty-picker";
    picker.innerHTML = `<span class="detail-qty-label">數量</span><div class="qty detail-qty-control"><button type="button" data-detail-qty="-1" aria-label="減少數量">−</button><b id="product-detail-qty-value">1</b><button type="button" data-detail-qty="1" aria-label="增加數量">＋</button></div><small id="product-detail-qty-stock"></small>`;
    foot.insertBefore(picker, addButton);
  }

  const max = clampDetailQty();
  const shouldHide = !isOpen || max <= 0 || addButton.disabled;
  if (picker.hidden !== shouldHide) picker.hidden = shouldHide;
  if (shouldHide) {
    const text = baseAddText(addButton, signature);
    if (addButton.textContent !== text) addButton.textContent = text;
    return;
  }

  const value = $("#product-detail-qty-value", picker);
  const stock = $("#product-detail-qty-stock", picker);
  const minus = picker.querySelector("[data-detail-qty='-1']");
  const plus = picker.querySelector("[data-detail-qty='1']");
  if (value && value.textContent !== String(detailQty)) value.textContent = String(detailQty);
  if (stock && stock.textContent !== `最多 ${max} 件`) stock.textContent = `最多 ${max} 件`;
  if (minus) minus.disabled = detailQty <= 1;
  if (plus) plus.disabled = detailQty >= max;

  const base = baseAddText(addButton, signature);
  const text = detailQty > 1 ? `${base} × ${detailQty}` : base;
  if (addButton.textContent !== text) addButton.textContent = text;
}

function resetCheckoutScroll() {
  const wrap = $("#checkout-wrap");
  if (!wrap || wrap.classList.contains("hidden")) return;
  wrap.querySelector(".modal-body")?.scrollTo?.({ top: 0, behavior: "auto" });
}

function tagCheckoutSummary() {
  const lines = $$("#checkout-summary .totals-line");
  lines.forEach((line, index) => {
    const item = index < Math.max(0, lines.length - 2);
    const fee = index === lines.length - 2;
    if (line.classList.contains("checkout-item-line") !== item) line.classList.toggle("checkout-item-line", item);
    if (line.classList.contains("checkout-fee-line") !== fee) line.classList.toggle("checkout-fee-line", fee);
  });
}

function syncUi() {
  scheduled = false;
  ensureDetailQtyControl();
  tagCheckoutSummary();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(syncUi);
}

window.addEventListener("click", (event) => {
  const detailQtyButton = closest(event.target, "[data-detail-qty]");
  if (detailQtyButton) {
    event.preventDefault();
    event.stopPropagation();
    detailQty += Number(detailQtyButton.dataset.detailQty || 0);
    ensureDetailQtyControl();
    return;
  }

  const checkoutOpen = closest(event.target, "#checkout-open");
  if (checkoutOpen) setTimeout(resetCheckoutScroll, 80);

  const addButton = closest(event.target, "#product-detail-add");
  if (!addButton || addButton.disabled) return;
  ensureDetailQtyControl();
  const count = Math.max(1, int(detailQty));
  // The regional handler reads this count during the same click. No delayed
  // replay of cart buttons can affect a different product or checkout.
  addButton.dataset.requestedQuantity = String(count);
  detailQty = 1;
  scheduleSync();
}, true);

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden", "aria-checked"],
});

scheduleSync();
