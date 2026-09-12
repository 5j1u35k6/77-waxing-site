import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfigured } from "./firebase-config.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

export const CATALOG_DOC_ID = "catalog-main";

const clone = (value) => JSON.parse(JSON.stringify(value));
const safeId = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const makeCatalogId = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const makeSlug = (value) => safeId(value) || `service-${Date.now().toString(36)}`;

const serviceItem = (id, name, description, durationMinutes, durationLabel, priceLabel, enabled = true) => ({
  id,
  name,
  description,
  durationMinutes,
  durationLabel,
  priceLabel,
  enabled,
});

export const DEFAULT_CATALOG = [
  {
    key: "women",
    slug: "women-waxing",
    name: "女性熱蠟",
    en: "WOMEN HOT WAXING",
    intro: "今次嘅妳想改變啲咩呢？77waxing幫妳實現願望。",
    enabled: true,
    groups: [
      {
        id: "women-main",
        title: "熱蠟除毛項目",
        priceTitle: "熱蠟除毛",
        kind: "main",
        desc: "",
        items: [
          serviceItem("women-leg", "全腿 / 半腿", "Full leg / Half leg", 90, "約 90 分鐘", "$1599 / 899"),
          serviceItem("women-arm", "全手 / 半手", "Full arm / Half arm", 90, "約 90 分鐘", "$1399 / 799"),
          serviceItem("women-back", "全背 / 半背", "Full back / Half back", 90, "約 90 分鐘", "$1299 / 699"),
          serviceItem("women-private", "私密處全除", "Hollywood", 90, "約 90 分鐘", "$1399"),
          serviceItem("women-detail", "小鬍子 / 小腹線", "Upper lip / Lower abdomen", 90, "約 90 分鐘", "$399"),
          serviceItem("women-underarm", "腋下", "Under arm", 90, "約 90 分鐘", "$399"),
        ],
      },
      {
        id: "women-addon",
        title: "加購保養",
        priceTitle: "加購項目 ADD ON",
        kind: "addon",
        desc: "",
        items: [
          serviceItem("women-addon-detail", "小鬍子 / 小腹線 / 腋下", "加購除毛項目", 90, "約 90 分鐘", "$199"),
          serviceItem("women-addon-underarm-mask", "腋下美白軟膜", "Underarm whitening mask", 90, "約 90 分鐘", "$199"),
          serviceItem("women-addon-private-mask", "私密處美白軟膜", "Private area whitening mask", 90, "約 90 分鐘", "$199"),
        ],
      },
    ],
  },
  {
    key: "men",
    slug: "men-waxing",
    name: "男士熱蠟",
    en: "MEN HOT WAXING",
    intro: "唔使怕醜！專業嘅77waxing一樣可以令你變得更型、更有自信！",
    enabled: true,
    groups: [
      {
        id: "men-main",
        title: "熱蠟除毛項目",
        priceTitle: "熱蠟除毛",
        kind: "main",
        desc: "",
        items: [
          serviceItem("men-leg", "全腿 / 半腿", "Full leg / Half leg", 90, "約 90 分鐘", "$1899 / 1099"),
          serviceItem("men-arm", "全手 / 半手", "Full arm / Half arm", 90, "約 90 分鐘", "$1599 / 899"),
          serviceItem("men-back", "全背 / 半背", "Full back / Half back", 90, "約 90 分鐘", "$1599 / 899"),
          serviceItem("men-private", "私密處全除", "Hollywood", 90, "約 90 分鐘", "$2299"),
          serviceItem("men-detail", "小腹線 / 鬍子", "Lower abdomen / Beard，鬍子依視範圍確認", 90, "約 90 分鐘", "$499 / 視範圍"),
          serviceItem("men-underarm", "腋下", "Under arm", 90, "約 90 分鐘", "$499"),
        ],
      },
      {
        id: "men-addon",
        title: "加購保養",
        priceTitle: "加購項目 ADD ON",
        kind: "addon",
        desc: "",
        items: [
          serviceItem("men-addon-detail", "小鬍子 / 小腹線 / 腋下", "加購除毛項目", 90, "約 90 分鐘", "$350"),
          serviceItem("men-addon-underarm-mask", "腋下美白軟膜", "Underarm whitening mask", 90, "約 90 分鐘", "$299"),
          serviceItem("men-addon-private-mask", "私密處美白軟膜", "Private area whitening mask", 90, "約 90 分鐘", "$299"),
        ],
      },
    ],
  },
  {
    key: "skin",
    slug: "skin-care",
    name: "肌膚管理",
    en: "SKIN CARE",
    intro: "交俾77waxing，等每一次保養都更靠近妳鍾意嘅自己一啲。",
    enabled: true,
    groups: [
      {
        id: "skin-face",
        title: "臉部項目",
        kind: "main",
        desc: "",
        items: [
          serviceItem("skin-clean", "修修臉粉刺毛孔大掃除", "臉部清潔與粉刺毛孔管理", 90, "約 90 分鐘", "$1399"),
          serviceItem("skin-ampoule", "針管式客制化安瓶", "依膚況安排客製化安瓶", 90, "約 90 分鐘", "$1599"),
          serviceItem("skin-cica", "CICA 深層修復", "臉部修復管理", 90, "約 90 分鐘", "$1899"),
          serviceItem("skin-water", "裸肌水光駐顏", "水光駐顏管理", 90, "約 90 分鐘", "$1899"),
          serviceItem("skin-exosome", "肌活再生外泌課程", "肌活再生課程", 90, "約 90 分鐘", "$1999"),
          serviceItem("skin-concentrate", "濃縮原液客制化", "依膚況安排濃縮原液", 90, "約 90 分鐘", "$1999"),
          serviceItem("skin-crystal", "黑溜溜矽晶煥膚", "矽晶煥膚管理", 90, "約 90 分鐘", "$2199"),
        ],
      },
      {
        id: "skin-massage",
        title: "臉部撥筋系列",
        priceTitle: "臉部撥筋",
        kind: "main",
        desc: "",
        items: [
          serviceItem("skin-massage-basic", "全方位臉部撥筋", "臉部清潔、舒活嫩膚、臉部與肩頸放鬆、臉部肩頸撥筋、保濕、頭皮放鬆與肌膚喚醒", 70, "60–70 分鐘", "$1399"),
          serviceItem("skin-massage-clean", "臉部撥筋 + 基礎手工清粉刺", "臉部清潔、舒活嫩膚、放鬆與撥筋、肌膚處理、保濕、光譜儀、頭皮放鬆、頭刮與肌膚喚醒", 150, "120–150 分鐘", "$2499"),
        ],
      },
      {
        id: "skin-body",
        title: "身體項目",
        kind: "main",
        desc: "",
        items: [
          serviceItem("skin-back", "果酸 / 矽晶美背護理", "背部肌膚管理", 90, "約 90 分鐘", "$1699 / 2999"),
          serviceItem("skin-neck", "水潤 / 肌泌緊緻肩頸胸", "肩頸胸肌膚保養", 90, "約 90 分鐘", "$699 / 1099"),
          serviceItem("skin-butt", "果酸 / 矽晶粉嫩屁屁", "臀部肌膚管理", 90, "約 90 分鐘", "$1499 / 2199"),
        ],
      },
      {
        id: "skin-addon",
        title: "加購項目",
        kind: "addon",
        desc: "",
        items: [
          serviceItem("skin-addon-neck", "頸部緊緻保養", "頸部加強保養", 90, "約 90 分鐘", "$699"),
          serviceItem("skin-addon-polish", "臉部拋光", "臉部除毛項目", 90, "約 90 分鐘", "$499"),
          serviceItem("skin-addon-head", "頭刮肩頸加強", "肩頸加強", 15, "15 分鐘", "$399"),
          serviceItem("skin-addon-ear", "耳穴放鬆", "耳穴放鬆", 40, "30–40 分鐘", "$599"),
          serviceItem("skin-addon-wax", "臉部熱蠟", "依實際範圍確認", 90, "約 90 分鐘", "視範圍"),
        ],
      },
    ],
    notes: ["臉部療程皆包含 5–10 分鐘肩部放鬆、手工清粉刺。", "客製化安瓶以上課程皆含水飛梭；中階課程含 MTS；高階課程含 MTS、RF 緊緻。", "操作時間依參考，實際以肌膚狀況為主。"],
  },
  {
    key: "bust",
    slug: "bust-care",
    name: "美胸保養",
    en: "BUST CARE",
    intro: "照顧曲線，都照顧自己嘅感受。等77waxing陪妳慢慢搵返自信。",
    enabled: true,
    groups: [
      {
        id: "bust-main",
        title: "美胸保養項目",
        priceTitle: "美胸項目",
        kind: "main",
        desc: "",
        items: [
          serviceItem("bust-basic", "基礎美胸", "胸部、頭肩頸、手部", 60, "60 分鐘", "$1299"),
          serviceItem("bust-relax", "舒緩美胸", "胸部、頭肩頸、手部、頭刮", 75, "75 分鐘", "$1499"),
          serviceItem("bust-full", "全方位美胸", "胸部、頭肩頸、手部、暖宮、頭刮", 90, "90 分鐘", "$1699"),
        ],
      },
      { id: "bust-addon", title: "加購項目", kind: "addon", desc: "", items: [] },
    ],
  },
];

