import {
  browserLocalPersistence,
  getRedirectResult,
  getIdTokenResult,
  OAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithRedirect,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20261026-audit1";

const { auth, db } = getPublicFirebase();
const VERSION = "20260915-member2";
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const PROFILE_COLLECTION = "memberProfiles";
const IDENTITY_STATUS_URL = "https://77waxing-line-auth-proxy.max19450.workers.dev/";
const runtimeConfig = window.__77_MEMBER_AUTH_CONFIG__ || {};
const providerConfig = {
  line: {
    label: "LINE",
    providerId: runtimeConfig.lineProviderId || "oidc.line",
    scopes: ["openid", "profile", "email"],
  },
  whatsapp: {
    label: "WhatsApp",
    // WhatsApp does not expose a consumer-login OIDC provider by default.
    // This id is reserved for the Firebase OIDC/custom identity broker used by 77waxing.
    providerId: runtimeConfig.whatsappProviderId || "oidc.whatsapp",
    scopes: ["openid", "profile", "email"],
  },
};

let authReady = false;
let currentUser = null;
let currentProfile = null;
let loginRequired = false;
let loginReason = "";
let profilePromise = null;
let memberCenterRequest = 0;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

function repoBase() {
  return location.hostname.endsWith("github.io") ? "/77-waxing-site" : "";
}

function pagePath() {
  const base = repoBase();
  return base && location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname;
}

function isBookingPage() {
  const path = pagePath().replace(/\/$/, "");
  return path === "/booking";
}

function isShopPage() {
  // A <base href> changes asset URLs, not location.pathname on /77select/.
  return Boolean(document.querySelector(".shop-nav"))
    || /\/shop(?:\/index\.html)?\/?$/.test(pagePath())
    || /^\/77select(?:\/index\.html)?\/?$/.test(location.pathname);
}

function isMember(user = currentUser) {
  return Boolean(user && !user.isAnonymous);
}

function providerLabel(user) {
  const providerId = user?.providerData?.find(Boolean)?.providerId || "";
  if (providerId.includes("line")) return "LINE";
  if (providerId.includes("whatsapp")) return "WhatsApp";
  return providerId || "會員";
}

function ensureStylesheet() {
  if (document.querySelector('link[data-member-auth-style="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${repoBase()}/assets/member-auth.css?v=${VERSION}`;
  link.dataset.memberAuthStyle = "1";
  document.head.appendChild(link);
}

function ensureLoginModal() {
  let wrap = document.querySelector("#member-auth-wrap");
  if (wrap) return wrap;
  wrap = document.createElement("div");
  wrap.id = "member-auth-wrap";
  wrap.className = "member-auth-wrap";
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="member-auth-backdrop" data-member-auth-close></div>
    <section class="member-auth-card" role="dialog" aria-modal="true" aria-labelledby="member-auth-title">
      <button class="member-auth-close" type="button" data-member-auth-close aria-label="關閉">×</button>
      <div class="member-auth-kicker">${isShopPage() ? "77select" : "77waxing"} MEMBER</div>
      <h2 id="member-auth-title">登入 / 註冊</h2>
      <p class="member-auth-copy" data-member-auth-copy>${isShopPage() ? "登入後即可檢視會員資料與商品訂單。" : "登入後即可繼續預約或訂購，並保留你的預約與消費紀錄。"}</p>
      <div class="member-auth-actions">
        <button class="member-provider member-provider-line" type="button" data-member-provider="line"><span>LINE</span><small>使用 LINE 登入</small></button>
        <button class="member-provider member-provider-whatsapp" type="button" data-member-provider="whatsapp"><span>WhatsApp</span><small>使用 WhatsApp 登入</small></button>
      </div>
      <p class="member-auth-status" data-member-auth-status aria-live="polite"></p>
      <p class="member-auth-foot">第一次登入即建立會員，不需要另外填寫註冊表。</p>
    </section>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll("[data-member-auth-close]").forEach((button) => {
    button.addEventListener("click", () => {
      if (loginRequired) return;
      closeLogin();
    });
  });
  wrap.querySelectorAll("[data-member-provider]").forEach((button) => {
    button.addEventListener("click", () => beginProviderLogin(button.dataset.memberProvider));
  });
  return wrap;
}

function setLoginStatus(message = "", state = "") {
  const status = ensureLoginModal().querySelector("[data-member-auth-status]");
  if (status.textContent !== message) status.textContent = message;
  if (status.dataset.state !== state) status.dataset.state = state;
}

function openLogin({ required = false, reason = "", targetUrl = "" } = {}) {
  loginRequired = Boolean(required);
  loginReason = reason || "";
  if (targetUrl) sessionStorage.setItem(PENDING_TARGET_KEY, targetUrl);
  const wrap = ensureLoginModal();
  const close = wrap.querySelector(".member-auth-close");
  close.hidden = loginRequired;
  const copy = wrap.querySelector("[data-member-auth-copy]");
  const copyText = reason === "booking"
    ? "登入後會直接進入預約畫面；若你從價目表進來，剛剛選好的服務會保留。"
    : reason === "checkout"
      ? "登入後即可繼續訂購，姓名、電話與 Email 會優先從會員資料帶入。"
      : isShopPage() ? "登入後即可檢視會員資料與商品訂單。" : "登入後即可檢視預約、施作與訂單紀錄。";
  if (copy.textContent !== copyText) copy.textContent = copyText;
  setLoginStatus("");
  wrap.hidden = false;
  document.documentElement.classList.add("member-auth-open");
}

function closeLogin() {
  const wrap = document.querySelector("#member-auth-wrap");
  if (wrap) wrap.hidden = true;
  document.documentElement.classList.remove("member-auth-open");
  loginRequired = false;
  loginReason = "";
}

async function beginProviderLogin(kind) {
  const config = providerConfig[kind];
  if (!config) return;
  try {
    setLoginStatus(`正在開啟 ${config.label} 登入…`);
    await setPersistence(auth, browserLocalPersistence);
    const provider = new OAuthProvider(config.providerId);
    config.scopes.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({ prompt: "consent" });
    if (!sessionStorage.getItem(PENDING_TARGET_KEY)) sessionStorage.setItem(PENDING_TARGET_KEY, location.href);
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error("member login failed", error);
    const code = String(error?.code || "");
    if (code.includes("operation-not-allowed") || code.includes("invalid-provider-id") || code.includes("invalid-oauth-provider")) {
      setLoginStatus(`${config.label} 登入暫時無法使用，請稍後再試或聯絡我們。`, "error");
    } else {
      setLoginStatus(`${config.label} 登入目前無法使用，請稍後再試。`, "error");
    }
  }
}

function fallbackProfile(user) {
  const firstProvider = user?.providerData?.find(Boolean) || {};
  const lineProvider = user?.providerData?.find((provider) => String(provider?.providerId || "").toLowerCase().includes("line"));
  const email = String(user?.email || firstProvider.email || "").trim();
  const displayName = String(user?.displayName || firstProvider.displayName || email.split("@")[0] || "").trim();
  const claims = user?.__77MemberClaims || {};
  // LINE is linked through the site's identity service rather than a Firebase
  // OAuth provider.  Its stable LINE subject therefore arrives as a custom
  // token claim, not in providerData.
  const linkedLineId = String(claims.lineUserId || lineProvider?.uid || "").trim();
  return {
    uid: user?.uid || "",
    displayName,
    email,
    phone: "",
    phoneCountry: "Taiwan",
    gender: "",
    birthday: "",
    lineId: linkedLineId,
    provider: providerLabel(user),
  };
}

async function loadProfile(user) {
  if (!isMember(user)) return null;
  // Start independent reads together; Firebase refreshes expired tokens itself.
  const profileRead = getDoc(doc(db, PROFILE_COLLECTION, user.uid)).then(snap => ({ snap }), error => ({ error }));
  const claimsRead = (async () => {
  try {
    const tokenResult = await getIdTokenResult(user);
    user.__77MemberClaims = { ...(tokenResult?.claims || {}), ...(user.__77MemberClaims || {}) };
  } catch (error) {
    console.warn("member token claims unavailable", error);
  }
  })();
  const identityRead = (async () => {
  // A member may have signed in with Google after linking LINE.  In that
  // case the LINE subject belongs to the secured identity-link service, not
  // Firebase's providerData/custom token.  Ask that service only for the
  // current signed-in member's linked LINE identifier.
  try {
    const firebaseIdToken = await user.getIdToken();
    const response = await fetch(IDENTITY_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ action: "identity_status", firebaseIdToken }),
    });
    const identity = await response.json();
    if (response.ok && identity?.ok && identity.lineUserId) {
      user.__77MemberClaims = { ...(user.__77MemberClaims || {}), lineUserId: String(identity.lineUserId) };
    }
  } catch (error) {
    console.warn("linked LINE identity unavailable", error);
  }
  })();
  await Promise.all([claimsRead, identityRead]);
  const fallback = fallbackProfile(user);
  try {
    const ref = doc(db, PROFILE_COLLECTION, user.uid);
    const result = await profileRead;
    if (result.error) throw result.error;
    const snap = result.snap;
    if (snap.exists()) {
      const profile = { ...fallback, ...snap.data(), uid: user.uid };
      if (fallback.lineId && !profile.lineId) {
        await setDoc(ref, { uid: user.uid, lineId: fallback.lineId, updatedAt: serverTimestamp() }, { merge: true });
        profile.lineId = fallback.lineId;
      }
      return profile;
    }
    const initial = {
      ...fallback,
      uid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initial, { merge: true });
    return initial;
  } catch (error) {
    console.warn("member profile unavailable", error);
    return fallback;
  }
}

