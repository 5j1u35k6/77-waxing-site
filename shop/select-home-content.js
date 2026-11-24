import { productHref, storeRoute } from "./select-routes.js?v=20261124-speed2";
import { collectionKey, seriesSlogan } from "./series.js?v=20261124-series1";

const copySections = {
  about: ".select-about-content",
  reviews: ".select-reviews-content",
  faq: ".select-faq-content",
};
const heroImage = document.querySelector(".select-hero-media img");
const defaultHeroImage = heroImage?.getAttribute("src");
const defaultSeriesCovers = [...document.querySelectorAll(".select-collection[data-shop-collection]")]
  .map((link) => ({ link, cover: link.firstElementChild.cloneNode(true) }));
const collectionSlogan = document.querySelector("[data-catalog-slogan]");
let seriesSlogans;
const featuredSlots = [...document.querySelectorAll(".select-featured-slot")];
let featuredIds = [];
let publicProducts = new Map();

function renderSeriesSlogans(overrides) {
  for (const { link } of defaultSeriesCovers) {
    const slogan = link.querySelector("[data-series-slogan]");
    if (slogan) slogan.textContent = seriesSlogan(link.dataset.shopCollection, overrides);
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
    link.append(image, details);
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
  for (const { link, cover } of defaultSeriesCovers) {
    const url = httpsImage(content.seriesImages?.[link.dataset.shopCollection]);
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
