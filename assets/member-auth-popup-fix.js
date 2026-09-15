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
const LINE_STATE_KEY = "77waxing_line_oauth_state";
const LINE_DEBUG_KEY = "77waxing_line_auth_debug";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
const LINE_CHANNEL_ID = "2011606795";
const LINE_CALLBACK_URL = "https://5j1u35k6.github.io/77-waxing-site/line-auth/";
const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const VERSION = "20260915-line-custom3";

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

async function consumeLineCallback() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const errorCode = String(params.get("77line_error") || "").trim();
  const customToken = String(params.get("77line_token") || "").trim();
  const returnedState = String(params.get("77line_state") || "").trim();
  if (!errorCode && !customToken) return false;

  const expectedState = String(sessionStorage.getItem(LINE_STATE_KEY) || "").trim();
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    cleanAuthFragment();
    sessionStorage.removeItem(LINE_STATE_KEY);
    showLoginError("LINE 登入驗證狀態不一致，請重新登入。", "state_mismatch");
    return true;
  }

  sessionStorage.removeItem(LINE_STATE_KEY);

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

    if (displayName || linePicture) {
      await updateProfile(result.user, {
        ...(displayName ? { displayName } : {}),
        ...(linePicture ? { photoURL: linePicture } : {}),
      }).catch((error) => console.warn("LINE Firebase profile update unavailable", error));
    }

    try {
      await setDoc(doc(db, "memberProfiles", result.user.uid), {
        uid: result.user.uid,
        ...(displayName ? { displayName } : {}),
        provider: "LINE",
        ...(lineUserId ? { lineUserId } : {}),
        ...(linePicture ? { linePicture } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      // Firestore profile permissions must not undo an otherwise valid Firebase login.
      console.warn("LINE member profile write unavailable", error);
      rememberDebug("firebase_signed_in_profile_write_failed", error?.code || error?.message || "");
    }

    sessionStorage.removeItem(PENDING_TARGET_KEY);
    cleanAuthFragment();
    setStatus("LINE 登入成功，正在載入會員資料…");
    window.dispatchEvent(new CustomEvent("77waxing:line-login-complete", { detail: { user: result.user } }));
    rememberDebug("complete");

    // Rebuild the member shell from persisted Firebase Auth state. This also
    // avoids any race between the base member module and the custom-token module.
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
  const target = sessionStorage.getItem(PENDING_TARGET_KEY) || location.href;
  if (!sessionStorage.getItem(PENDING_TARGET_KEY)) sessionStorage.setItem(PENDING_TARGET_KEY, target);

  const state = randomUrlSafe(32);
  const nonce = randomUrlSafe(32);
  sessionStorage.setItem(LINE_STATE_KEY, state);
  rememberDebug("prepare_started");
  setStatus("正在前往 LINE 官方登入…");

  const prepareUrl = new URL(APPS_SCRIPT_URL);
  prepareUrl.searchParams.set("action", "line_prepare");
  prepareUrl.searchParams.set("state", state);
  prepareUrl.searchParams.set("nonce", nonce);
  prepareUrl.searchParams.set("target", target);
  prepareUrl.searchParams.set("_", String(Date.now()));

  try {
    await fetch(prepareUrl.href, {
      method: "GET",
      mode: "no-cors",
      credentials: "omit",
      cache: "no-store",
    });
    rememberDebug("prepare_request_sent");
  } catch (error) {
    console.error("LINE prepare failed", error);
    sessionStorage.removeItem(LINE_STATE_KEY);
    showLoginError("LINE 登入初始化失敗，請稍後再試。", error?.message || "prepare_failed");
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
  };
};
