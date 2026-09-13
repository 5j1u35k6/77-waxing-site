import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

const { db } = getPublicFirebase();
const cropByUrl = new Map();
let mediaLayoutSignature = null;

const ranged = (value, min, max, fallback) => {
  const parsed = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
};

function imageKey(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (/^(?:data:|blob:)/i.test(raw)) return raw;
  try { return new URL(raw, location.href).href; }
  catch { return raw; }
}

function normalizeCrop(row = {}) {
  return {
    focusX: ranged(row.focusX, 0, 100, 50),
    focusY: ranged(row.focusY, 0, 100, 50),
    cropZoom: ranged(row.cropZoom, 1, 5, 1),
  };
}

function clearCrop(image) {
  if (!(image instanceof HTMLImageElement) || image.dataset.mediaCropApplied !== "1") return;
  image.style.removeProperty("position");
  image.style.removeProperty("left");
  image.style.removeProperty("top");
  image.style.removeProperty("width");
  image.style.removeProperty("height");
  image.style.removeProperty("max-width");
  image.style.removeProperty("max-height");
  image.style.removeProperty("object-fit");
  image.style.removeProperty("object-position");
  image.style.removeProperty("transform");
  image.style.removeProperty("transform-origin");
  image.style.removeProperty("pointer-events");
  delete image.dataset.mediaCropApplied;
}

function contentBox(container) {
  const style = getComputedStyle(container);
  const left = Number.parseFloat(style.paddingLeft) || 0;
  const right = Number.parseFloat(style.paddingRight) || 0;
  const top = Number.parseFloat(style.paddingTop) || 0;
  const bottom = Number.parseFloat(style.paddingBottom) || 0;
  return {
    left,
    top,
    width: Math.max(0, container.clientWidth - left - right),
    height: Math.max(0, container.clientHeight - top - bottom),
  };
}

function applyCrop(image) {
  if (!(image instanceof HTMLImageElement)) return;
  const crop = cropByUrl.get(imageKey(image.currentSrc || image.src));
  if (!crop) {
    clearCrop(image);
    return;
  }

  if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
    if (image.dataset.mediaCropWaiting !== "1") {
      image.dataset.mediaCropWaiting = "1";
      image.addEventListener("load", () => {
        delete image.dataset.mediaCropWaiting;
        applyCrop(image);
      }, { once: true });
    }
    return;
  }

  const container = image.parentElement;
  if (!(container instanceof HTMLElement)) return;
  const box = contentBox(container);
  if (!box.width || !box.height) {
    requestAnimationFrame(() => applyCrop(image));
    return;
  }

  const baseScale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const baseWidth = image.naturalWidth * baseScale;
  const baseHeight = image.naturalHeight * baseScale;
  const zoom = crop.cropZoom;
  const renderedWidth = baseWidth * zoom;
  const renderedHeight = baseHeight * zoom;
  const focusX = crop.focusX / 100;
  const focusY = crop.focusY / 100;

  // The admin crop box always keeps the source image's aspect ratio. Recreate
  // that exact window here: at 100% the whole source image is contained; when
  // zoomed, the selected source window is enlarged back to the same contained
  // size and centered on the saved focal point.
  const left = box.left + box.width / 2 - focusX * renderedWidth;
  const top = box.top + box.height / 2 - focusY * renderedHeight;

  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  image.dataset.mediaCropApplied = "1";
  image.style.setProperty("position", "absolute", "important");
  image.style.setProperty("left", `${left}px`, "important");
  image.style.setProperty("top", `${top}px`, "important");
  image.style.setProperty("width", `${renderedWidth}px`, "important");
  image.style.setProperty("height", `${renderedHeight}px`, "important");
  image.style.setProperty("max-width", "none", "important");
  image.style.setProperty("max-height", "none", "important");
  image.style.setProperty("object-fit", "fill", "important");
  image.style.setProperty("object-position", "50% 50%", "important");
  image.style.setProperty("transform", "none", "important");
  image.style.setProperty("transform-origin", "50% 50%", "important");
  image.style.setProperty("pointer-events", "none", "important");
}

function applyAll(root = document) {
  if (root instanceof HTMLImageElement) applyCrop(root);
  root.querySelectorAll?.(".store-product-media img, .product-gallery-main img, .gallery-thumb img, .cart-row .product-media img").forEach(applyCrop);
}

function layoutSignature(snapshot) {
  return JSON.stringify(snapshot.docs.map((docSnap) => {
    const product = docSnap.data() || {};
    const media = Array.isArray(product.media) ? product.media : [];
    return {
      id: docSnap.id,
      imageUrl: String(product.imageUrl || ""),
      media: media.map((row, index) => ({
        id: String(row?.id || `image-${index + 1}`),
        url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
        variantId: String(row?.variantId || ""),
        sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
      })),
    };
  }).sort((a, b) => a.id.localeCompare(b.id)));
}

function syncCropSettings(snapshot) {
  cropByUrl.clear();
  snapshot.docs.forEach((docSnap) => {
    const product = docSnap.data() || {};
    const media = Array.isArray(product.media) ? product.media : [];
    media.forEach((row) => {
      const key = imageKey(row?.url || row?.dataUrl || row?.imageUrl || "");
      if (!key) return;
      cropByUrl.set(key, normalizeCrop(row));
    });
  });
  applyAll();

  const nextSignature = layoutSignature(snapshot);
  if (mediaLayoutSignature === null) {
    mediaLayoutSignature = nextSignature;
    return;
  }
  if (nextSignature !== mediaLayoutSignature) {
    mediaLayoutSignature = nextSignature;
    location.reload();
  }
}

const observer = new MutationObserver((records) => {
  records.forEach((record) => {
    if (record.type === "attributes") {
      applyCrop(record.target);
      return;
    }
    record.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) applyAll(node);
    });
  });
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src"],
});

const resizeObserver = new ResizeObserver((entries) => {
  entries.forEach((entry) => {
    entry.target.querySelectorAll?.("img").forEach(applyCrop);
  });
});

const observedContainers = new WeakSet();
const observeCropContainers = (root = document) => {
  root.querySelectorAll?.(".store-product-media, .product-gallery-main, .gallery-thumb, .cart-row .product-media").forEach((container) => {
    if (observedContainers.has(container)) return;
    observedContainers.add(container);
    resizeObserver.observe(container);
  });
};

new MutationObserver((records) => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches?.(".store-product-media, .product-gallery-main, .gallery-thumb, .cart-row .product-media")) {
        if (!observedContainers.has(node)) {
          observedContainers.add(node);
          resizeObserver.observe(node);
        }
      }
      observeCropContainers(node);
    });
  });
}).observe(document.documentElement, { childList: true, subtree: true });

observeCropContainers();

onSnapshot(
  query(collection(db, "shopProducts"), where("active", "==", true)),
  syncCropSettings,
  (error) => console.warn("77select media crop settings unavailable", error),
);
