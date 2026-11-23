const series = [
  ["black-bottle", "黑瓶無限修護系列", ["黑瓶♾️修護系列", "黑瓶♾修護系列", "黑瓶∞修護系列", "極致呵護無香系列"]],
  ["25-plus", "25+系列", ["新生·激光系列"]],
  ["body-polish", "身體拋光系列", ["纖皙·金緻油系列", "超激白系列"]],
  ["five-minutes", "5分鐘出門系列", []],
];

const labels = new Map(series.flatMap(([, label, aliases]) =>
  [label, ...aliases].map((name) => [name, label])
));

export const allProducts = "全部商品";

const namesByKey = new Map([["all", allProducts], ...series.map(([key, label]) => [key, label])]);
const keysByName = new Map([...namesByKey].map(([key, label]) => [label, key]));

export function catalogCategory(rawCategory) {
  const category = String(rawCategory ?? "").trim() || "其他";
  return labels.get(category) ?? category;
}

export function catalogCategories(products) {
  return [...new Set([
    allProducts,
    ...series.map(([, label]) => label),
    ...products.map(({ category }) => catalogCategory(category)),
  ])];
}

export function collectionKey(category) {
  const label = catalogCategory(category);
  return keysByName.get(label) ?? `category:${label}`;
}

export function categoryFromCollectionKey(key) {
  if (!key) return allProducts;
  return namesByKey.get(key) ?? catalogCategory(key.startsWith("category:") ? key.slice(9) : key);
}

export function filterProducts(products, category) {
  return category === allProducts
    ? products
    : products.filter((product) => catalogCategory(product.category) === category);
}