function normalizeItem(item, index) {
  const durationMinutes = Math.max(1, Math.min(180, Number(item?.durationMinutes || 90)));
  return {
    id: String(item?.id || makeCatalogId(`item${index}`)),
    name: String(item?.name || `未命名項目 ${index + 1}`).trim(),
    description: String(item?.description || "").trim(),
    durationMinutes,
    durationLabel: String(item?.durationLabel || `約 ${durationMinutes} 分鐘`).trim(),
    priceLabel: String(item?.priceLabel || "").trim(),
    enabled: item?.enabled !== false,
  };
}

function normalizeGroup(group, index) {
  const title = String(group?.title || `服務項目 ${index + 1}`).trim();
  return {
    id: String(group?.id || makeCatalogId(`group${index}`)),
    title,
    priceTitle: String(group?.priceTitle || title).trim(),
    kind: group?.kind === "addon" || /加購/.test(title) ? "addon" : "main",
    desc: String(group?.desc || "").trim(),
    items: Array.isArray(group?.items) ? group.items.map(normalizeItem) : [],
  };
}

export function normalizeCatalog(input) {
  const source = Array.isArray(input) ? input : DEFAULT_CATALOG;
  return source.map((category, index) => {
    const slug = String(category?.slug || makeSlug(category?.name || `service-${index + 1}`)).trim();
    return {
      key: String(category?.key || slug || `service-${index + 1}`).trim(),
      slug,
      name: String(category?.name || `服務分類 ${index + 1}`).trim(),
      en: String(category?.en || "SERVICE").trim(),
      intro: String(category?.intro || "").trim(),
      enabled: category?.enabled !== false,
      groups: Array.isArray(category?.groups) ? category.groups.map(normalizeGroup) : [],
      notes: Array.isArray(category?.notes) ? category.notes.map((note) => String(note || "").trim()).filter(Boolean) : [],
    };
  });
}

