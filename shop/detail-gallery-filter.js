function normalizeUrl(value) {
  try { return new URL(String(value || ""), location.href).href; }
  catch { return String(value || ""); }
}

function findCoverUrl(detail) {
  const title = detail.querySelector(".product-detail-copy h2")?.textContent?.trim();
  if (!title) return "";
  const card = [...document.querySelectorAll(".regional-product-card")].find((node) =>
    node.querySelector(".card-format-title,.product-title")?.textContent?.trim() === title
  );
  return normalizeUrl(card?.querySelector(".store-product-media img")?.currentSrc || card?.querySelector(".store-product-media img")?.src || "");
}

function filterDetailGallery(detail) {
  const gallery = detail.querySelector(".product-gallery");
  const main = gallery?.querySelector("[data-gallery-main]");
  if (!gallery || !main) return;

  const coverUrl = findCoverUrl(detail);
  if (!coverUrl) return;

  const thumbs = [...gallery.querySelectorAll("[data-gallery-thumb]")];
  const isCoverThumb = (thumb) => normalizeUrl(thumb.dataset.galleryUrl || thumb.querySelector("img")?.src || "") === coverUrl;
  const remaining = thumbs.filter((thumb) => !isCoverThumb(thumb));

  thumbs.filter(isCoverThumb).forEach((thumb) => {
    thumb.hidden = true;
    thumb.classList.remove("on");
  });

  if (normalizeUrl(main.currentSrc || main.src) === coverUrl) {
    if (remaining.length) {
      const next = remaining[0];
      main.src = next.dataset.galleryUrl || next.querySelector("img")?.src || "";
      remaining.forEach((thumb, index) => thumb.classList.toggle("on", index === 0));
    } else {
      gallery.hidden = true;
      detail.classList.add("detail-gallery-empty");
      return;
    }
  }

  gallery.hidden = false;
  detail.classList.remove("detail-gallery-empty");
  const thumbHost = gallery.querySelector(".product-gallery-thumbs");
  if (thumbHost) thumbHost.hidden = remaining.length <= 1;
}

function forceDetailLayout(detail) {
  const gallery = detail.querySelector(".product-gallery");
  const copy = detail.querySelector(".product-detail-copy");
  const main = gallery?.querySelector(".product-gallery-main");
  const image = main?.querySelector("img");

  if (!gallery || gallery.hidden || detail.classList.contains("detail-gallery-empty")) {
    detail.style.setProperty("display", "block", "important");
    detail.style.removeProperty("grid-template-columns");
    detail.style.removeProperty("flex-direction");
    detail.style.removeProperty("gap");
    copy?.style.setProperty("width", "100%", "important");
    return;
  }

  const sideBySide = window.innerWidth >= 480;

  // Use flex instead of grid so older responsive grid rules cannot force the
  // gallery back above the product information.
  detail.style.setProperty("display", "flex", "important");
  detail.style.setProperty("flex-direction", sideBySide ? "row" : "column", "important");
  detail.style.setProperty("align-items", "flex-start", "important");
  detail.style.setProperty("gap", sideBySide ? "22px" : "18px", "important");
  detail.style.setProperty("width", "100%", "important");
  detail.dataset.detailLayout = sideBySide ? "split" : "stack";

  if (sideBySide) {
    gallery.style.setProperty("flex", "0 0 42%", "important");
    gallery.style.setProperty("width", "42%", "important");
    gallery.style.setProperty("max-width", "320px", "important");
    gallery.style.setProperty("min-width", "190px", "important");
    copy?.style.setProperty("flex", "1 1 0", "important");
    copy?.style.setProperty("width", "auto", "important");
    copy?.style.setProperty("min-width", "0", "important");
  } else {
    gallery.style.setProperty("flex", "0 0 auto", "important");
    gallery.style.setProperty("width", "100%", "important");
    gallery.style.setProperty("max-width", "none", "important");
    gallery.style.setProperty("min-width", "0", "important");
    copy?.style.setProperty("width", "100%", "important");
  }

  if (main) {
    main.style.setProperty("width", "100%", "important");
    main.style.setProperty("height", sideBySide ? "430px" : "min(92vw, 420px)", "important");
    main.style.setProperty("aspect-ratio", "auto", "important");
    main.style.setProperty("overflow", "hidden", "important");
    main.style.setProperty("display", "grid", "important");
    main.style.setProperty("place-items", "center", "important");
  }

  if (image) {
    image.style.setProperty("width", "100%", "important");
    image.style.setProperty("height", "100%", "important");
    image.style.setProperty("object-fit", "contain", "important");
    image.style.setProperty("object-position", "center", "important");
  }
}

let scheduled = false;
function applyDetailGalleryFilter() {
  scheduled = false;
  document.querySelectorAll(".regional-product-detail").forEach((detail) => {
    filterDetailGallery(detail);
    forceDetailLayout(detail);
  });
}

function scheduleDetailGalleryFilter() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(applyDetailGalleryFilter);
  });
}

new MutationObserver(scheduleDetailGalleryFilter).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

const modalWrap = document.querySelector("#product-modal-wrap");
if (modalWrap) {
  new MutationObserver(scheduleDetailGalleryFilter).observe(modalWrap, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

window.addEventListener("resize", scheduleDetailGalleryFilter, { passive: true });
scheduleDetailGalleryFilter();
