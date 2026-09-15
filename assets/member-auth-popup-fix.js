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
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
const VERSION = "20260915-line-custom1";

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

function cleanAuthFragment() {
  if (!location.hash) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

async function consumeLineCallback() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const errorCode = String(params.get("77line_error") || "").trim();
  const customToken = String(params.get("77line_token") || "").trim();
  if (!errorCode && !customToken) return false;

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

function beginLineLogin() {
  const target = sessionStorage.getItem(PENDING_TARGET_KEY) || location.href;
  if (!sessionStorage.getItem(PENDING_TARGET_KEY)) sessionStorage.setItem(PENDING_TARGET_KEY, target);
  setStatus("正在前往 LINE 官方登入…");
  const url = `${APPS_SCRIPT_URL}?action=line_login&target=${encodeURIComponent(target)}`;
  location.assign(url);
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
