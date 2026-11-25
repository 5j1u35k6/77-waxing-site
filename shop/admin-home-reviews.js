export const maxReviewImages = 6;
const maxAltLength = 300;
const maxFileBytes = 20 * 1024 * 1024;
const maxBatchBytes = 48 * 1024 * 1024;
const maxDataLength = 220000;
const supportedData = /^data:image\/(?:webp|jpeg);base64,[a-zA-Z0-9+/=]+$/;
const safeImageId = /^[a-zA-Z0-9-]{1,80}$/;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export const reviewImageDocumentId = (id) => `home-review-${id}`;
export const validReviewImageData = (value) => typeof value === "string"
  && value.length <= maxDataLength && supportedData.test(value);

function dimension(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 1440 ? number : 0;
}

export function normalizeReviewImages(value) {
  if (!Array.isArray(value)) return [];
  const rows = new Map();
  for (const row of value) {
    if (typeof row?.id !== "string" || !safeImageId.test(row.id) || rows.has(row.id)) continue;
    const alt = typeof row.alt === "string" ? row.alt.trim().slice(0, maxAltLength) : "";
    rows.set(row.id, { id: row.id, width: dimension(row.width), height: dimension(row.height), alt });
    if (rows.size === maxReviewImages) break;
  }
  return [...rows.values()];
}

export function homepageReviewMarkup() {
  return `<div class="admin-review-editor">
    <div class="product-media-upload-head">
      <p id="h-review-help">可選擇多張照片，最多 ${maxReviewImages} 張。儲存首頁後，照片會依照下方順序公開顯示。</p>
      <label class="product-image-upload-button">選擇圖片
        <input id="h-review-files" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif" multiple aria-describedby="h-review-help">
      </label>
    </div>
    <progress data-review-image-progress aria-label="圖片處理進度" hidden></progress>
    <p class="product-image-upload-status" data-review-image-status role="status"></p>
    <div class="product-media-list" data-review-image-list></div>
  </div>`;
}

