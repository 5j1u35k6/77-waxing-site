const series = [
  ["黑瓶♾️修護系列", ["極致呵護無香系列"]],
  ["25+系列", ["新生·激光系列"]],
  ["身體拋光系列", ["纖皙·金緻油系列", "超激白系列"]],
  ["5分鐘出門系列", []],
];

const labels = new Map(series.flatMap(([label, aliases]) =>
  [label, ...aliases].map((name) => [name, label])
));

export const allProducts = "全部商品";

export function catalogCategory(rawCategory) {
  const category = String(rawCategory ?? "").trim() || "其他";
  return labels.get(category) ?? category;
}

export function catalogCategories(products) {
  return [...new Set([
    allProducts,
    ...series.map(([label]) => label),
    ...products.map(({ category }) => catalogCategory(category)),
  ])];
}

export function filterProducts(products, category) {
  return category === allProducts
    ? products
    : products.filter((product) => catalogCategory(product.category) === category);
}
