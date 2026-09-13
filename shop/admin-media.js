import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_APP_NAME = "77waxing-shop-admin";
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 210000;
const MAX_MEDIA_TOTAL_LENGTH = 780000;
const MAX_IMAGE_DIMENSION = 640;
const MAX_IMAGES = 6;

let activeEditId = null;
let mediaState = [];
let activeField = null;
let activeFormToken = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function waitForAdminApp() {
  for (let i = 0; i < 160; i += 1) {
    const app = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME);
    if (app) return app;
    await sleep(50);
  }
  throw new Error("77select admin Firebase app did not initialize in time.");
}

function setBrandText() {
  document.querySelectorAll(".shop-brand").forEach((brand) => {
    if (brand.dataset.selectBrand === "1") return;
    const small = brand.querySelector("small")?.textContent || "SHOP ADMIN";
    brand.innerHTML = `<b>77</b>select<small>${small}</small>`;
    brand.dataset.selectBrand = "1";
  });
}

async function migrateBrandSettings(db, user) {
  if (!user || user.isAnonymous) return;
  const adminSnap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
  if (!adminSnap?.exists()) return;

  const settingsRef = doc(db, "shopSettings", "public");
  const snap = await getDoc(settingsRef).catch(() => null);
  const current = snap?.exists() ? snap.data() : {};
  const patch = {};

  if (!current.storeName || current.storeName === "77waxing") patch.storeName = "77select";
  if (!current.heroEyebrow || current.heroEyebrow === "77WAXING SELECT") patch.heroEyebrow = "77SELECT";
  if (!current.heroDescription || String(current.heroDescription).includes("77waxing 後台")) {
    patch.heroDescription = "產品內容會由 77select 後台持續更新；價格、庫存與交付方式以訂單確認內容為準。";
  }

  if (Object.keys(patch).length) await setDoc(settingsRef, patch, { merge: true });
}

