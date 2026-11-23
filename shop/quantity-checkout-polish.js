// 77select checkout display helpers.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let scheduled = false;

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
  tagCheckoutSummary();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(syncUi);
}

window.addEventListener("click", (event) => {
  if (event.target.closest?.("#checkout-open")) setTimeout(resetCheckoutScroll, 80);
}, true);

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"],
});

scheduleSync();
