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
}

const observer = new MutationObserver(apply77selectBranding);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
apply77selectBranding();
