import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithCredential,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth, db } = getPublicFirebase();
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const GOOGLE_CLIENT_ID = "599089405147-7p219gctpabqnv946nnva0vfeg4jaoik.apps.googleusercontent.com";
const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";
const VERSION = "20260915-google3-gis";
let gsiPromise = null;

function modal() {
  return document.querySelector("#member-auth-wrap");
}

function statusElement() {
  return modal()?.querySelector("[data-member-auth-status]") || null;
}

function setStatus(message = "", state = "") {
  const el = statusElement();
  if (!el) return;
  if (el.textContent !== message) el.textContent = message;
  if (el.dataset.state !== state) el.dataset.state = state;
}

function injectStyles() {
  if (document.querySelector('style[data-google-auth-ui="1"]')) return;
  const style = document.createElement("style");
  style.dataset.googleAuthUi = "1";
  style.textContent = `.member-provider-google span{color:#4285f4}`;
  document.head.appendChild(style);
}

function retagGoogleButton() {
  injectStyles();
  const wrap = modal();
  if (!wrap) return;
  const button = wrap.querySelector('[data-member-provider="whatsapp"], [data-member-provider="google"]');
  if (!button) return;
  button.dataset.memberProvider = "google";
  button.classList.remove("member-provider-whatsapp");
  button.classList.add("member-provider-google");
  const title = button.querySelector("span");
  const subtitle = button.querySelector("small");
  if (title && title.textContent !== "Google") title.textContent = "Google";
  if (subtitle && subtitle.textContent !== "使用 Google 登入") subtitle.textContent = "使用 Google 登入";
}

function pendingTarget() {
  try {
    return String(sessionStorage.getItem(PENDING_TARGET_KEY) || location.href);
  } catch {
    return location.href;
  }
}

function clearPendingTarget() {
  try { sessionStorage.removeItem(PENDING_TARGET_KEY); } catch {}
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_GSI_SRC}"]`);
    const finish = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error("GOOGLE_GSI_UNAVAILABLE"));
    };
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("GOOGLE_GSI_LOAD_FAILED")), { once: true });
      setTimeout(() => {
        if (window.google?.accounts?.oauth2) resolve(window.google);
      }, 0);
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("GOOGLE_GSI_LOAD_FAILED"));
    document.head.appendChild(script);
  });
  return gsiPromise;
}

function requestGoogleAccessToken() {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error("GOOGLE_GSI_UNAVAILABLE"));
      return;
    }
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      include_granted_scopes: true,
      callback: (response) => {
        if (response?.error) {
          const error = new Error(String(response.error));
          error.code = String(response.error);
          reject(error);
          return;
        }
        const accessToken = String(response?.access_token || "").trim();
        if (!accessToken) {
          reject(new Error("GOOGLE_ACCESS_TOKEN_EMPTY"));
          return;
        }
        resolve(accessToken);
      },
      error_callback: (detail) => {
        const code = String(detail?.type || detail?.message || "GOOGLE_POPUP_FAILED");
        const error = new Error(code);
        error.code = code;
        reject(error);
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}

async function saveGoogleProfile(user) {
  if (!user || user.isAnonymous) return;
  const provider = user.providerData?.find((entry) => entry?.providerId === "google.com") || user.providerData?.find(Boolean) || {};
  const displayName = String(user.displayName || provider.displayName || "").trim();
  const email = String(user.email || provider.email || "").trim().toLowerCase();
  const avatarUrl = String(user.photoURL || provider.photoURL || "").trim();
  await setDoc(doc(db, "memberProfiles", user.uid), {
    uid: user.uid,
    provider: "Google",
    ...(displayName ? { displayName } : {}),
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

function errorText(error) {
  const code = String(error?.code || error?.message || "unknown");
  if (code.includes("operation-not-allowed")) return "Google 登入尚未在 Firebase 啟用。";
  if (code.includes("unauthorized-domain") || code.includes("origin")) return "目前網站網域尚未加入 Google / Firebase 授權來源。";
  if (code.includes("popup_closed") || code.includes("popup-closed") || code.includes("access_denied")) return "Google 登入已取消。";
  if (code.includes("popup_failed_to_open") || code.includes("popup-blocked")) return "瀏覽器阻擋了 Google 登入視窗，請允許彈出式視窗後再試。";
  if (code.includes("account-exists-with-different-credential")) return "這個 Email 已使用其他登入方式建立會員，請先用原本方式登入。";
  if (code.includes("GOOGLE_GSI_LOAD_FAILED") || code.includes("GOOGLE_GSI_UNAVAILABLE")) return "Google 登入元件載入失敗，請重新整理後再試。";
  return `Google 登入目前無法使用（${code}）。`;
}

async function beginGoogleLogin() {
  const target = pendingTarget();
  setStatus("正在開啟 Google 登入…");
  try {
    await setPersistence(auth, browserLocalPersistence);
    await loadGoogleIdentityServices();
    const accessToken = await requestGoogleAccessToken();
    const credential = GoogleAuthProvider.credential(null, accessToken);
    const result = await signInWithCredential(auth, credential);
    const user = result?.user;
    if (!user || user.isAnonymous) throw new Error("GOOGLE_SIGNIN_EMPTY");
    await user.getIdToken(true);
    await saveGoogleProfile(user).catch((error) => console.warn("Google member profile write unavailable", error));
    setStatus("Google 登入成功，正在載入會員資料…", "success");
    clearPendingTarget();
    window.dispatchEvent(new CustomEvent("77waxing:google-login-complete", { detail: { user } }));
    if (target && target !== location.href) {
      location.assign(target);
      return;
    }
    setTimeout(() => location.reload(), 120);
  } catch (error) {
    console.error("Google member login failed", error);
    setStatus(errorText(error), "error");
  }
}

retagGoogleButton();
loadGoogleIdentityServices().catch((error) => console.warn("Google Identity Services preload unavailable", error));

document.addEventListener("click", (event) => {
  const button = event.target.closest?.('[data-member-provider="google"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  beginGoogleLogin();
}, true);

window.__77_GOOGLE_AUTH_UI__ = { version: VERSION, beginGoogleLogin };
