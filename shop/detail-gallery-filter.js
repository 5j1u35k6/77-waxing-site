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

  thumbs.filter(isCoverThumb).forEach((thumb) => { thumb.hidden = true; thumb.classList.remove("on"); });

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

let scheduled = false;
function applyDetailGalleryFilter() {
  scheduled = false;
  document.querySelectorAll(".regional-product-detail").forEach(filterDetailGallery);
}
function scheduleDetailGalleryFilter() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(applyDetailGalleryFilter);
}

new MutationObserver(scheduleDetailGalleryFilter).observe(document.documentElement, { childList: true, subtree: true });
scheduleDetailGalleryFilter();