async function ensureProfile() {
  if (!isMember()) return null;
  if (currentProfile?.uid === currentUser.uid) return currentProfile;
  if (!profilePromise) {
    const user = currentUser;
    const pending = loadProfile(user)
      .then((profile) => {
        if (currentUser?.uid !== user.uid) return null;
        currentProfile = profile;
        window.dispatchEvent(new CustomEvent("77waxing:member-ready", { detail: { user: currentUser, profile } }));
        return profile;
      })
      .finally(() => { if (profilePromise === pending) profilePromise = null; });
    profilePromise = pending;
  }
  return profilePromise;
}

async function saveProfile(patch) {
  if (!isMember()) return;
  const clean = Object.fromEntries(Object.entries(patch || {}).filter(([, value]) => value !== undefined));
  currentProfile = { ...(currentProfile || fallbackProfile(currentUser)), ...clean, uid: currentUser.uid };
  try {
    await setDoc(doc(db, PROFILE_COLLECTION, currentUser.uid), {
      ...clean,
      uid: currentUser.uid,
      provider: providerLabel(currentUser),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn("member profile save unavailable", error);
  }
}

function memberButtonLabel() {
  if (!isMember()) return "登入 / 註冊";
  return currentProfile?.displayName || currentUser.displayName || (isShopPage() ? "會員中心" : "會員紀錄");
}

function ensureMainMemberButton() {
  const nav = document.querySelector(".header nav");
  if (!nav || nav.querySelector("[data-member-trigger]")) return;
  const product = nav.querySelector(".product-order");
  const link = document.createElement("a");
  link.href = "#member";
  link.className = "member-nav-link";
  link.dataset.memberTrigger = "1";
  link.innerHTML = `<strong class="nav-zh">${esc(memberButtonLabel())}</strong><small class="nav-en">MEMBER</small>`;
  if (product) product.after(link); else nav.appendChild(link);
}

function ensureShopMemberButton() {
  const header = document.querySelector(".shop-nav");
  if (!header || header.querySelector("[data-member-trigger]")) return;
  const cart = header.querySelector("#cart-open");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shop-member-button";
  button.dataset.memberTrigger = "1";
  button.textContent = memberButtonLabel();
  if (cart) cart.before(button); else header.appendChild(button);
}

function syncMemberButtons() {
  ensureMainMemberButton();
  ensureShopMemberButton();
  const label = memberButtonLabel();
  document.querySelectorAll("[data-member-trigger]").forEach((button) => {
    if (button.matches("a")) {
      const zh = button.querySelector(".nav-zh");
      if (zh && zh.textContent !== label) zh.textContent = label;
    } else if (button.textContent !== label) {
      button.textContent = label;
    }
  });
}

function genderText(value) {
  return ({ female: "生理女", male: "生理男", private: "其他／不透露" }[value] || "未填寫");
}

function rocBirthday(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `民國 ${Number(match[1]) - 1911} 年 ${Number(match[2])} 月 ${Number(match[3])} 日` : "尚未填寫";
}

function parseGender(note) {
  const match = String(note || "").match(/^\[性別\]\s*([^\n]+)/);
  const text = match?.[1]?.trim() || "";
  if (text === "女性" || text === "生理女") return "female";
  if (text === "男性" || text === "生理男") return "male";
  if (text) return "private";
  return "";
}

function cleanBookingNote(note) {
  return String(note || "").replace(/^\[性別\]\s*[^\n]*\n?/, "").trim();
}

function formatBookingStatus(status) {
  return ({
    pending_confirmation: "待確認",
    pending_payment: "待付款",
    confirmed: "已確認",
    completed: "已完成",
    cancelled: "已取消",
  }[status] || status || "處理中");
}

async function loadBookingHistory() {
  // Store membership must never query treatment/appointment history.
  if (!isMember() || isShopPage()) return [];
  const snap = await getDocs(query(collection(db, "bookings"), where("ownerUid", "==", currentUser.uid)));
  return snap.docs
    .map((row) => ({ id: row.id, ...row.data() }))
    .sort((a, b) => `${b.preferredDate || ""} ${b.preferredTime || ""}`.localeCompare(`${a.preferredDate || ""} ${a.preferredTime || ""}`));
}

function ensureMemberCenter() {
  let wrap = document.querySelector("#member-center-wrap");
  if (wrap) return wrap;
  wrap = document.createElement("div");
  wrap.id = "member-center-wrap";
  wrap.className = "member-auth-wrap";
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="member-auth-backdrop" data-member-center-close></div>
    <section class="member-center-card" role="dialog" aria-modal="true" aria-labelledby="member-center-title">
      <div class="member-center-head">
        <div><div class="member-auth-kicker">${isShopPage() ? "77select" : "77waxing"} MEMBER</div><h2 id="member-center-title">${isShopPage() ? "會員中心" : "我的紀錄"}</h2></div>
        <button class="member-auth-close" type="button" data-member-center-close aria-label="關閉">×</button>
      </div>
      <div class="member-profile-summary" data-member-profile-summary></div>
      <div class="member-history" data-member-history>${isShopPage() ? "" : '<div class="member-history-empty">正在讀取預約紀錄…</div>'}</div>
      <div class="member-center-foot"><button type="button" class="member-logout" data-member-logout>登出</button></div>
    </section>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll("[data-member-center-close]").forEach((button) => button.addEventListener("click", closeMemberCenter));
  wrap.querySelector("[data-member-logout]").addEventListener("click", async () => {
    await signOut(auth);
    closeMemberCenter();
    openLogin({ required: isBookingPage(), reason: isBookingPage() ? "booking" : "" });
  });
  return wrap;
}

function closeMemberCenter() {
  memberCenterRequest++;
  const wrap = document.querySelector("#member-center-wrap");
  if (wrap) wrap.hidden = true;
  document.documentElement.classList.remove("member-auth-open");
}

async function openMemberCenter() {
  if (!isMember()) return openLogin({ reason: "member" });
  const uid = currentUser.uid, request = ++memberCenterRequest;
  const shop = isShopPage();
  const wrap = ensureMemberCenter();
  const summary = wrap.querySelector("[data-member-profile-summary]");
  const history = wrap.querySelector("[data-member-history]");
  summary.setAttribute("aria-busy", "true");
  summary.innerHTML = '<div class="member-history-empty" role="status" style="grid-column:1/-1">正在讀取會員資料…</div>';
  history.replaceChildren();
  wrap.hidden = false;
  document.documentElement.classList.add("member-auth-open");
  let profile;
  try {
    profile = await ensureProfile();
  } catch (error) {
    if (request === memberCenterRequest && !wrap.hidden) {
      summary.innerHTML = '<div class="member-history-empty" role="status" style="grid-column:1/-1">目前無法讀取會員資料，請關閉後再試。</div>';
    }
    return;
  } finally {
    if (request === memberCenterRequest) summary.setAttribute("aria-busy", "false");
  }
  if (request !== memberCenterRequest || !isMember() || currentUser.uid !== uid || wrap.hidden) return;
  summary.innerHTML = `
    <div><small>會員名稱</small><b>${esc(profile?.displayName || currentUser.displayName || "—")}</b></div>
    <div><small>Email</small><b>${esc(profile?.email || currentUser.email || "尚未填寫")}</b></div>
    <div><small>電話</small><b>${esc(profile?.phone || "尚未填寫")}</b></div>
    ${shop ? "" : `<div><small>生理性別</small><b>${esc(genderText(profile?.gender))}</b></div>`}
    <div><small>生日</small><b>${esc(rocBirthday(profile?.birthday))}</b></div>`;
  if (shop) {
    // Reuse the store's existing order view and owner-scoped order subscription.
    // Do not fetch bookings and do not disguise treatment rows as order rows.
    history.innerHTML = `<button type="button" class="member-provider" data-member-orders><span>我的訂單</span><small>檢視訂單狀態</small></button><p class="member-auth-copy">商品訂購紀錄請至「我的訂單」檢視。</p>`;
    history.querySelector("[data-member-orders]").addEventListener("click", () => {
      if (!isMember()) return openLogin({ reason: "member" });
      const orders = document.querySelector('[data-tab="orders"]');
      if (!orders) return;
      closeMemberCenter();
      orders.click();
    });
    return;
  }
  history.innerHTML = `<div class="member-history-empty">正在讀取預約紀錄…</div>`;
  try {
    const rows = await loadBookingHistory();
    if (request !== memberCenterRequest || !isMember() || currentUser.uid !== uid || wrap.hidden) return;
    history.innerHTML = rows.length ? rows.map((booking) => {
      const gender = ["female", "male"].includes(booking.customerGender)
        ? booking.customerGender : parseGender(booking.note) || profile?.gender || "";
      const note = cleanBookingNote(booking.note);
      const phone = booking.customerPhoneInternational || booking.customerPhone || "—";
      return `<article class="member-history-card">
        <div class="member-history-head"><div><b>${esc(String(booking.serviceName || "服務紀錄").replace(/\u64a5筋/g, '鬆筋'))}</b><span>${esc(booking.preferredDate || "—")} ${esc(booking.preferredTime || "")}</span></div><em>${esc(formatBookingStatus(booking.status))}</em></div>
        <dl>
          <div><dt>施作時間</dt><dd>${esc(booking.durationMinutes ? `${booking.durationMinutes} 分鐘` : "—")}</dd></div>
          <div><dt>姓名</dt><dd>${esc(booking.customerName || "—")}</dd></div>
          <div><dt>電話</dt><dd>${esc(phone)}</dd></div>
          <div><dt>Email</dt><dd>${esc(booking.customerEmail || "—")}</dd></div>
          <div><dt>性別</dt><dd>${esc(genderText(gender))}</dd></div>
          <div><dt>來店</dt><dd>${booking.isFirstVisit ? "第一次" : "回訪"}</dd></div>
          ${note ? `<div class="wide"><dt>備註</dt><dd>${esc(note)}</dd></div>` : ""}
        </dl>
      </article>`;
    }).join("") : `<div class="member-history-empty">目前還沒有預約／施作紀錄。</div>`;
  } catch (error) {
    if (request !== memberCenterRequest || !isMember() || currentUser.uid !== uid || wrap.hidden) return;
    console.warn("member booking history unavailable", error);
    history.innerHTML = `<div class="member-history-empty">目前無法讀取預約紀錄，請稍後再試。</div>`;
  }
}

function fillFieldOnce(element, value, { force = false } = {}) {
  if (!element || value == null || value === "" || element.dataset.memberPrefilled === "1") return;
  if (!force && element.value) return;
  element.value = String(value);
  element.dataset.memberPrefilled = "1";
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearMemberPrefills() {
  document.querySelectorAll('[data-member-prefilled="1"]').forEach((element) => {
    element.value = element.name === "phoneCountry" ? "Taiwan" : "";
    delete element.dataset.memberPrefilled;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  document.querySelectorAll('[name="line"][data-member-hidden="1"]').forEach((element) => { element.value = ""; });
}

function applyProfileToBooking() {
  if (!isMember() || !currentProfile) return;
  const root = document.querySelector("#booking");
  if (!root) return;

  const lineInput = root.querySelector('[name="line"]');
  if (lineInput && lineInput.dataset.memberHidden !== "1") {
    lineInput.value = currentProfile.lineId || "";
    const label = lineInput.closest("label");
    lineInput.remove();
    if (label) label.remove();
    lineInput.type = "hidden";
    lineInput.dataset.memberHidden = "1";
    root.appendChild(lineInput);
  }
  if (lineInput) lineInput.value = currentProfile.lineId || "";

  fillFieldOnce(root.querySelector('[name="name"]'), currentProfile.displayName || currentUser.displayName || "");
  fillFieldOnce(root.querySelector('[name="email"]'), currentProfile.email || currentUser.email || "");
  fillFieldOnce(root.querySelector('[name="phoneCountry"]'), currentProfile.phoneCountry || "Taiwan", { force: true });
  fillFieldOnce(root.querySelector('[name="phone"]'), currentProfile.phone || "");
  fillFieldOnce(root.querySelector('[name="gender"]'), currentProfile.gender || "");
  fillFieldOnce(root.querySelector('[name="birthday"]'), currentProfile.birthday || "");

  const note = root.querySelector('[data-step="3"] > .muted');
  if (note && note.dataset.memberCopy !== "1") {
    note.textContent = "已從會員資料帶入姓名、電話、Email、生理性別與生日；需要時可以直接修改。";
    note.dataset.memberCopy = "1";
  }
}

async function saveBookingProfile() {
  if (!isMember()) return;
  const root = document.querySelector("#booking");
  if (!root) return;
  await saveProfile({
    displayName: root.querySelector('[name="name"]')?.value.trim() || currentProfile?.displayName || "",
    email: root.querySelector('[name="email"]')?.value.trim().toLowerCase() || currentProfile?.email || "",
    phone: root.querySelector('[name="phone"]')?.value.trim() || currentProfile?.phone || "",
    phoneCountry: root.querySelector('[name="phoneCountry"]')?.value || currentProfile?.phoneCountry || "Taiwan",
    gender: root.querySelector('[name="gender"]')?.value || currentProfile?.gender || "",
    birthday: root.querySelector('[name="birthday"]')?.value || currentProfile?.birthday || "",
    lineId: currentProfile?.lineId || fallbackProfile(currentUser).lineId || "",
    lastBookingAt: serverTimestamp(),
  });
  syncMemberButtons();
}

function applyProfileToShop() {
  if (!isMember() || !currentProfile) return;
  fillFieldOnce(document.querySelector("#checkout-name"), currentProfile.displayName || "");
  fillFieldOnce(document.querySelector("#checkout-phone"), currentProfile.phone || "");
  fillFieldOnce(document.querySelector("#checkout-email"), currentProfile.email || currentUser.email || "");
  fillFieldOnce(document.querySelector("#qa-name"), currentProfile.displayName || "");
  fillFieldOnce(document.querySelector("#qa-email"), currentProfile.email || currentUser.email || "");
}

async function saveShopProfile() {
  if (!isMember()) return;
  const name = document.querySelector("#checkout-name")?.value.trim() || document.querySelector("#qa-name")?.value.trim() || "";
  const phone = document.querySelector("#checkout-phone")?.value.trim() || "";
  const email = document.querySelector("#checkout-email")?.value.trim().toLowerCase() || document.querySelector("#qa-email")?.value.trim().toLowerCase() || "";
  if (!name && !phone && !email) return;
  await saveProfile({ displayName: name || currentProfile?.displayName || "", phone: phone || currentProfile?.phone || "", email: email || currentProfile?.email || "" });
  syncMemberButtons();
}

function interceptProtectedActions() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-member-trigger]");
    if (trigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isMember()) openMemberCenter(); else openLogin({ reason: "member" });
      return;
    }

    const bookingLink = event.target.closest?.('a[href*="/booking"]');
    if (bookingLink && !isMember()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openLogin({ reason: "booking", targetUrl: bookingLink.href });
      return;
    }

    if (!isShopPage() || isMember()) return;
    const checkout = event.target.closest?.("#checkout-open");
    const ordersTab = event.target.closest?.('[data-tab="orders"]');
    if (checkout || ordersTab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openLogin({ reason: checkout ? "checkout" : "member", targetUrl: location.href });
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target?.matches?.("#checkout-form") && !isMember()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openLogin({ reason: "checkout", targetUrl: location.href });
      return;
    }
    if (event.target?.matches?.("#checkout-form, #qa-form") && isMember()) saveShopProfile();
  }, true);
}

