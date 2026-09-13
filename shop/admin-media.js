import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const ADMIN_APP_NAME = "77waxing-shop-admin";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
  document.querySelectorAll("h1,p").forEach((node) => {
    if (node.childElementCount) return;
    if (node.textContent?.includes("77waxing 產品訂購後台")) node.textContent = node.textContent.replace("77waxing", "77select");
    if (node.textContent?.includes("正在連線至 77waxing Firebase")) node.textContent = node.textContent.replace("77waxing", "77select");
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

  if (Object.keys(patch).length) {
    await setDoc(settingsRef, patch, { merge: true });
  }
}

function safeFileName(name) {
  const base = String(name || "product-image")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return base || "product-image";
}

function previewMarkup(url) {
  return url
    ? `<img src="${url.replace(/"/g, "&quot;")}" alt="商品圖片預覽">`
    : `<span>尚未上傳圖片</span>`;
}

function enhanceImageField(storage, auth) {
  const original = document.querySelector("#p-image");
  if (!original || original.dataset.uploadEnhanced === "1") return;

  const field = original.closest(".field");
  if (!field) return;
  const currentUrl = original.value.trim();

  field.classList.add("product-image-upload");
  field.innerHTML = `
    <label>商品圖片</label>
    <input id="p-image" type="hidden" value="${currentUrl.replace(/"/g, "&quot;")}" data-upload-enhanced="1">
    <div class="product-image-upload-preview" data-image-preview>${previewMarkup(currentUrl)}</div>
    <div class="product-image-upload-actions">
      <label class="product-image-upload-button">選擇圖片<input id="p-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
      <button class="mini-btn" type="button" data-image-remove>移除圖片</button>
    </div>
    <div class="product-image-upload-progress" aria-hidden="true"><i data-image-progress></i></div>
    <div class="product-image-upload-status" data-image-status>支援 JPG、PNG、WebP、AVIF，單張上限 8MB。</div>`;

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
    status.textContent = "圖片已從此商品移除；儲存商品後生效。";
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
    if (file.size > MAX_IMAGE_BYTES) {
      status.classList.add("error");
      status.textContent = "圖片超過 8MB，請先縮小後再上傳。";
      input.value = "";
      return;
    }
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      status.classList.add("error");
      status.textContent = "管理員登入已失效，請重新登入後再上傳。";
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      const path = `shop-products/${uid}/${Date.now()}-${safeFileName(file.name)}`;
      const task = uploadBytesResumable(ref(storage, path), file, {
        contentType: file.type,
        cacheControl: "public,max-age=31536000,immutable",
        customMetadata: { uploadedBy: uid, source: "77select-admin" },
      });

      status.textContent = "正在上傳…";
      progress.style.width = "0%";

      await new Promise((resolve, reject) => {
        task.on("state_changed", (snapshot) => {
          const pct = snapshot.totalBytes ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
          progress.style.width = `${Math.max(2, Math.min(100, pct))}%`;
          status.textContent = `正在上傳 ${Math.round(pct)}%`;
        }, reject, resolve);
      });

      const url = await getDownloadURL(task.snapshot.ref);
      hidden.value = url;
      preview.innerHTML = previewMarkup(url);
      progress.style.width = "100%";
      status.textContent = "圖片上傳完成。儲存商品後就會顯示在前台。";
    } catch (error) {
      console.error("77select image upload failed", error);
      status.classList.add("error");
      status.textContent = error?.code === "storage/unauthorized"
        ? "沒有圖片上傳權限。請確認 Firebase Storage Rules 已部署。"
        : "圖片上傳失敗，請稍後再試。";
      progress.style.width = "0%";
    }
  });
}

try {
  const app = await waitForAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const refresh = () => {
    setBrandText();
    enhanceImageField(storage, auth);
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
