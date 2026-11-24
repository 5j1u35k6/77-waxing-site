export const int = (value) => Math.max(0, Math.round(Number(value) || 0));

export function normalizeVariants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => ({
      id: String(variant.id || `variant-${index + 1}`),
      name: String(variant.name || variant.label || `規格 ${index + 1}`),
      capacity: String(variant.capacity || variant.size || ""),
      priceTWD: int(variant.priceTWD ?? variant.priceTW ?? variant.price ?? product.price ?? 0),
      priceHKD: int(variant.priceHKD ?? variant.priceHK ?? product.priceHKD ?? 0),
      stock: int(variant.stock ?? product.stock ?? 0),
      bulkMinQty: int(variant.bulkMinQty ?? variant.quantityDiscountMin ?? 0),
      bulkPriceTWD: int(variant.bulkPriceTWD ?? variant.quantityDiscountTWD ?? 0),
      bulkPriceHKD: int(variant.bulkPriceHKD ?? variant.quantityDiscountHKD ?? 0),
    }));
  }
  return [{
    id: "default",
    name: "一般規格",
    capacity: "",
    priceTWD: int(product.price || 0),
    priceHKD: int(product.priceHKD || product.price || 0),
    stock: int(product.stock || 0),
    bulkMinQty: 0,
    bulkPriceTWD: 0,
    bulkPriceHKD: 0,
  }];
}

function normalizeMedia(product = {}) {
  const source = Array.isArray(product.media) ? product.media : [];
  const rows = source.map((row, index) => ({
    id: String(row?.id || `image-${index + 1}`),
    url: String(row?.url || row?.dataUrl || row?.imageUrl || ""),
    variantId: String(row?.variantId || ""),
    sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
  })).filter((row) => row.url).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!rows.length && product.imageUrl) rows.push({ id: "legacy-main", url: String(product.imageUrl), variantId: "", sortOrder: 0 });
  return rows;
}

export function mediaForVariant(product, variantId = "") {
  const all = normalizeMedia(product);
  if (!all.length) return [];
  const shared = all.filter((row) => !row.variantId);
  if (!variantId) return shared.length ? shared : all;
  const specific = all.filter((row) => row.variantId === variantId);
  const result = [...shared, ...specific];
  return result.length ? result : all;
}

export function primaryImage(product, variantId = "") {
  return mediaForVariant(product, variantId)[0]?.url || "";
}

export function money(value, currency) {
  const amount = Number(value || 0);
  if (currency === "HKD") return `HK$${amount.toLocaleString("zh-HK")}`;
  return `NT$${amount.toLocaleString("zh-TW")}`;
}

export function compareProducts(a, b) {
  return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
}

export function catalogPriceText(product, market) {
  const variants = normalizeVariants(product);
  const available = variants.filter((variant) => variant.stock > 0);
  const prices = (available.length ? available : variants)
    .map((variant) => market.code === "HK" ? variant.priceHKD : variant.priceTWD);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? money(minimum, market.currency) :
    `${money(minimum, market.currency)}–${money(maximum, market.currency)}`;
}
