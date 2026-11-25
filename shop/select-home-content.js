import "./select-photo-fit.js?v=20261124-series2";
import { firebaseConfig } from "../assets/firebase-config.js?v=20261026-audit1";
import { productHref, storeRoute } from "./select-routes.js?v=20261124-speed2";
import { collectionKey, seriesSlogan } from "./series.js?v=20261124-series1";

const copySections = {
  about: ".select-about-content",
  faq: ".select-faq-content",
};
const reviewContent = document.querySelector(".select-reviews-content");
let reviewManifest;
let reviewObserver;
const heroImage = document.querySelector(".select-hero-media img");
const defaultHeroImage = heroImage?.getAttribute("src");
const seriesCards = [...document.querySelectorAll(".select-collection")].map((card) => {
  const link = card.querySelector(".select-collection-link") || card;
  return { card, link, cover: link.firstElementChild.cloneNode(true) };
});
const collectionSlogan = document.querySelector("[data-catalog-slogan]");
let seriesSlogans = Object.fromEntries(seriesCards.map(({ card, link }) => [
  link.dataset.shopCollection, card.querySelector("[data-series-slogan]")?.textContent.trim(),
]));
const featuredSlots = [...document.querySelectorAll(".select-featured-slot")];
let featuredIds = [];
let publicProducts = new Map();

function renderSeriesSlogans(overrides) {
  for (const { card, link } of seriesCards) {
    const slogan = card.querySelector("[data-series-slogan]");
    const text = seriesSlogan(link.dataset.shopCollection, overrides);
    if (slogan && slogan.textContent.trim() !== text) slogan.textContent = text;
  }
  renderSelectCatalogSlogan();
}

export function renderSelectCatalogSlogan() {
  if (collectionSlogan) {
    const key = storeRoute.view === "products" ? collectionKey(storeRoute.category) : null;
    const text = seriesSlogan(key, seriesSlogans);
    collectionSlogan.textContent = text;
    collectionSlogan.hidden = !text;
  }
}