function mediaId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMedia(product = {}) {
  const source = Array.isArray(product.media) ? product.media : [];
  const rows = source
    .map((row, index) => ({
      id: String(row?.id || mediaId()),
      url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
      variantId: String(row?.variantId || ""),
      sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
    }))
    .filter((row) => row.url)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, MAX_IMAGES);

  if (!rows.length && product.imageUrl) {
    rows.push({ id: mediaId(), url: String(product.imageUrl), variantId: "", sortOrder: 0 });
  }
  return rows;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = String(reader.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function drawCompressed(image, maxDimension, quality) {
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function resizeAndConvertToBase64(file) {
  const image = await readImage(file);
  const attempts = [
    [MAX_IMAGE_DIMENSION, 0.72],
    [600, 0.64],
    [560, 0.58],
    [520, 0.52],
    [480, 0.46],
    [440, 0.42],
  ];

  let dataUrl = "";
  for (const [dimension, quality] of attempts) {
    dataUrl = drawCompressed(image, dimension, quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
  }
  throw new Error("IMAGE_TOO_LARGE_AFTER_COMPRESSION");
}

function variantChoices() {
  return [...document.querySelectorAll("[data-variant-row]")].map((row, index) => {
    const id = String(row.dataset.variantId || "");
    const name = row.querySelector("[data-v-name]")?.value.trim() || `規格 ${index + 1}`;
    const capacity = row.querySelector("[data-v-capacity]")?.value.trim() || "";
    return { id, label: [name, capacity].filter(Boolean).join("｜") };
  }).filter((row) => row.id);
}

function totalMediaLength(rows = mediaState) {
  return rows.reduce((sum, row) => sum + String(row.url || "").length, 0);
}

function syncHidden() {
  if (!activeField) return;
  const mediaInput = activeField.querySelector("#p-media-json");
  const legacyInput = activeField.querySelector("#p-image");
  mediaState = mediaState.map((row, index) => ({ ...row, sortOrder: index }));
  if (mediaInput) mediaInput.value = JSON.stringify(mediaState);
  if (legacyInput) legacyInput.value = mediaState[0]?.url || "";
}

function setStatus(message, error = false) {
  if (!activeField) return;
  const status = activeField.querySelector("[data-image-status]");
  if (!status) return;
  status.classList.toggle("error", error);
  status.textContent = message;
}

function renderGalleryCards() {
  if (!activeField) return;
  const host = activeField.querySelector("[data-media-list]");
  if (!host) return;
  const variants = variantChoices();
  const validIds = new Set(variants.map((row) => row.id));
  mediaState = mediaState.map((row) => validIds.has(row.variantId) || !row.variantId ? row : { ...row, variantId: "" });

  if (!mediaState.length) {
    host.innerHTML = `<div class="product-media-empty">尚未加入商品圖片</div>`;
    syncHidden();
    return;
  }

  host.innerHTML = mediaState.map((row, index) => `<article class="product-media-card" data-media-id="${esc(row.id)}">
    <div class="product-media-thumb"><img src="${esc(row.url)}" alt="商品圖片 ${index + 1}"><span>${index === 0 ? "主圖" : String(index + 1).padStart(2, "0")}</span></div>
    <div class="product-media-card-body">
      <label>顯示於</label>
      <select data-media-variant>
        <option value="" ${!row.variantId ? "selected" : ""}>所有規格共用</option>
        ${variants.map((variant) => `<option value="${esc(variant.id)}" ${row.variantId === variant.id ? "selected" : ""}>只顯示：${esc(variant.label)}</option>`).join("")}
      </select>
      <div class="product-media-card-actions">
        <button class="mini-btn" type="button" data-media-move="-1" ${index === 0 ? "disabled" : ""}>← 前移</button>
        <button class="mini-btn" type="button" data-media-move="1" ${index === mediaState.length - 1 ? "disabled" : ""}>後移 →</button>
        <button class="mini-btn danger-text" type="button" data-media-remove>移除</button>
      </div>
    </div>
  </article>`).join("");

  host.querySelectorAll("[data-media-variant]").forEach((select) => {
    select.onchange = () => {
      const card = select.closest("[data-media-id]");
      const row = mediaState.find((item) => item.id === card?.dataset.mediaId);
      if (row) row.variantId = select.value;
      syncHidden();
    };
  });

  host.querySelectorAll("[data-media-remove]").forEach((button) => {
    button.onclick = () => {
      const id = button.closest("[data-media-id]")?.dataset.mediaId;
      mediaState = mediaState.filter((row) => row.id !== id);
      syncHidden();
      renderGalleryCards();
      setStatus(`目前 ${mediaState.length} 張圖片，約 ${Math.round(totalMediaLength() / 1024)} KB。`);
    };
  });

  host.querySelectorAll("[data-media-move]").forEach((button) => {
    button.onclick = () => {
      const id = button.closest("[data-media-id]")?.dataset.mediaId;
      const index = mediaState.findIndex((row) => row.id === id);
      const target = index + Number(button.dataset.mediaMove || 0);
      if (index < 0 || target < 0 || target >= mediaState.length) return;
      [mediaState[index], mediaState[target]] = [mediaState[target], mediaState[index]];
      syncHidden();
      renderGalleryCards();
    };
  });

  syncHidden();
}

async function loadProduct(db, id) {
  if (!id) return {};
  const snap = await getDoc(doc(db, "shopProducts", id)).catch(() => null);
  return snap?.exists() ? snap.data() : {};
}

async function enhanceImageField(db) {
  const original = document.querySelector("#p-image");
  const form = document.querySelector("#product-form");
  if (!original || !form) return;
  const token = `${activeEditId || "new"}:${form.dataset.variantEnhanced || "0"}`;
  if (original.dataset.galleryEnhanced === "1" && activeFormToken === token) return;

  const field = original.closest(".field");
  if (!field) return;
  activeField = field;
  activeFormToken = token;

  const product = await loadProduct(db, activeEditId);
  mediaState = normalizeMedia(product);
  const legacyValue = original.value.trim();
  if (!mediaState.length && legacyValue) mediaState = [{ id: mediaId(), url: legacyValue, variantId: "", sortOrder: 0 }];

  field.classList.add("product-image-upload", "wide");
  field.innerHTML = `
    <label>商品圖片</label>
    <input id="p-image" type="hidden" value="${esc(mediaState[0]?.url || "")}" data-gallery-enhanced="1">
    <input id="p-media-json" type="hidden" value="">
    <div class="product-media-upload-head">
      <div><b>商品圖庫</b><p>可上傳多張圖片，並指定為「所有規格共用」或只顯示於某一規格。第一張會作為商品主圖。</p></div>
      <label class="product-image-upload-button">＋ 選擇圖片<input id="p-image-file" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif"></label>
    </div>
    <div class="product-media-list" data-media-list></div>
    <div class="product-image-upload-progress" aria-hidden="true"><i data-image-progress></i></div>
    <div class="product-image-upload-status" data-image-status>圖片會在瀏覽器壓縮後存入 Firestore，不需要 Firebase Storage。最多 ${MAX_IMAGES} 張。</div>`;

  const input = field.querySelector("#p-image-file");
  const progress = field.querySelector("[data-image-progress]");

  input.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    if (!files.length) return;
    if (mediaState.length + files.length > MAX_IMAGES) {
      setStatus(`每個商品最多 ${MAX_IMAGES} 張圖片；目前已有 ${mediaState.length} 張。`, true);
      input.value = "";
      return;
    }

    let completed = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setStatus("其中有檔案不是圖片，已略過。", true);
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        setStatus(`「${file.name}」超過 12MB，請先縮小後再上傳。`, true);
        continue;
      }

      try {
        setStatus(`正在處理 ${file.name}…`);
        const dataUrl = await resizeAndConvertToBase64(file);
        if (totalMediaLength() + dataUrl.length > MAX_MEDIA_TOTAL_LENGTH) {
          setStatus("商品圖片總量已接近 Firestore 單筆文件上限，請移除一張或改用較小圖片。", true);
          break;
        }
        mediaState.push({ id: mediaId(), url: dataUrl, variantId: "", sortOrder: mediaState.length });
        completed += 1;
        progress.style.width = `${Math.round((completed / files.length) * 100)}%`;
        renderGalleryCards();
      } catch (error) {
        console.error("77select image processing failed", error);
        setStatus(error?.message === "IMAGE_TOO_LARGE_AFTER_COMPRESSION"
          ? `「${file.name}」壓縮後仍過大，請換較簡單或較小的圖片。`
          : `「${file.name}」處理失敗，請換一張再試。`, true);
      }
    }

    input.value = "";
    if (completed) {
      syncHidden();
      setStatus(`已加入 ${completed} 張。現在共 ${mediaState.length} 張，約 ${Math.round(totalMediaLength() / 1024)} KB；儲存商品後生效。`);
      setTimeout(() => { if (progress) progress.style.width = "0%"; }, 700);
    }
  });

  renderGalleryCards();
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

  document.addEventListener("77select:variants-changed", () => renderGalleryCards());
  document.addEventListener("input", (event) => {
    if (event.target.matches?.("[data-v-name],[data-v-capacity]")) renderGalleryCards();
  });

  const refresh = () => {
    setBrandText();
    enhanceImageField(db).catch((error) => console.error("77select gallery enhancement failed", error));
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();

  onAuthStateChanged(auth, (user) => {
    if (!user || user.isAnonymous) return;
    migrateBrandSettings(db, user).catch((error) => console.warn("77select brand migration failed", error));
    refresh();
  });
} catch (error) {
  console.error("77select admin enhancements failed", error);
}
