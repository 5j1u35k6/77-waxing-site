import {
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth, db } = getPublicFirebase();
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const VERSION = "20260915-google4-restore";

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
  if (button.dataset.memberProvider !== "google") button.dataset.memberProvider = "google";
  if (button.classList.contains("member-provider-whatsapp")) button.classList.remove("member-provider-whatsapp");
  if (!button.classList.contains("member-provider-google")) button.classList.add("member-provider-google");
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
  if (code.includes("unauthorized-domain")) return "目前網站網域尚未加入 Firebase 授權網域。";
  if (code.includes("popup-closed-by-user")) return "Google 登入已取消。";
  if (code.includes("popup-blocked")) return "瀏覽器阻擋了 Google 登入視窗，請允許彈出式視窗後再試。";
  if (code.includes("account-exists-with-different-credential")) return "這個 Email 已使用其他登入方式建立會員，請先用原本方式登入。";
  return `Google 登入目前無法使用（${code}）。`;
}

async function beginGoogleLogin() {
  const target = pendingTarget();
  setStatus("正在開啟 Google 登入…");
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
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
let retagScheduled = false;
new MutationObserver(() => {
  if (retagScheduled) return;
  retagScheduled = true;
  setTimeout(() => {
    retagScheduled = false;
    retagGoogleButton();
  }, 0);
}).observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("click", (event) => {
  const button = event.target.closest?.('[data-member-provider="google"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  beginGoogleLogin();
}, true);

window.__77_GOOGLE_AUTH_UI__ = { version: VERSION, beginGoogleLogin };
