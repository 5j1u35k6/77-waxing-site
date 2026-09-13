import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_APP_NAME = "77waxing-shop-admin";
let activeEditId = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (value) => Math.max(0, Math.round(Number(value) || 0));

async function waitForAdminApp() {
  for (let i = 0; i < 160; i += 1) {
    const app = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME);
    if (app) return app;
    await sleep(50);
  }
  throw new Error("77select admin Firebase app did not initialize in time.");
}

function flash(message, type = "ok") {
  const el = $("#admin-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = type === "error" ? "#a64b43" : "#55745b";
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { el.textContent = ""; }, 4800);
}

function variantId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVariants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => ({
      id: String(variant.id || variantId()),
      name: String(variant.name || variant.label || `規格 ${index + 1}`),
      capacity: String(variant.capacity || variant.size || ""),
      priceTWD: int(variant.priceTWD ?? variant.priceTW ?? variant.price ?? 0),
      priceHKD: int(variant.priceHKD ?? variant.priceHK ?? 0),
      stock: int(variant.stock ?? 0),
      bulkMinQty: int(variant.bulkMinQty ?? variant.quantityDiscountMin ?? 0),
      bulkPriceTWD: int(variant.bulkPriceTWD ?? variant.quantityDiscountTWD ?? 0),
      bulkPriceHKD: int(variant.bulkPriceHKD ?? variant.quantityDiscountHKD ?? 0),
    }));
  }
  return [{
    id: variantId(),
    name: "一般容量",
    capacity: "",
    priceTWD: int(product.price || 0),
    priceHKD: int(product.priceHKD || 0),
    stock: int(product.stock || 0),
    bulkMinQty: 0,
    bulkPriceTWD: 0,
    bulkPriceHKD: 0,
  }];
}

function variantRowMarkup(variant, index) {
  return `<article class="variant-row" data-variant-row data-variant-id="${esc(variant.id)}">
    <div class="variant-row-head">
      <div class="variant-index">${String(index + 1).padStart(2, "0")}</div>
      <div class="field"><label>規格名稱</label><input data-v-name maxlength="80" value="${esc(variant.name)}" placeholder="例如：一般容量" required></div>
      <div class="field"><label>容量／尺寸</label><input data-v-capacity maxlength="60" value="${esc(variant.capacity)}" placeholder="例如：400ml" required></div>
      <div class="field"><label>規格庫存</label><input data-v-stock type="number" min="0" step="1" value="${variant.stock}" required></div>
      <button class="mini-btn variant-remove" type="button" data-variant-remove aria-label="刪除這個規格">刪除規格</button>
    </div>
    <div class="variant-pricing-grid">
      <div class="field"><label>台灣單價 NT$</label><input data-v-tw type="number" min="0" step="1" value="${variant.priceTWD}" required></div>
      <div class="field"><label>香港單價 HK$</label><input data-v-hk type="number" min="0" step="1" value="${variant.priceHKD}" required></div>
      <div class="field bulk-threshold"><label>數量優惠門檻</label><div class="input-suffix"><input data-v-bulk-min type="number" min="0" step="1" value="${variant.bulkMinQty}" placeholder="例如 2"><span>件以上</span></div><small>填 0 代表不啟用數量優惠。</small></div>
      <div class="field"><label>優惠單價 NT$</label><input data-v-bulk-tw type="number" min="0" step="1" value="${variant.bulkPriceTWD}" placeholder="例如 90"></div>
      <div class="field"><label>優惠單價 HK$</label><input data-v-bulk-hk type="number" min="0" step="1" value="${variant.bulkPriceHKD}" placeholder="例如 28"></div>
    </div>
  </article>`;
}

function renderVariantRows(container, variants) {
  container.innerHTML = variants.map(variantRowMarkup).join("");
  container.querySelectorAll("[data-variant-remove]").forEach((button) => {
    button.onclick = () => {
      const rows = container.querySelectorAll("[data-variant-row]");
      if (rows.length <= 1) return flash("每個商品至少需要一個規格。", "error");
      button.closest("[data-variant-row]")?.remove();
      renumberRows(container);
      document.dispatchEvent(new CustomEvent("77select:variants-changed"));
    };
  });
  document.dispatchEvent(new CustomEvent("77select:variants-changed"));
}