function httpsImage(value) {
  const url = typeof value === "string" ? value.trim() : "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

function featuredImage(value) {
  const imageUrl = typeof value === "string" ? value.trim() : "";
  return /^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(imageUrl)
    ? imageUrl
    : httpsImage(imageUrl);
}

async function readReviewImage(id) {
  const project = encodeURIComponent(firebaseConfig.projectId);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/shopSettings/home-review-${id}?mask.fieldPaths=dataUrl`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { credentials: "omit", signal: controller.signal });
    if (!response.ok) return "";
    const { fields } = await response.json();
    const image = fields?.dataUrl?.stringValue;
    return typeof image === "string" && image.length <= 220_000 &&
      /^data:image\/(?:webp|jpeg);base64,[a-z0-9+/=]+$/i.test(image) ? image : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function reviewDimension(value) {
  return Number.isInteger(value) && value > 0 && value <= 1440 ? value : 0;
}

function renderReviewImages(rows) {
  if (!reviewContent) return;
  const images = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (images.length >= 6) break;
    if (typeof row?.id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    images.push({
      id: row.id,
      width: reviewDimension(row.width),
      height: reviewDimension(row.height),
      alt: typeof row.alt === "string" ? row.alt.trim().slice(0, 300) : "",
    });
  }
  const manifest = JSON.stringify(images);
  if (reviewManifest === manifest) return;
  reviewManifest = manifest;
  reviewObserver?.disconnect();
  reviewContent.replaceChildren();
  if (!images.length) return;

  const gallery = document.createElement("ul");
  gallery.className = "select-review-gallery";
  gallery.setAttribute("role", "list");
  const requests = new Map();
  images.forEach(({ id, width, height, alt }, index) => {
    const item = document.createElement("li");
    const image = document.createElement("img");
    image.alt = alt || `顧客心得照片 ${index + 1}`;
    image.decoding = "async";
    image.hidden = true;
    if (width && height) {
      image.width = width;
      image.height = height;
      item.style.setProperty("--select-review-ratio", `${width} / ${height}`);
    }
    const removeFailedImage = () => {
      item.remove();
      if (!gallery.childElementCount) gallery.remove();
    };
    image.addEventListener("load", () => { image.hidden = false; }, { once: true });
    image.addEventListener("error", removeFailedImage, { once: true });
    requests.set(item, async () => {
      const source = await readReviewImage(id);
      if (!item.isConnected) return;
      if (source) image.src = source;
      else removeFailedImage();
    });
    item.append(image);
    gallery.append(item);
  });
  reviewContent.append(gallery);

  if (!("IntersectionObserver" in window)) {
    requests.forEach((load) => { void load(); });
    return;
  }
  reviewObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const item = entry.target;
      observer.unobserve(item);
      const load = requests.get(item);
      requests.delete(item);
      if (load) void load();
    }
  }, { rootMargin: "350px 0px" });
  requests.forEach((_, item) => reviewObserver.observe(item));
}

function renderFeatured() {
  featuredSlots.forEach((slot, index) => {
    const product = publicProducts.get(featuredIds[index]);
    if (!product?.name) {
      slot.setAttribute("aria-hidden", "true");
      slot.replaceChildren();
      return;
    }

    const link = document.createElement("a");
    link.className = "select-featured-product";
    link.href = productHref(product.id);

    const imageUrl = featuredImage(product.imageUrl);
    const image = document.createElement(imageUrl ? "img" : "span");
    image.className = "select-featured-image";
    if (imageUrl) {
      image.dataset.squarePhoto = "";
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
    } else {
      image.setAttribute("aria-hidden", "true");
    }

    const details = document.createElement("span");
    details.className = "select-featured-details";
    const name = document.createElement("strong");
    name.textContent = product.name;
    details.append(name);
    if (product.priceText) {
      const price = document.createElement("span");
      price.className = "select-featured-price";
      price.textContent = product.priceText;
      details.append(price);
    }
    const frame = document.createElement("span");
    frame.className = "select-square-frame";
    frame.append(image);
    link.append(frame, details);
    slot.removeAttribute("aria-hidden");
    slot.replaceChildren(link);
  });
}

export function renderSelectHomeSettings(settings = {}) {
  const content = settings && typeof settings === "object" ? settings : {};
  seriesSlogans = content.seriesSlogans;
  renderSeriesSlogans(seriesSlogans);
  if (heroImage) {
    const url = httpsImage(content.heroImageUrl);
    heroImage.src = url || defaultHeroImage;
    heroImage.alt = url ? "77 Select 保養商品" : "無香修護乳液、前導精華水與全能奇蹟油的棚拍合照";
  }
  for (const [key, selector] of Object.entries(copySections)) {
    const section = document.querySelector(selector);
    if (!section) continue;
    const text = typeof content[key] === "string" ? content[key].trim() : "";
    section.replaceChildren();
    if (!text) continue;
    const copy = document.createElement("p");
    copy.className = "select-home-copy";
    copy.textContent = text;
    section.append(copy);
  }
  renderReviewImages(content.reviewImages);
  for (const { link, cover } of seriesCards) {
    const url = httpsImage(content.seriesImages?.[link.dataset.shopCollection]);
    if (url === (link.firstElementChild.getAttribute("src") === cover.getAttribute("src") ? "" : link.firstElementChild.src)) continue;
    const next = url ? document.createElement("img") : cover.cloneNode(true);
    if (url) {
      next.src = url;
      next.alt = "";
      next.loading = "lazy";
      next.width = 599;
      next.height = 900;
    }
    link.firstElementChild.replaceWith(next);
  }
  featuredIds = Array.isArray(content.featuredProductIds) ? content.featuredProductIds.slice(0, 3) : [];
  renderFeatured();
}

export function renderSelectHomeProducts(products) {
  publicProducts = new Map(products.filter((product) => product.active !== false).map((product) => [product.id, product]));
  renderFeatured();
}
