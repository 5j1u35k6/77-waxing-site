/* 77select product-detail variant layout
   Keeps regional-store.js as the source of truth and only reformats the
   rendered option buttons into a clearer two-row hierarchy. */

let scheduled = false;

function readPrice(priceHost) {
  if (!priceHost) return "";
  const clone = priceHost.cloneNode(true);
  clone.querySelectorAll("small").forEach((node) => node.remove());
  return clone.textContent.trim();
}

function stockLabel(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/售完/.test(text)) return "售完";
  const match = text.match(/(\d+)/);
  return match ? `剩餘數量 ${match[1]}` : text.replace(/^庫存\s*/, "剩餘數量 ");
}

function formatChoice(choice) {
  if (!(choice instanceof HTMLElement) || choice.dataset.variantLayout === "v2") return;

  const info = choice.children[0];
  const priceHost = choice.querySelector(".variant-choice-price");
  if (!info || !priceHost) return;

  const name = info.querySelector("b")?.textContent?.trim() || "規格";
  const capacityNode = [...info.querySelectorAll("small")].find((node) => !node.classList.contains("bulk-copy"));
  const capacity = capacityNode?.textContent?.trim() || "—";
  const discount = info.querySelector(".bulk-copy")?.textContent?.trim() || "";
  const price = readPrice(priceHost);
  const stock = stockLabel(priceHost.querySelector("small")?.textContent || "");

  const top = document.createElement("div");
  top.className = "variant-layout-row variant-layout-top";

  const capacityEl = document.createElement("span");
  capacityEl.className = "variant-layout-capacity";
  capacityEl.textContent = capacity;

  const priceEl = document.createElement("strong");
  priceEl.className = "variant-layout-price";
  priceEl.textContent = price;

  top.append(capacityEl, priceEl);

  const bottom = document.createElement("div");
  bottom.className = "variant-layout-row variant-layout-bottom";

  const namePill = document.createElement("span");
  namePill.className = "variant-layout-pill";
  namePill.textContent = name;

  const stockEl = document.createElement("span");
  stockEl.className = "variant-layout-stock";
  stockEl.textContent = stock;

  bottom.append(namePill, stockEl);

  choice.dataset.variantLayout = "v2";
  choice.classList.add("variant-layout-v2");
  choice.replaceChildren(top, bottom);

  if (discount) {
    const discountEl = document.createElement("div");
    discountEl.className = "variant-layout-discount";
    discountEl.textContent = `多件優惠｜${discount}`;
    choice.appendChild(discountEl);
  }
}

function applyVariantLayout() {
  scheduled = false;
  document.querySelectorAll("#product-detail-body .variant-choice").forEach(formatChoice);
}

function scheduleVariantLayout() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(applyVariantLayout);
}

const host = document.querySelector("#product-detail-body");
if (host) {
  new MutationObserver(scheduleVariantLayout).observe(host, { childList: true, subtree: true });
}

scheduleVariantLayout();
