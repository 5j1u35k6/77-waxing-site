import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_APP_NAME = "77waxing-shop-admin";
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 650000;
const MAX_IMAGE_DIMENSION = 600;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function escapeAttr(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function previewMarkup(url) {
  return url
    ? `<img src="${escapeAttr(url)}" alt="商品圖片預覽">`
    : `<span>尚未選擇圖片</span>`;
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
    [600, 0.76],
    [600, 0.66],
    [560, 0.60],
    [520, 0.54],
    [480, 0.48],
  ];

  let dataUrl = "";
  for (const [dimension, quality] of attempts) {
    dataUrl = drawCompressed(image, dimension, quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
  }
  throw new Error("IMAGE_TOO_LARGE_AFTER_COMPRESSION");
}

function enhanceImageField() {
  const original = document.querySelector("#p-image");
  if (!original || original.dataset.uploadEnhanced === "1") return;

  const field = original.closest(".field");
  if (!field) return;
  const currentValue = original.value.trim();

  field.classList.add("product-image-upload");
  field.innerHTML = `
    <label>商品圖片</label>
    <input id="p-image" type="hidden" value="${escapeAttr(currentValue)}" data-upload-enhanced="1">
    <div class="product-image-upload-preview" data-image-preview>${previewMarkup(currentValue)}</div>
    <div class="product-image-upload-actions">
      <label class="product-image-upload-button">選擇圖片<input id="p-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
      <button class="mini-btn" type="button" data-image-remove>移除圖片</button>
    </div>
    <div class="product-image-upload-progress" aria-hidden="true"><i data-image-progress></i></div>
    <div class="product-image-upload-status" data-image-status>圖片會自動壓縮後存入 Firestore，不需要 Firebase Storage。</div>`;

  const hidden = field.querySelector("#p-image");
  const input = field.querySelector("#p-image-file");
  const preview = field.querySelector("[data-image-preview]");
  const status = field.querySelector("[data-image-status]");
  const progress = field.querySelector("[data-image-progress]");
  const remove = field.querySelector("[data-image-remove]");

  remove.addEventListener("click", () => {
    hidden.value = "";
    input.value = "";
    preview.innerHTML = previewMarkup("");
    progress.style.width = "0%";
    status.classList.remove("error");
    status.textContent = "圖片已移除；儲存商品後生效。";
  });

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.classList.remove("error");

    if (!file.type.startsWith("image/")) {
      status.classList.add("error");
      status.textContent = "請選擇圖片檔案。";
      input.value = "";
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      status.classList.add("error");
      status.textContent = "原始圖片超過 12MB，請先縮小後再選擇。";
      input.value = "";
      return;
    }

    try {
      status.textContent = "正在壓縮圖片…";
      progress.style.width = "35%";
      const dataUrl = await resizeAndConvertToBase64(file);
      progress.style.width = "100%";
      hidden.value = dataUrl;
      preview.innerHTML = previewMarkup(dataUrl);
      status.textContent = `圖片處理完成（約 ${Math.round(dataUrl.length / 1024)} KB），儲存商品後寫入 Firestore。`;
    } catch (error) {
      console.error("77select image processing failed", error);
      status.classList.add("error");
      status.textContent = error?.message === "IMAGE_TOO_LARGE_AFTER_COMPRESSION"
        ? "圖片壓縮後仍過大，請改用較簡單或較小的圖片。"
        : "圖片處理失敗，請換一張圖片再試。";
      progress.style.width = "0%";
      input.value = "";
    }
  });
}

try {
  const app = await waitForAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const refresh = () => {
    setBrandText();
    enhanceImageField();
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
