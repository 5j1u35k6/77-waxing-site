import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

const { db } = getPublicFirebase();
const cropByUrl = new Map();
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
  image.style.removeProperty("object-fit");
  image.style.removeProperty("object-position");
  image.style.removeProperty("transform");
  image.style.removeProperty("transform-origin");
  image.style.removeProperty("pointer-events");
  delete image.dataset.mediaCropApplied;
}

function applyCrop(image) {
  if (!(image instanceof HTMLImageElement)) return;
  const crop = cropByUrl.get(imageKey(image.currentSrc || image.src));
  if (!crop || crop.cropZoom <= 1.001) {
    clearCrop(image);
    return;
  }

  image.dataset.mediaCropApplied = "1";
  image.style.setProperty("object-fit", "cover", "important");
  image.style.setProperty("object-position", `${crop.focusX}% ${crop.focusY}%`, "important");
  image.style.setProperty("transform-origin", `${crop.focusX}% ${crop.focusY}%`, "important");
  image.style.setProperty("transform", `scale(${crop.cropZoom})`, "important");
  image.style.setProperty("pointer-events", "none", "important");
}

function applyAll(root = document) {
  if (root instanceof HTMLImageElement) applyCrop(root);
  root.querySelectorAll?.(".store-product-media img, .product-gallery-main img, .gallery-thumb img, .cart-row .product-media img").forEach(applyCrop);
}

async function loadCropSettings() {
  const snap = await getDocs(query(collection(db, "shopProducts"), where("active", "==", true)));
  cropByUrl.clear();
  snap.docs.forEach((docSnap) => {
    const product = docSnap.data() || {};
    const media = Array.isArray(product.media) ? product.media : [];
    media.forEach((row) => {
      const key = imageKey(row?.url || row?.dataUrl || row?.imageUrl || "");
      if (!key) return;
      cropByUrl.set(key, normalizeCrop(row));
    });
  });
  applyAll();
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

loadCropSettings().catch((error) => console.warn("77select media crop settings unavailable", error));
