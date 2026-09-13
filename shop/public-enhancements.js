function normalizeProductCardActions() {
  document.querySelectorAll(".regional-product-card .product-actions").forEach((actions) => {
    const detail = actions.querySelector("[data-regional-detail]");
    if (!detail) return;

    // Keep the original buy control in the DOM as a hidden sentinel.
    // regional-store.js watches for data-regional-buy; removing it causes the
    // legacy card renderer to rebuild the card repeatedly and can make the
    // visible detail button appear unresponsive.
    const buyButtons = actions.querySelectorAll("[data-regional-buy]");
    buyButtons.forEach((button) => {
      button.hidden = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      button.classList.add("card-format-buy-sentinel");
    });

    if (detail.textContent.trim() !== "詳情") detail.textContent = "詳情";
    if (detail.classList.contains("secondary-btn")) detail.classList.remove("secondary-btn");
    if (!detail.classList.contains("primary-btn")) detail.classList.add("primary-btn");
    if (!detail.classList.contains("product-detail-only")) detail.classList.add("product-detail-only");
    if (!actions.classList.contains("single-detail-action")) actions.classList.add("single-detail-action");
  });
}

function normalizeMarketBadge() {
  const badge = document.querySelector("#market-badge");
  if (!badge) return;
  const raw = badge.querySelector("b")?.textContent?.trim() || badge.textContent.trim();
  const label = raw.includes("香港") ? "香港" : raw.includes("台灣") ? "台灣" : "";
  if (!label) return;
  if (badge.children.length === 0 && badge.textContent.trim() === label) return;
  badge.textContent = label;
  badge.setAttribute("aria-label", `目前地區：${label}`);
}

function apply77selectBranding() {
  document.querySelectorAll(".product-media").forEach((node) => {
    if (node.children.length === 0 && node.textContent.trim() === "77waxing") node.textContent = "77select";
  });

  const heroEyebrow = document.querySelector("#hero-eyebrow");
  if (heroEyebrow && heroEyebrow.textContent.trim() === "77WAXING SELECT") heroEyebrow.textContent = "77SELECT";

  const heroDescription = document.querySelector("#hero-description");
  if (heroDescription?.textContent.includes("77waxing 後台")) {
    heroDescription.textContent = heroDescription.textContent.replace("77waxing 後台", "77select 後台");
  }

  normalizeMarketBadge();
  normalizeProductCardActions();
}

let scheduled = false;
function scheduleEnhancements() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    apply77selectBranding();
  });
}

const observer = new MutationObserver(scheduleEnhancements);
observer.observe(document.documentElement, { childList: true, subtree: true });
apply77selectBranding();
