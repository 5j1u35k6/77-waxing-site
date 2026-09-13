function normalizeProductCardActions() {
  document.querySelectorAll(".regional-product-card .product-actions").forEach((actions) => {
    const detail = actions.querySelector("[data-regional-detail]");
    if (!detail) return;

    const buyButtons = actions.querySelectorAll("[data-regional-buy]");
    buyButtons.forEach((button) => button.remove());

    if (detail.textContent.trim() !== "詳情") detail.textContent = "詳情";
    if (detail.classList.contains("secondary-btn")) detail.classList.remove("secondary-btn");
    if (!detail.classList.contains("primary-btn")) detail.classList.add("primary-btn");
    if (!detail.classList.contains("product-detail-only")) detail.classList.add("product-detail-only");
    if (!actions.classList.contains("single-detail-action")) actions.classList.add("single-detail-action");
  });
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
