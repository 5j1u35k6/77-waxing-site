import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth } = getPublicFirebase();
const VERSION = "20260915-account-link2-diagnostics";
const LINE_AUTH_PROXY_URL = "https://77waxing-line-auth-proxy.max19450.workers.dev/";
const LINE_CHANNEL_ID = "2011606795";
const LINE_CALLBACK_URL = "https://5j1u35k6.github.io/77-waxing-site/line-auth/";
const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const PENDING_TARGET_LOCAL_KEY = "77waxing_member_pending_target_persist";
const PENDING_TARGET_COOKIE = "77waxing_member_pending_target_cookie";
const LINE_STATE_KEY = "77waxing_line_oauth_state";
const LINE_STATE_LOCAL_KEY = "77waxing_line_oauth_state_persist";
const LINE_STATE_COOKIE = "77waxing_line_oauth_state_cookie";

let statusCache = null;
let statusForUid = "";
let busy = "";
let renderScheduled = false;

function injectStyles() {
  if (document.querySelector('style[data-account-linking-style="1"]')) return;
  const style = document.createElement("style");
  style.dataset.accountLinkingStyle = "1";
  style.textContent = `
    .member-linking{margin:0 0 20px;padding:17px;border:1px solid #e8dfd5;border-radius:18px;background:#fff}
    .member-linking-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}
    .member-linking-head h3{margin:0;font-size:15px;color:#3b342e}.member-linking-head p{margin:4px 0 0;font-size:12px;line-height:1.6;color:#8a7d72}
    .member-linking-list{display:grid;gap:9px}.member-linking-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 13px;border-radius:14px;background:#f8f3ec}
    .member-linking-provider{display:grid;gap:3px}.member-linking-provider b{font-size:14px}.member-linking-provider small{font-size:11px;color:#8a7d72}
    .member-linking-action{border:1px solid #d8cbbc;background:#fff;color:#55483e;border-radius:999px;padding:8px 13px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
    .member-linking-action[data-linked="1"]{border-color:transparent;background:#ece5dc;color:#81756b;cursor:default}.member-linking-action:disabled{opacity:.65;cursor:default}
    .member-linking-status{min-height:18px;margin:10px 2px 0;font-size:12px;color:#75695f}.member-linking-status[data-state="error"]{color:#aa5148}.member-linking-status[data-state="success"]{color:#4f7a60}
    @media(max-width:520px){.member-linking-row{gap:10px}.member-linking-action{padding:8px 11px}}
  `;
  document.head.appendChild(style);
}

function center() {
  return document.querySelector("#member-center-wrap:not([hidden]) .member-center-card");
}

function ensureSection() {
  injectStyles();
  const card = center();
  if (!card) return null;
  let section = card.querySelector("[data-member-linking]");
  if (section) return section;
  section = document.createElement("section");
  section.className = "member-linking";
  section.dataset.memberLinking = "1";
  section.innerHTML = `
    <div class="member-linking-head">
      <div><h3>登入方式</h3><p>綁定後可用 LINE 或 Google 進入同一個會員帳號。</p></div>
    </div>
    <div class="member-linking-list">
      <div class="member-linking-row">
        <div class="member-linking-provider"><b>LINE</b><small data-link-label="line">讀取中…</small></div>
        <button class="member-linking-action" type="button" data-link-provider="line">讀取中</button>
      </div>
      <div class="member-linking-row">
        <div class="member-linking-provider"><b>Google</b><small data-link-label="google">讀取中…</small></div>
        <button class="member-linking-action" type="button" data-link-provider="google">讀取中</button>
      </div>
    </div>
    <p class="member-linking-status" data-link-status aria-live="polite"></p>`;
  const history = card.querySelector(".member-history");
  if (history) history.before(section); else card.querySelector(".member-center-foot")?.before(section);
  section.addEventListener("click", onSectionClick);
  return section;
}

function setLocalStatus(message = "", state = "") {
  const el = ensureSection()?.querySelector("[data-link-status]");
  if (!el) return;
  if (el.textContent !== message) el.textContent = message;
  if (el.dataset.state !== state) el.dataset.state = state;
}

