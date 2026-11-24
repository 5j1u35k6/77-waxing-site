const MARKET_CACHE_KEY = "77select_market_v1";

export const MARKETS = {
  TW: { code: "TW", currency: "TWD", symbol: "NT$", locale: "zh-TW", label: "台灣" },
  HK: { code: "HK", currency: "HKD", symbol: "HK$", locale: "zh-HK", label: "香港" },
};

async function detectMarket() {
  let cached = null;
  try { cached = sessionStorage.getItem(MARKET_CACHE_KEY); } catch {}
  if (cached === "HK" || cached === "TW") return MARKETS[cached];

  let detected = null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const languages = [navigator.language, ...(navigator.languages || [])].filter(Boolean).join("|");
  if (timezone === "Asia/Hong_Kong" || /(?:^|-)HK(?:$|\|)/i.test(languages)) detected = "HK";
  if (timezone === "Asia/Taipei" || /(?:^|-)TW(?:$|\|)/i.test(languages)) detected ||= "TW";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch("https://api.country.is/", { cache: "no-store", signal: controller.signal });
    if (response.ok) {
      const data = await response.json();
      const country = String(data?.country || "").toUpperCase();
      if (country === "HK" || country === "TW") detected = country;
    }
  } catch (error) {
    console.info("77select market IP lookup unavailable; using device locale fallback.", error?.name || error);
  } finally {
    clearTimeout(timer);
  }

  const result = detected === "HK" ? MARKETS.HK : MARKETS.TW;
  try { sessionStorage.setItem(MARKET_CACHE_KEY, result.code); } catch {}
  return result;
}

export const initialMarket = detectMarket();