function renumberRows(container) {
  container.querySelectorAll("[data-variant-row]").forEach((row, index) => {
    const badge = row.querySelector(".variant-index");
    if (badge) badge.textContent = String(index + 1).padStart(2, "0");
  });
}

function collectVariants(form) {
  return [...form.querySelectorAll("[data-variant-row]")].map((row) => {
    const bulkMinQty = int(row.querySelector("[data-v-bulk-min]")?.value || 0);
    return {
      id: row.dataset.variantId || variantId(),
      name: row.querySelector("[data-v-name]").value.trim(),
      capacity: row.querySelector("[data-v-capacity]").value.trim(),
      priceTWD: int(row.querySelector("[data-v-tw]").value),
      priceHKD: int(row.querySelector("[data-v-hk]").value),
      stock: int(row.querySelector("[data-v-stock]").value),
      bulkMinQty: bulkMinQty >= 2 ? bulkMinQty : 0,
      bulkPriceTWD: bulkMinQty >= 2 ? int(row.querySelector("[data-v-bulk-tw]")?.value || 0) : 0,
      bulkPriceHKD: bulkMinQty >= 2 ? int(row.querySelector("[data-v-bulk-hk]")?.value || 0) : 0,
    };
  });
}

function validateVariants(variants) {
  if (!variants.length) return "請至少建立一個商品規格。";
  if (variants.some((variant) => !variant.name || !variant.capacity)) return "每個規格都要填寫規格名稱與容量／尺寸。";
  for (const variant of variants) {
    if (variant.bulkMinQty >= 2) {
      if (!variant.bulkPriceTWD || !variant.bulkPriceHKD) return `「${variant.name}」已設定數量優惠門檻，請同時填寫台灣與香港優惠單價。`;
      if (variant.bulkPriceTWD > variant.priceTWD || variant.bulkPriceHKD > variant.priceHKD) return `「${variant.name}」的優惠單價不可高於一般單價。`;
    }
  }
  return "";
}

function parseMedia(form, variants) {
  const hidden = $("#p-media-json", form);
  let rows = [];
  if (hidden?.value) {
    try { rows = JSON.parse(hidden.value); } catch { rows = []; }
  }
  const validVariantIds = new Set(variants.map((variant) => variant.id));
  rows = Array.isArray(rows) ? rows.map((row, index) => ({
    id: String(row?.id || `img-${index + 1}`),
    url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
    variantId: validVariantIds.has(String(row?.variantId || "")) ? String(row.variantId) : "",
    sortOrder: index,
  })).filter((row) => row.url) : [];

  if (!rows.length) {
    const legacy = $("#p-image", form)?.value.trim() || "";
    if (legacy) rows = [{ id: "legacy-main", url: legacy, variantId: "", sortOrder: 0 }];
  }
  return rows;
}

async function loadProduct(db, id) {
  if (!id) return {};
  const snap = await getDoc(doc(db, "shopProducts", id)).catch(() => null);
  return snap?.exists() ? { id: snap.id, ...snap.data() } : {};
}

