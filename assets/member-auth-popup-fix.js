import {
  browserLocalPersistence,
  setPersistence,
  signInWithCustomToken,
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
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
const LINE_CHANNEL_ID = "2011606795";
const LINE_CALLBACK_URL = "https://5j1u35k6.github.io/77-waxing-site/line-auth/";
const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const VERSION = "20260915-line-custom2";

function statusElement() {
  return document.querySelector("#member-auth-wrap [data-member-auth-status]");
}

function setStatus(message = "", state = "") {
  const el = statusElement();
  if (!el) return;
  if (el.textContent !== message) el.textContent = message;
  if (el.dataset.state !== state) el.dataset.state = state;
}

function decodeCustomClaims(token) {
  try {
    const part = String(token || "").split(".")[1] || "";
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const json = decodeURIComponent(Array.from(atob(padded), c => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
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
    setTimeout(() => setStatus("LINE 登入驗證狀態不一致，請重新登入。", "error"), 0);
    return true;
  }

  sessionStorage.removeItem(LINE_STATE_KEY);

  if (errorCode) {
    cleanAuthFragment();
    setTimeout(() => setStatus(`LINE 登入未完成（${errorCode}），請再試一次。`, "error"), 0);
    return true;
  }

  try {
    const claims = decodeCustomClaims(customToken);
    await setPersistence(auth, browserLocalPersistence);
    setStatus("LINE 身分驗證完成，正在登入會員…");
    const result = await signInWithCustomToken(auth, customToken);
    if (!result?.user || result.user.isAnonymous) throw new Error("LINE_CUSTOM_SIGNIN_EMPTY");

    const displayName = String(claims.lineName || "").trim();
    const lineUserId = String(claims.lineUserId || "").trim();
    const linePicture = String(claims.linePicture || "").trim();
    await setDoc(doc(db, "memberProfiles", result.user.uid), {
      uid: result.user.uid,
      ...(displayName ? { displayName } : {}),
      provider: "LINE",
      ...(lineUserId ? { lineUserId } : {}),
      ...(linePicture ? { linePicture } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    sessionStorage.removeItem(PENDING_TARGET_KEY);
    cleanAuthFragment();
    setStatus("LINE 登入成功，正在載入會員資料…");
    window.dispatchEvent(new CustomEvent("77waxing:line-login-complete", { detail: { user: result.user } }));
    return true;
  } catch (error) {
    console.error("LINE custom token login failed", error);
    cleanAuthFragment();
    setTimeout(() => setStatus(`LINE 已授權，但會員登入失敗（${String(error?.code || error?.message || "unknown")}）。`, "error"), 0);
    return true;
  }
}

async function beginLineLogin() {
  const target = sessionStorage.getItem(PENDING_TARGET_KEY) || location.href;
  if (!sessionStorage.getItem(PENDING_TARGET_KEY)) sessionStorage.setItem(PENDING_TARGET_KEY, target);

  const state = randomUrlSafe(32);
  const nonce = randomUrlSafe(32);
  sessionStorage.setItem(LINE_STATE_KEY, state);
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
  } catch (error) {
    console.error("LINE prepare failed", error);
    sessionStorage.removeItem(LINE_STATE_KEY);
    setStatus("LINE 登入初始化失敗，請稍後再試。", "error");
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