let app = null;
let auth = null;
let db = null;
const isAdminContext = () => /\/admin(?:\/|$)/.test(location.pathname);
function ensureFirebase() {
  if (!firebaseConfigured) throw new Error("FIREBASE_NOT_READY");
  if (isAdminContext()) {
    const defaultApp = getApps().find((candidate) => candidate.name === "[DEFAULT]");
    if (!defaultApp) throw new Error("ADMIN_FIREBASE_NOT_READY");
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    ({ app, auth, db } = getPublicFirebase());
  }
  return { app, auth, db };
}

async function ensureSignedIn() {
  ensureFirebase();
  if (typeof auth.authStateReady === "function") await auth.authStateReady();
  if (auth.currentUser) {
    if (isAdminContext() && auth.currentUser.isAnonymous) throw new Error("ADMIN_AUTH_REQUIRED");
    return auth.currentUser;
  }
  if (isAdminContext()) throw new Error("ADMIN_AUTH_REQUIRED");
  if (!window.__77_PUBLIC_ANON_AUTH_PROMISE__) {
    window.__77_PUBLIC_ANON_AUTH_PROMISE__ = signInAnonymously(auth)
      .then((credential) => credential.user)
      .finally(() => { window.__77_PUBLIC_ANON_AUTH_PROMISE__ = null; });
  }
  return window.__77_PUBLIC_ANON_AUTH_PROMISE__;
}


export async function loadCatalog() {
  await ensureSignedIn();
  const ref = doc(db, "services", CATALOG_DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data()?.categories)) return normalizeCatalog(snap.data().categories);
  return normalizeCatalog(clone(DEFAULT_CATALOG));
}

export async function saveCatalog(categories) {
  await ensureSignedIn();
  const normalized = normalizeCatalog(categories);
  await setDoc(doc(db, "services", CATALOG_DOC_ID), {
    schemaVersion: 1,
    categories: normalized,
    updatedAt: serverTimestamp(),
  }, { merge: false });
  return normalized;
}

export async function watchCatalog(callback) {
  await ensureSignedIn();
  const ref = doc(db, "services", CATALOG_DOC_ID);
  let fallbackLoaded = false;
  return onSnapshot(ref, async (snap) => {
    if (snap.exists() && Array.isArray(snap.data()?.categories)) {
      callback(normalizeCatalog(snap.data().categories));
      return;
    }
    if (fallbackLoaded) return;
    fallbackLoaded = true;
    callback(normalizeCatalog(clone(DEFAULT_CATALOG)));
  });
}

export function publicCatalog(categories) {
  return normalizeCatalog(categories)
    .filter((category) => category.enabled !== false)
    .map((category) => ({
      ...category,
      groups: category.groups.map((group) => ({
        ...group,
        items: group.items.filter((entry) => entry.enabled !== false),
      })),
    }));
}
