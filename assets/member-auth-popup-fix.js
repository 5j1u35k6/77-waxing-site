import {
  browserLocalPersistence,
  OAuthProvider,
  setPersistence,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth } = getPublicFirebase();
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const runtimeConfig = window.__77_MEMBER_AUTH_CONFIG__ || {};

function statusElement() {
  return document.querySelector("#member-auth-wrap [data-member-auth-status]");
}

function setStatus(message = "", state = "") {
  const el = statusElement();
  if (!el) return;
  if (el.textContent !== message) el.textContent = message;
  if (el.dataset.state !== state) el.dataset.state = state;
}

function providerFor(kind) {
  if (kind === "line") {
    return {
      label: "LINE",
      providerId: runtimeConfig.lineProviderId || "oidc.line",
      scopes: runtimeConfig.lineRequestEmail === true
        ? ["openid", "profile", "email"]
        : ["openid", "profile"],
    };
  }
  if (kind === "whatsapp" && runtimeConfig.whatsappProviderId) {
    return {
      label: "WhatsApp",
      providerId: runtimeConfig.whatsappProviderId,
      scopes: ["openid", "profile"],
    };
  }
  return null;
}

function friendlyError(label, error) {
  const code = String(error?.code || "");
  if (code.includes("operation-not-allowed") || code.includes("invalid-provider-id") || code.includes("invalid-oauth-provider")) {
    return `${label} 登入供應商尚未在 Firebase Authentication 正確啟用。`;
  }
  if (code.includes("unauthorized-domain")) {
    return "目前網站網域尚未加入 Firebase Authentication 的 Authorized domains。";
  }
  if (code.includes("popup-blocked")) {
    return "瀏覽器阻擋了登入視窗，請允許此網站開啟彈出式視窗後再試。";
  }
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
    return "登入視窗已關閉，尚未完成登入。";
  }
  if (code.includes("account-exists-with-different-credential")) {
    return "這個帳號已用其他登入方式建立，請先使用原本方式登入。";
  }
  return `${label} 登入沒有完成${code ? `（${code}）` : ""}。`;
}

async function loginWithPopup(kind) {
  if (kind === "whatsapp" && !runtimeConfig.whatsappProviderId) {
    setStatus("WhatsApp 目前尚未接上可用的會員驗證服務；現有 oidc.whatsapp 只是預留值，不能直接拿 WhatsApp 帳號登入。", "error");
    return;
  }

  const config = providerFor(kind);
  if (!config) return;

  try {
    setStatus(`正在開啟 ${config.label} 登入…`);
    await setPersistence(auth, browserLocalPersistence);

    const provider = new OAuthProvider(config.providerId);
    config.scopes.forEach((scope) => provider.addScope(scope));

    const result = await signInWithPopup(auth, provider);
    if (!result?.user || result.user.isAnonymous) throw new Error("MEMBER_LOGIN_EMPTY_RESULT");

    const target = sessionStorage.getItem(PENDING_TARGET_KEY) || "";
    sessionStorage.removeItem(PENDING_TARGET_KEY);
    setStatus(`${config.label} 登入成功，正在載入會員資料…`);

    if (target && target !== location.href) location.assign(target);
  } catch (error) {
    console.error("member popup login failed", error);
    setStatus(friendlyError(config.label, error), "error");
  }
}

// The site is hosted on GitHub Pages while Firebase Auth uses a firebaseapp.com
// authDomain. Modern browsers restrict the cross-origin storage used by
// signInWithRedirect(), so intercept provider buttons and use a popup flow.
document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-member-provider]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  loginWithPopup(button.dataset.memberProvider);
}, true);

window.__77_MEMBER_LOGIN_TRANSPORT__ = "popup";