function watchDom() {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    syncMemberButtons();
    if (isMember()) {
      applyProfileToBooking();
      applyProfileToShop();
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    // Yield back to the browser. Using an endless microtask chain here can
    // starve timers, CSS animation progress and the homepage intro watchdog.
    setTimeout(run, 0);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  run();
}

async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return;
    const target = sessionStorage.getItem(PENDING_TARGET_KEY) || "";
    sessionStorage.removeItem(PENDING_TARGET_KEY);
    if (target && target !== location.href) location.assign(target);
  } catch (error) {
    console.error("member redirect result failed", error);
    openLogin({ required: isBookingPage(), reason: isBookingPage() ? "booking" : "" });
    setLoginStatus("登入沒有完成，請再試一次。", "error");
  }
}

ensureStylesheet();
ensureLoginModal();
interceptProtectedActions();
watchDom();
window.addEventListener("77waxing:booking-created", () => saveBookingProfile());

await setPersistence(auth, browserLocalPersistence).catch(() => {});
await handleRedirectResult();

onAuthStateChanged(auth, async (user) => {
  if (currentUser?.uid !== user?.uid || !isMember(user)) {
    clearMemberPrefills();
    closeMemberCenter();
    const center = document.querySelector("#member-center-wrap");
    center?.querySelector("[data-member-profile-summary]")?.replaceChildren();
    center?.querySelector("[data-member-history]")?.replaceChildren();
  }
  authReady = true;
  currentUser = user || null;
  currentProfile = null;
  profilePromise = null;

  if (isMember(user)) {
    closeLogin();
    syncMemberButtons();
    await ensureProfile();
    if (currentUser?.uid !== user.uid) return;
    syncMemberButtons();
    applyProfileToBooking();
    applyProfileToShop();
    return;
  }

  syncMemberButtons();
  if (isBookingPage()) openLogin({ required: true, reason: "booking", targetUrl: location.href });
});

window.__77_MEMBER__ = {
  get authReady() { return authReady; },
  get user() { return currentUser; },
  get profile() { return currentProfile; },
  isMember,
  openLogin,
  openMemberCenter,
  saveProfile,
};
