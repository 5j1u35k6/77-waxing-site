const legacyNames = {
  women: ['女性熱蠟', '女仕熱蠟', '女士熱蠟'],
  men: ['男士熱蠟', '男仕熱蠟'],
  skin: ['肌膚管理', '臉部保養'],
  bust: ['美胸保養', '胸部保養'],
};

const label = value => String(value || '').trim().replace(/\u64a5筋/g, '鬆筋');
const matchLabel = value => label(value).replace(/\s+/g, '').replace(/女仕|女士/g, '女性').replace(/男仕/g, '男士');

export function taipeiMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

export function completedServiceDistribution(bookings = [], catalog = [], month = taipeiMonth()) {
  const groups = new Map();
  const names = new Map();
  const keys = new Map();
  for (const category of Array.isArray(catalog) ? catalog : []) {
    const name = label(category?.name);
    if (!name) continue;
    const key = String(category.key || category.id || category.slug || name);
    const identity = `catalog:${key}`;
    if (groups.has(identity)) continue;
    groups.set(identity, { key, name, count: 0 });
    for (const value of [category.key, category.id, category.slug].filter(Boolean)) keys.set(String(value), identity);
    names.set(matchLabel(name), identity);
  }
  // Match old spelling / renamed built-in categories to their stable catalog keys.
  // Exact current catalog names take precedence over these compatibility aliases.
  for (const [key, aliases] of Object.entries(legacyNames)) {
    const identity = keys.get(key);
    if (identity) for (const name of aliases) if (!names.has(matchLabel(name))) names.set(matchLabel(name), identity);
  }
  let total = 0;
  for (const booking of Array.isArray(bookings) ? bookings : []) {
    if (booking?.status !== 'completed') continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(booking.preferredDate || '')) || booking.preferredDate.slice(0, 7) !== month) continue;
    const name = label(String(booking.serviceName || '').split(/[｜|]/)[0]) || '未分類服務';
    const categoryKey = booking.serviceCategoryKey || booking.categoryKey || booking.serviceKey;
    const identity = keys.get(String(categoryKey || '')) || names.get(matchLabel(name)) || `history:${matchLabel(name)}`;
    if (!groups.has(identity)) groups.set(identity, { key: identity, name, count: 0 });
    groups.get(identity).count += 1;
    total += 1;
  }
  return { services: [...groups.values()], total };
}