async function proxyRequest(payload) {
  const response = await fetch(LINE_AUTH_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    const error = new Error(String(result?.error || `proxy_http_${response.status}`));
    error.code = String(result?.error || `proxy_http_${response.status}`);
    throw error;
  }
  return result;
}

async function loadStatus(force = false) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  if (!force && statusCache && statusForUid === user.uid) return statusCache;
  const firebaseIdToken = await user.getIdToken(true);
  const result = await proxyRequest({ action: "identity_status", firebaseIdToken });
  statusCache = result.providers || { line: false, google: false };
  statusForUid = user.uid;
  return statusCache;
}

function inferLocalProviders() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { line:false, google:false };
  return {
    line: String(user.uid || "").startsWith("line_"),
    google: Boolean(user.providerData?.some((entry) => entry?.providerId === "google.com")),
  };
}

function paintStatus(providers) {
  const section = ensureSection();
  if (!section || !providers) return;
  ["line", "google"].forEach((provider) => {
    const linked = Boolean(providers[provider]);
    const button = section.querySelector(`[data-link-provider="${provider}"]`);
    const label = section.querySelector(`[data-link-label="${provider}"]`);
    if (label) label.textContent = linked ? "已連結此會員" : "尚未綁定";
    if (button) {
      button.dataset.linked = linked ? "1" : "0";
      button.textContent = linked ? "已綁定" : `綁定 ${provider === "line" ? "LINE" : "Google"}`;
      button.disabled = linked || Boolean(busy);
    }
  });
}

function statusReadErrorText(error) {
  const code = String(error?.code || error?.message || "unknown");
  if (code.includes("invalid_action")) return "綁定後端尚未更新到新版 Cloudflare Worker（invalid_action）。";
  if (code.includes("missing_data") || code.includes("missing_shop_data")) return "Apps Script 尚未把會員綁定請求交給 IdentityLink（missing_data）。";
  if (code.includes("firebase_auth_invalid")) return "會員登入狀態已過期，請重新登入後再試。";
  if (code.includes("identity_server_error")) return "會員綁定後端執行失敗（identity_server_error），請檢查 Apps Script 執行紀錄。";
  if (code.includes("identity_backend_invalid")) return "Cloudflare 已收到請求，但 Apps Script 回傳格式不正確（identity_backend_invalid）。";
  if (code.includes("proxy_http_")) return `會員綁定服務目前無法連線（${code}）。`;
  return `目前無法讀取綁定狀態（${code}）。`;
}

async function render(force = false) {
  const section = ensureSection();
  if (!section || !auth.currentUser || auth.currentUser.isAnonymous) return;
  try {
    paintStatus(await loadStatus(force));
    setLocalStatus("");
  } catch (error) {
    console.warn("member identity status unavailable", error);
    statusCache = inferLocalProviders();
    statusForUid = auth.currentUser.uid;
    paintStatus(statusCache);
    setLocalStatus(statusReadErrorText(error), "error");
  }
}

async function bindGoogle() {
  if (busy) return;
  const primary = auth.currentUser;
  if (!primary || primary.isAnonymous) return;
  busy = "google";
  paintStatus(statusCache || {});
  setLocalStatus("正在開啟 Google 帳號選擇…");

  let tempAuth = null;
  try {
    const primaryIdToken = await primary.getIdToken(true);
    let tempApp = getApps().find((app) => app.name === "77waxing-link-temp");
    if (!tempApp) tempApp = initializeApp(firebaseConfig, "77waxing-link-temp");
    tempAuth = getAuth(tempApp);
    await setPersistence(tempAuth, inMemoryPersistence);

    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(tempAuth, provider);
    if (!result?.user) throw new Error("google_identity_missing");
    const secondaryIdToken = await result.user.getIdToken(true);

    setLocalStatus("正在合併會員資料並綁定 Google…");
    await proxyRequest({
      action: "identity_bind_google",
      primaryIdToken,
      secondaryIdToken,
    });

    statusCache = null;
    statusForUid = "";
    await loadStatus(true);
    paintStatus(statusCache);
    setLocalStatus("Google 已綁定，之後可用兩種方式登入同一會員。", "success");
  } catch (error) {
    console.error("Google account binding failed", error);
    setLocalStatus(bindingErrorText(error), "error");
  } finally {
    if (tempAuth?.currentUser) await signOut(tempAuth).catch(() => {});
    busy = "";
    paintStatus(statusCache || {});
  }
}

