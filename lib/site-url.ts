function normalizeSiteUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function getSiteUrl() {
  return normalizeSiteUrl(process.env.SITE_URL);
}

export function getSiteUrlObject() {
  const siteUrl = getSiteUrl();
  return siteUrl ? new URL(siteUrl) : undefined;
}