async function encodeReviewImage(file) {
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("無法開啟這張圖片，請改用 JPG、PNG 或 WebP。"));
      image.src = source;
    });
    const { naturalWidth, naturalHeight } = image;
    if (!naturalWidth || !naturalHeight) throw new Error("無法辨識圖片尺寸。");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("目前的瀏覽器無法處理圖片。");
    for (const maxSide of [1440, 1080, 840, 640, 480]) {
      const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [.88, .75, .58]) {
        const preferred = canvas.toDataURL("image/webp", quality);
        const dataUrl = preferred.startsWith("data:image/webp;") ? preferred : canvas.toDataURL("image/jpeg", quality);
        if (validReviewImageData(dataUrl)) return { dataUrl, width, height };
      }
    }
    throw new Error("圖片處理後仍超過容量上限，請先縮小後再試。");
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function bindHomepageReviewEditor(form, savedImages, loadImage) {
  const fileInput = form.querySelector("#h-review-files");
  const list = form.querySelector("[data-review-image-list]");
  const progress = form.querySelector("[data-review-image-progress]");
  const status = form.querySelector("[data-review-image-status]");
  const saveButton = form.querySelector('button[type="submit"]');
  const previews = new Map();
  const drafts = new Map();
  let original = normalizeReviewImages(savedImages);
  let rows = original.map((row) => ({ ...row }));

  function report(message, hasErrors = false) {
    status.textContent = message;
    status.classList.toggle("error", hasErrors);
  }

  function previewFor(id) {
    if (drafts.has(id)) return Promise.resolve(drafts.get(id));
    if (!previews.has(id)) previews.set(id, Promise.resolve().then(() => loadImage(id)).catch(() => null));
    return previews.get(id);
  }

  function render() {
    fileInput.disabled = rows.length >= maxReviewImages;
    if (!rows.length) {
      list.innerHTML = '<p class="product-media-empty">尚未加入顧客心得圖片</p>';
      return;
    }
    list.innerHTML = rows.map(({ id, alt }, index) => `<article class="product-media-card" data-review-image-id="${id}">
      <div class="product-media-thumb">
        <img alt="" hidden>
        <p class="order-date" data-review-preview-placeholder>讀取圖片預覽…</p>
        <span>第 ${index + 1} 張</span>
      </div>
      <div class="product-media-card-body">
        <div class="field">
          <label for="h-review-alt-${id}">圖片描述（選填）</label>
          <input id="h-review-alt-${id}" data-review-image-alt type="text" value="${escapeHtml(alt)}" maxlength="${maxAltLength}">
        </div>
        <div class="product-media-card-actions">
          <button class="mini-btn" type="button" data-review-image-move="-1"${index === 0 ? " disabled" : ""}>前移</button>
          <button class="mini-btn" type="button" data-review-image-move="1"${index === rows.length - 1 ? " disabled" : ""}>後移</button>
          <button class="mini-btn danger-text" type="button" data-review-image-remove>移除</button>
        </div>
      </div>
    </article>`).join("");
    for (const card of list.querySelectorAll("[data-review-image-id]")) {
      previewFor(card.dataset.reviewImageId).then((dataUrl) => {
        if (!card.isConnected) return;
        const placeholder = card.querySelector("[data-review-preview-placeholder]");
        if (!validReviewImageData(dataUrl)) {
          placeholder.textContent = "無法預覽此圖片";
          return;
        }
        const image = card.querySelector("img");
        image.src = dataUrl;
        image.hidden = false;
        placeholder.hidden = true;
      });
    }
  }

  function markEdited() {
    form.dataset.dirty = "1";
  }

  list.addEventListener("input", (event) => {
    if (!event.target.matches("[data-review-image-alt]")) return;
    const id = event.target.closest("[data-review-image-id]").dataset.reviewImageId;
    const row = rows.find((image) => image.id === id);
    row.alt = event.target.value;
    markEdited();
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const card = button.closest("[data-review-image-id]");
    const id = card.dataset.reviewImageId;
    const previous = rows.findIndex((image) => image.id === id);
    if (button.hasAttribute("data-review-image-remove")) {
      rows.splice(previous, 1);
      drafts.delete(id);
      render();
      list.querySelectorAll("[data-review-image-remove]")[Math.min(previous, rows.length - 1)]?.focus();
    } else {
      const index = previous + Number(button.dataset.reviewImageMove);
      if (index < 0 || index >= rows.length) return;
      [rows[previous], rows[index]] = [rows[index], rows[previous]];
      render();
      const controls = list.querySelector(`[data-review-image-id="${id}"]`);
      const next = controls.querySelector(`[data-review-image-move="${button.dataset.reviewImageMove}"]:not(:disabled)`)
        || controls.querySelector("[data-review-image-move]:not(:disabled)");
      next?.focus();
    }
    markEdited();
    report(`目前共 ${rows.length} 張圖片，請儲存首頁套用變更。`);
  });

  fileInput.addEventListener("change", async () => {
    const files = [...(fileInput.files || [])];
    fileInput.value = "";
    if (!files.length) return;
    if (files.length + rows.length > maxReviewImages) {
      report(`最多可上傳 ${maxReviewImages} 張圖片，目前還可加入 ${maxReviewImages - rows.length} 張。`, true);
      return;
    }
    if (files.reduce((bytes, file) => bytes + file.size, 0) > maxBatchBytes) {
      report("本次選取超過 48 MB，請分批加入圖片。", true);
      return;
    }

    form.dataset.reviewImageProcessing = "1";
    const wasDisabled = saveButton.disabled;
    saveButton.disabled = true;
    fileInput.disabled = true;
    list.inert = true;
    progress.hidden = false;
    progress.max = files.length;
    progress.value = 0;
    const errors = [];
    let added = 0;
    try {
      for (const [index, file] of files.entries()) {
        report(`正在處理第 ${index + 1} 張，共 ${files.length} 張…`);
        try {
          if (file.size > maxFileBytes) throw new Error("檔案超過 20 MB，請先縮小圖片。");
          const { dataUrl, width, height } = await encodeReviewImage(file);
          if (!form.isConnected) return;
          const id = globalThis.crypto.randomUUID();
          rows.push({ id, width, height, alt: "" });
          drafts.set(id, dataUrl);
          markEdited();
          added += 1;
        } catch (error) {
          errors.push(`「${file.name}」${error.message}`);
        }
        progress.value = index + 1;
      }
    } finally {
      form.dataset.reviewImageProcessing = "";
      saveButton.disabled = wasDisabled;
      list.inert = false;
      progress.hidden = true;
      render();
      const outcome = added ? `已加入 ${added} 張圖片，請儲存首頁套用變更。` : "";
      report([outcome, ...errors].filter(Boolean).join(" "), Boolean(errors.length));
    }
  });

  render();
  return {
    changes() {
      const next = normalizeReviewImages(rows);
      if (JSON.stringify(next) === JSON.stringify(original)) return null;
      return {
        original,
        next,
        added: next.filter(({ id }) => drafts.has(id)).map((row) => ({ ...row, dataUrl: drafts.get(row.id) })),
        removed: original.filter(({ id }) => !next.some((row) => row.id === id)),
      };
    },
    saved(next) {
      original = next;
      rows = original.map((row) => ({ ...row }));
      for (const [id, dataUrl] of drafts) previews.set(id, Promise.resolve(dataUrl));
      drafts.clear();
      render();
      report("顧客心得圖片已儲存。");
    },
  };
}
