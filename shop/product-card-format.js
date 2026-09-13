import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

const { db } = getPublicFirebase();
const products = new Map();
let scheduled = false;

const int = (value) => Math.max(0, Math.round(Number(value) || 0));

function normalizeVariants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant) => ({
      priceTWD: int(variant.priceTWD ?? variant.priceTW ?? variant.price ?? product.price ?? 0),
      priceHKD: int(variant.priceHKD ?? variant.priceHK ?? product.priceHKD ?? 0),
      bulkMinQty: int(variant.bulkMinQty ?? variant.quantityDiscountMin ?? 0),
      bulkPriceTWD: int(variant.bulkPriceTWD ?? variant.quantityDiscountTWD ?? 0),
      bulkPriceHKD: int(variant.bulkPriceHKD ?? variant.quantityDiscountHKD ?? 0),
    }));
  }

  return [{
    priceTWD: int(product.price || 0),
    priceHKD: int(product.priceHKD || product.price || 0),
    bulkMinQty: 0,
    bulkPriceTWD: 0,
    bulkPriceHKD: 0,
  }];
}

function marketCode() {
  return document.documentElement.dataset.market === "HK" ? "HK" : "TW";
}

function priceFor(variant, code) {
  return code === "HK" ? int(variant.priceHKD) : int(variant.priceTWD);
}

function bulkPriceFor(variant, code) {
  return code === "HK" ? int(variant.bulkPriceHKD) : int(variant.bulkPriceTWD);
}

function hasBulkDiscount(product, code) {
  return normalizeVariants(product).some((variant) => {
    const base = priceFor(variant, code);
    const bulk = bulkPriceFor(variant, code);
    return int(variant.bulkMinQty) >= 2 && base > 0 && bulk > 0 && bulk <= base;
  });
}

function money(value, code) {
  const amount = Number(value || 0);
  return code === "HK"
    ? `HK$${amount.toLocaleString("zh-HK")}`
    : `NT$${amount.toLocaleString("zh-TW")}`;
}

function priceRange(product, code) {
  const values = normalizeVariants(product)
    .map((variant) => priceFor(variant, code))
    .filter((value) => value > 0);

  if (!values.length) return code === "HK" ? "HK$0" : "NT$0";
  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  return highest === lowest ? money(highest, code) : `${money(highest, code)} – ${money(lowest, code)}`;
}

function generatedNode(className, tag = "div") {
  const node = document.createElement(tag);
  node.className = `${className} card-format-generated`;
  return node;
}

function formatCard(card) {
  const detailButton = card.querySelector("[data-regional-detail]");
  const buyButton = card.querySelector("[data-regional-buy]");
  const body = card.querySelector(".product-body");
  const actions = card.querySelector(".product-actions");
  if (!detailButton || !body || !actions) return;

  const id = String(detailButton.dataset.regionalDetail || "");
  const product = products.get(id);
  if (!product) return;

  const code = marketCode();
  const range = priceRange(product, code);
  const bulk = hasBulkDiscount(product, code);
  const category = String(product.category || "其他").trim() || "其他";
  const signature = `${code}|${range}|${category}|${bulk ? 1 : 0}`;

  /* Keep the regional storefront's original controls in place. Moving/replacing
     the detail button made interaction fragile because multiple storefront layers
     observe the card DOM. We only restyle the existing control now. */
  detailButton.type = "button";
  detailButton.textContent = "詳情";
  detailButton.classList.remove("secondary-btn");
  detailButton.classList.add("primary-btn", "product-detail-only");
  actions.classList.add("single-detail-action", "card-format-actions");

  if (buyButton) {
    buyButton.hidden = true;
    buyButton.tabIndex = -1;
    buyButton.setAttribute("aria-hidden", "true");
    buyButton.classList.add("card-format-buy-sentinel");
  }

  body.classList.add("card-format-v2");
  if (card.dataset.cardFormatSignature === signature && body.querySelector(".card-format-generated")) return;

  body.querySelectorAll(".card-format-generated").forEach((node) => node.remove());

  const title = generatedNode("card-format-title", "h3");
  title.textContent = String(product.name || "商品");

  const rule1 = generatedNode("card-format-rule");
  rule1.setAttribute("aria-hidden", "true");

  const price = generatedNode("card-format-price");
  price.innerHTML = `<span>售價</span><strong>${range}</strong>`;

  const rule2 = generatedNode("card-format-rule");
  rule2.setAttribute("aria-hidden", "true");

  const pills = generatedNode("card-format-pills");
  const categoryPill = document.createElement("span");
  categoryPill.className = "card-format-pill category";
  categoryPill.textContent = category;
  pills.appendChild(categoryPill);
  if (bulk) {
    const bulkPill = document.createElement("span");
    bulkPill.className = "card-format-pill bulk";
    bulkPill.textContent = "多件優惠";
    pills.appendChild(bulkPill);
  }

  const rule3 = generatedNode("card-format-rule");
  rule3.setAttribute("aria-hidden", "true");

  const fragment = document.createDocumentFragment();
  fragment.append(title, rule1, price, rule2, pills, rule3);
  body.insertBefore(fragment, actions);
  card.dataset.cardFormatSignature = signature;
}

function apply() {
  scheduled = false;
  document.querySelectorAll(".regional-product-card").forEach(formatCard);
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(apply);
}

const observer = new MutationObserver(scheduleApply);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["data-market"],
});

async function loadProducts() {
  try {
    const snap = await getDocs(query(collection(db, "shopProducts"), where("active", "==", true)));
    snap.docs.forEach((row) => products.set(row.id, { id: row.id, ...row.data() }));
    scheduleApply();
  } catch (error) {
    console.error("77select product card format failed to load products", error);
  }
}

loadProducts();
scheduleApply();
