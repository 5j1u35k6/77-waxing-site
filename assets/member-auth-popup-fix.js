import {
  browserLocalPersistence,
  setPersistence,
  signInWithCustomToken,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth, db } = getPublicFirebase();
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const PENDING_TARGET_LOCAL_KEY = "77waxing_member_pending_target_persist";
const PENDING_TARGET_COOKIE = "77waxing_member_pending_target_cookie";
const LINE_STATE_KEY = "77waxing_line_oauth_state";
const LINE_STATE_LOCAL_KEY = "77waxing_line_oauth_state_persist";
const LINE_STATE_COOKIE = "77waxing_line_oauth_state_cookie";
const LINE_DEBUG_KEY = "77waxing_line_auth_debug";
const LINK_RETURN_KEY = "77waxing_account_link_return";
const LINE_AUTH_PROXY_URL = "https://77waxing-line-auth-proxy.max19450.workers.dev/";
const LINE_CHANNEL_ID = "2011606795";
const LINE_CALLBACK_URL = "https://5j1u35k6.github.io/77-waxing-site/line-auth/";
const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const OAUTH_STORAGE_TTL_MS = 15 * 60 * 1000;
const VERSION = "20260915-line-custom6-linked";

function statusElement() {
  return document.querySelector("#member-auth-wrap [data-member-auth-status]");
}

function setStatus(message = "", state = "") {
  const el = statusElement();
  if (!el) return;
  if (el.textContent !== message) el.textContent = message;
  if (el.dataset.state !== state) el.dataset.state = state;
}

function rememberDebug(stage, detail = "") {
  try {
    sessionStorage.setItem(LINE_DEBUG_KEY, JSON.stringify({ stage, detail: String(detail || ""), version: VERSION, at: Date.now() }));
  } catch {}
}

function showLoginError(message, detail = "") {
  rememberDebug("error", detail || message);
  try {
    window.__77_MEMBER__?.openLogin?.({ reason: "member" });
  } catch {}
  setTimeout(() => setStatus(message, "error"), 0);
}

function cookieValue(name) {
  const prefix = `${name}=`;
  const item = String(document.cookie || "").split("; ").find((part) => part.startsWith(prefix));
  if (!item) return "";
  try { return decodeURIComponent(item.slice(prefix.length)); } catch { return ""; }
}

function writeOAuthValue(sessionKey, localKey, cookieName, value) {
  const text = String(value || "");
  try { sessionStorage.setItem(sessionKey, text); } catch {}
  try { localStorage.setItem(localKey, JSON.stringify({ value: text, at: Date.now() })); } catch {}
  try {
    document.cookie = `${cookieName}=${encodeURIComponent(text)}; Max-Age=900; Path=/77-waxing-site/; Secure; SameSite=Lax`;
  } catch {}
}

function readOAuthValue(sessionKey, localKey, cookieName) {
  try {
    const value = String(sessionStorage.getItem(sessionKey) || "").trim();
    if (value) return value;
  } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(localKey) || "null");
    if (saved && Date.now() - Number(saved.at || 0) <= OAUTH_STORAGE_TTL_MS) {
      const value = String(saved.value || "").trim();
      if (value) return value;
    }
  } catch {}
  return String(cookieValue(cookieName) || "").trim();
}

function clearOAuthValue(sessionKey, localKey, cookieName) {
  try { sessionStorage.removeItem(sessionKey); } catch {}
  try { localStorage.removeItem(localKey); } catch {}
  try {
    document.cookie = `${cookieName}=; Max-Age=0; Path=/77-waxing-site/; Secure; SameSite=Lax`;
  } catch {}
}

function getPendingTarget() {
  return readOAuthValue(PENDING_TARGET_KEY, PENDING_TARGET_LOCAL_KEY, PENDING_TARGET_COOKIE);
}

function setPendingTarget(value) {
  writeOAuthValue(PENDING_TARGET_KEY, PENDING_TARGET_LOCAL_KEY, PENDING_TARGET_COOKIE, value);
}

function clearPendingTarget() {
  clearOAuthValue(PENDING_TARGET_KEY, PENDING_TARGET_LOCAL_KEY, PENDING_TARGET_COOKIE);
}

function getExpectedState() {
  return readOAuthValue(LINE_STATE_KEY, LINE_STATE_LOCAL_KEY, LINE_STATE_COOKIE);
}

function setExpectedState(value) {
  writeOAuthValue(LINE_STATE_KEY, LINE_STATE_LOCAL_KEY, LINE_STATE_COOKIE, value);
}

function clearExpectedState() {
  clearOAuthValue(LINE_STATE_KEY, LINE_STATE_LOCAL_KEY, LINE_STATE_COOKIE);
}

