import { productHref } from "./select-routes.js?v=20261123-select2";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function selectProductCard(product, price, { regional = false, soldOut = false } = {}) {
  const name = escapeHtml(product.name || "商品");
  const href = escapeHtml(productHref(product.id));
  const image = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy" decoding="async">`
    : '<span aria-hidden="true">77 Select</span>';
  return `<article class="product-card select-catalog-card">
    <a class="select-catalog-card-link" href="${href}"${regional ? ` data-regional-detail="${escapeHtml(product.id)}"` : ""}>
      <div class="select-catalog-photo">${image}</div>
      <div class="select-catalog-copy"><h3>${name}</h3><p>${escapeHtml(price)}${soldOut ? ' <span class="select-catalog-sold">售完</span>' : ""}</p></div>
    </a>
  </article>`;
}