async function saveVariantProduct(event, db, auth) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  if (button?.disabled) return;

  const variants = collectVariants(form);
  const variantError = validateVariants(variants);
  if (variantError) return flash(variantError, "error");

  const name = $("#p-name")?.value.trim() || "";
  const category = $("#p-category")?.value.trim() || "";
  if (!name || !category) return flash("請填寫商品名稱與分類。", "error");

  const media = parseMedia(form, variants);
  const twPrices = variants.map((variant) => variant.priceTWD);
  const hkPrices = variants.map((variant) => variant.priceHKD);
  const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const data = {
    name,
    category,
    variants,
    media,
    imageUrl: media[0]?.url || "",
    price: Math.min(...twPrices),
    priceHKD: Math.min(...hkPrices),
    stock: totalStock,
    pricingModel: "regional-variants-bulk-v2",
    supportedRegions: ["TW", "HK"],
    sortOrder: Math.round(Number($("#p-sort")?.value || 0)),
    description: $("#p-description")?.value.trim() || "",
    spec: $("#p-spec")?.value.trim() || "",
    active: Boolean($("#p-active")?.checked),
    updatedAt: serverTimestamp(),
  };

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "儲存中…";
  }

  try {
    let productId = activeEditId;
    if (productId) {
      await updateDoc(doc(db, "shopProducts", productId), data);
    } else {
      const ref = await addDoc(collection(db, "shopProducts"), { ...data, createdAt: serverTimestamp() });
      productId = ref.id;
    }

    const user = auth.currentUser;
    if (user) {
      addDoc(collection(db, "shopAuditLogs"), {
        adminUid: user.uid,
        adminEmail: user.email || null,
        action: activeEditId ? "product_update_variants" : "product_create_variants",
        targetId: productId,
        detail: `${name}｜${variants.length} variants｜${media.length} images｜TW/HK pricing + bulk discounts`,
        createdAt: serverTimestamp(),
      }).catch(console.warn);
    }

    const discounted = variants.filter((variant) => variant.bulkMinQty >= 2).length;
    flash(`商品已儲存：${variants.length} 個規格、${media.length} 張圖片${discounted ? `、${discounted} 個規格有數量優惠` : ""}。`);
    if (activeEditId) {
      const cancel = $("#cancel-product-edit");
      activeEditId = null;
      cancel?.click();
    } else {
      form.reset();
      if ($("#p-active")) $("#p-active").checked = true;
    }
  } catch (error) {
    console.error("77select variant product save failed", error);
    const text = String(error?.message || "");
    flash(text.includes("maximum size") || text.includes("1048576")
      ? "商品圖片資料太多，已超過 Firestore 單筆資料上限；請移除一張圖片或改用較小圖片。"
      : "商品儲存失敗，請檢查欄位與 Firestore 權限。", "error");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "儲存商品";
    }
  }
}

async function enhanceForm(form, db, auth) {
  if (form.dataset.variantEnhanced === "1") return;
  form.dataset.variantEnhanced = "1";

  const intro = form.querySelector(".admin-section-head .order-date");
  if (intro) intro.textContent = "商品可建立多個規格、TW/HK 獨立售價、規格庫存、數量優惠，以及多張規格對應圖片。";

  const legacyPrice = $("#p-price", form)?.closest(".field");
  const legacyStock = $("#p-stock", form)?.closest(".field");
  legacyPrice?.classList.add("legacy-variant-field");
  legacyStock?.classList.add("legacy-variant-field");
  $("#p-sort", form)?.closest(".field")?.classList.add("compact-field");

  const grid = form.querySelector(".settings-grid");
  const descriptionField = $("#p-description", form)?.closest(".field");
  if (!grid || !descriptionField) return;

  const section = document.createElement("section");
  section.className = "variant-editor wide";
  section.innerHTML = `<div class="variant-editor-head"><div><span class="variant-kicker">VARIANTS · REGIONAL PRICING · BULK</span><h3>商品規格、地區售價與數量優惠</h3><p>每個規格分別設定台灣／香港單價與庫存。若有「買 2 件以上單價較低」的優惠，填入門檻與兩地優惠價；沒有優惠則門檻填 0。</p></div><button class="secondary-btn" type="button" data-add-variant>＋ 新增規格</button></div><div class="variant-list" data-variant-list><div class="variant-loading">正在載入規格…</div></div>`;
  grid.insertBefore(section, descriptionField);

  const list = section.querySelector("[data-variant-list]");
  const product = await loadProduct(db, activeEditId);
  renderVariantRows(list, normalizeVariants(product));

  section.querySelector("[data-add-variant]").onclick = () => {
    const current = collectVariants(form);
    current.push({ id: variantId(), name: "", capacity: "", priceTWD: 0, priceHKD: 0, stock: 0, bulkMinQty: 0, bulkPriceTWD: 0, bulkPriceHKD: 0 });
    renderVariantRows(list, current);
    list.querySelector("[data-variant-row]:last-child [data-v-name]")?.focus();
  };

  form.addEventListener("submit", (event) => saveVariantProduct(event, db, auth), true);
}

try {
  const app = await waitForAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  document.addEventListener("click", (event) => {
    const edit = event.target.closest?.("[data-edit]");
    if (edit) activeEditId = edit.dataset.edit || null;
    if (event.target.closest?.("#cancel-product-edit")) activeEditId = null;
    const nav = event.target.closest?.('[data-view="products"]');
    if (nav && !edit) activeEditId = null;
  }, true);

  const refresh = () => {
    const form = $("#product-form");
    if (form) enhanceForm(form, db, auth).catch((error) => console.error("77select variant editor failed", error));
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();
} catch (error) {
  console.error("77select variant editor bootstrap failed", error);
}