function decodeCustomClaims(token) {
  try {
    const part = String(token || "").split(".")[1] || "";
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const json = decodeURIComponent(Array.from(atob(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    return JSON.parse(json)?.claims || {};
  } catch (error) {
    console.warn("LINE custom token claims unavailable", error);
    return {};
  }
}

function randomUrlSafe(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  data.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cleanAuthFragment() {
  if (!location.hash) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
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
    const code = String(result?.error || `proxy_http_${response.status}`);
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return result;
}

async function consumeLineCallback() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const errorCode = String(params.get("77line_error") || "").trim();
  const customToken = String(params.get("77line_token") || "").trim();
  const returnedState = String(params.get("77line_state") || "").trim();
  if (!errorCode && !customToken) return false;

  const expectedState = getExpectedState();
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    cleanAuthFragment();
    clearExpectedState();
    showLoginError("LINE 登入驗證狀態不一致，請重新登入。", "state_mismatch");
    return true;
  }

  clearExpectedState();

  if (errorCode) {
    cleanAuthFragment();
    showLoginError(`LINE 已完成授權，但會員交換失敗（${errorCode}）。`, errorCode);
    return true;
  }

  try {
    rememberDebug("custom_token_received");
    const claims = decodeCustomClaims(customToken);
    await setPersistence(auth, browserLocalPersistence);
    setStatus("LINE 身分驗證完成，正在登入會員…");

    const result = await signInWithCustomToken(auth, customToken);
    if (!result?.user || result.user.isAnonymous) throw new Error("LINE_CUSTOM_SIGNIN_EMPTY");
    await result.user.getIdToken(true);
    rememberDebug("firebase_signed_in");

    const displayName = String(claims.lineName || "").trim();
    const lineUserId = String(claims.lineUserId || "").trim();
    const linePicture = String(claims.linePicture || "").trim();
    const defaultLineUid = lineUserId ? `line_${lineUserId}`.slice(0, 128) : "";
    const mappedIdentity = Boolean(claims.linked) || Boolean(defaultLineUid && result.user.uid !== defaultLineUid);

    if (!mappedIdentity && (displayName || linePicture)) {
      await updateProfile(result.user, {
        ...(displayName ? { displayName } : {}),
        ...(linePicture ? { photoURL: linePicture } : {}),
      }).catch((error) => console.warn("LINE Firebase profile update unavailable", error));
    }

    try {
      const patch = {
        uid: result.user.uid,
        ...(lineUserId ? { lineUserId } : {}),
        ...(linePicture ? { linePicture } : {}),
        ...(displayName ? { lineName: displayName } : {}),
        updatedAt: serverTimestamp(),
      };
      if (!mappedIdentity) {
        if (displayName) patch.displayName = displayName;
        patch.provider = "LINE";
      }
      await setDoc(doc(db, "memberProfiles", result.user.uid), patch, { merge: true });
    } catch (error) {
      console.warn("LINE member profile write unavailable", error);
      rememberDebug("firebase_signed_in_profile_write_failed", error?.code || error?.message || "");
    }

    if (claims.linked) {
      try { sessionStorage.setItem(LINK_RETURN_KEY, "line"); } catch {}
    }

    clearPendingTarget();
    cleanAuthFragment();
    setStatus(claims.linked ? "LINE 綁定成功，正在回到會員中心…" : "LINE 登入成功，正在載入會員資料…", "success");
    window.dispatchEvent(new CustomEvent("77waxing:line-login-complete", { detail: { user: result.user, linked: Boolean(claims.linked) } }));
    rememberDebug("complete");

    setTimeout(() => location.reload(), 180);
    return true;
  } catch (error) {
    console.error("LINE custom token login failed", error);
    cleanAuthFragment();
    const code = String(error?.code || error?.message || "unknown");
    showLoginError(`LINE 已授權，但 Firebase 會員登入失敗（${code}）。`, code);
    return true;
  }
}

async function beginLineLogin() {
  const target = getPendingTarget() || location.href;
  setPendingTarget(target);

  const state = randomUrlSafe(32);
  const nonce = randomUrlSafe(32);
  setExpectedState(state);
  rememberDebug("prepare_started");
  setStatus("正在前往 LINE 官方登入…");

  try {
    await proxyRequest({ action: "line_prepare", state, nonce, target });
    rememberDebug("prepare_complete");
  } catch (error) {
    console.error("LINE prepare failed", error);
    clearExpectedState();
    const code = String(error?.code || error?.message || "prepare_failed");
    showLoginError(`LINE 登入初始化失敗（${code}），請稍後再試。`, code);
    return;
  }

  const authorizeUrl = new URL(LINE_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", LINE_CHANNEL_ID);
  authorizeUrl.searchParams.set("redirect_uri", LINE_CALLBACK_URL);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "openid profile");
  authorizeUrl.searchParams.set("nonce", nonce);
  location.assign(authorizeUrl.href);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-member-provider]");
  if (!button) return;
  const kind = button.dataset.memberProvider;
  event.preventDefault();
  event.stopImmediatePropagation();

  if (kind === "line") {
    beginLineLogin();
    return;
  }
  if (kind === "whatsapp") {
    setStatus("WhatsApp 會員驗證尚未接通；目前先使用 LINE 登入。", "error");
  }
}, true);

await consumeLineCallback();
window.__77_MEMBER_LOGIN_TRANSPORT__ = VERSION;
window.__77_LINE_AUTH_DEBUG__ = () => {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(LINE_DEBUG_KEY) || "null"); } catch {}
  return {
    version: VERSION,
    user: auth.currentUser ? { uid: auth.currentUser.uid, isAnonymous: auth.currentUser.isAnonymous, displayName: auth.currentUser.displayName || "" } : null,
    saved,
    expectedStateSource: getExpectedState() ? "persisted" : "missing",
  };
};