async function bindLine() {
  if (busy) return;
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  busy = "line";
  paintStatus(statusCache || {});
  setLocalStatus("正在準備 LINE 綁定…");

  try {
    const firebaseIdToken = await user.getIdToken(true);
    const state = randomUrlSafe(32);
    const nonce = randomUrlSafe(32);
    const target = location.href;
    writeOAuthValue(PENDING_TARGET_KEY, PENDING_TARGET_LOCAL_KEY, PENDING_TARGET_COOKIE, target);
    writeOAuthValue(LINE_STATE_KEY, LINE_STATE_LOCAL_KEY, LINE_STATE_COOKIE, state);

    await proxyRequest({
      action: "line_link_prepare",
      firebaseIdToken,
      state,
      nonce,
      target,
    });

    const authorizeUrl = new URL(LINE_AUTHORIZE_URL);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", LINE_CHANNEL_ID);
    authorizeUrl.searchParams.set("redirect_uri", LINE_CALLBACK_URL);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("scope", "openid profile");
    authorizeUrl.searchParams.set("nonce", nonce);
    location.assign(authorizeUrl.href);
  } catch (error) {
    console.error("LINE account binding failed", error);
    busy = "";
    paintStatus(statusCache || {});
    setLocalStatus(bindingErrorText(error), "error");
  }
}

function onSectionClick(event) {
  const button = event.target.closest?.("[data-link-provider]");
  if (!button || button.dataset.linked === "1" || button.disabled) return;
  if (button.dataset.linkProvider === "google") bindGoogle();
  if (button.dataset.linkProvider === "line") bindLine();
}

function writeOAuthValue(sessionKey, localKey, cookieName, value) {
  const text = String(value || "");
  try { sessionStorage.setItem(sessionKey, text); } catch {}
  try { localStorage.setItem(localKey, JSON.stringify({ value:text, at:Date.now() })); } catch {}
  try {
    document.cookie = `${cookieName}=${encodeURIComponent(text)}; Max-Age=900; Path=/77-waxing-site/; Secure; SameSite=Lax`;
  } catch {}
}

function randomUrlSafe(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  data.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bindingErrorText(error) {
  const code = String(error?.code || error?.message || "unknown");
  if (code.includes("popup-closed-by-user")) return "已取消 Google 帳號選擇。";
  if (code.includes("popup-blocked")) return "瀏覽器阻擋了 Google 視窗，請允許彈出式視窗後再試。";
  if (code.includes("google_already_linked")) return "這個 Google 已經綁定其他 77waxing 會員。";
  if (code.includes("line_already_linked")) return "這個 LINE 已經綁定其他 77waxing 會員。";
  if (code.includes("primary_google_exists")) return "目前會員已經綁定另一個 Google 帳號。";
  if (code.includes("firebase_auth_invalid")) return "會員登入狀態已過期，請重新登入後再綁定。";
  if (code.includes("invalid_action")) return "Cloudflare Worker 尚未更新到支援會員綁定的版本。";
  if (code.includes("missing_data") || code.includes("missing_shop_data")) return "Apps Script 的 doPost 尚未接上會員綁定路由。";
  if (code.includes("identity_server_error")) return "Apps Script 會員綁定後端執行失敗，請檢查執行紀錄。";
  return `綁定目前無法完成（${code}）。`;
}

function scheduleRender(force = false) {
  if (renderScheduled) return;
  renderScheduled = true;
  setTimeout(() => {
    renderScheduled = false;
    render(force);
  }, 0);
}

new MutationObserver((records) => {
  if (records.some((record) => record.type === "attributes" || record.addedNodes.length)) scheduleRender(false);
}).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["hidden"] });

window.addEventListener("77waxing:member-ready", () => {
  statusCache = null;
  statusForUid = "";
  scheduleRender(true);
});

document.addEventListener("click", (event) => {
  if (event.target.closest?.("[data-member-trigger]")) setTimeout(() => scheduleRender(true), 80);
}, true);

scheduleRender(false);
window.__77_ACCOUNT_LINKING__ = { version:VERSION, render:() => render(true) };
