import {
  GoogleAuthProvider,
  signInWithCustomToken,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth, db } = getPublicFirebase();
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const LINE_AUTH_PROXY_URL = "https://77waxing-line-auth-proxy.max19450.workers.dev/";
const VERSION = "20260915-google5-linked";

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

function googleIdentity(user) {
  const provider = user?.providerData?.find((entry) => entry?.providerId === "google.com") || user?.providerData?.find(Boolean) || {};
  return {
    displayName: String(user?.displayName || provider.displayName || "").trim(),
    email: String(user?.email || provider.email || "").trim().toLowerCase(),
    avatarUrl: String(user?.photoURL || provider.photoURL || "").trim(),
  };
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

async function resolveGoogleMember(googleUser) {
  const firebaseIdToken = await googleUser.getIdToken(true);
  const resolution = await proxyRequest({
    action: "identity_resolve",
    provider: "google",
    firebaseIdToken,
  });
  if (!resolution?.mapped || !resolution?.customToken) {
    return { user: googleUser, mapped: false };
  }
  setStatus("已找到綁定的會員，正在載入同一帳號…");
  const canonical = await signInWithCustomToken(auth, resolution.customToken);
  if (!canonical?.user || canonical.user.isAnonymous) throw new Error("GOOGLE_CANONICAL_SIGNIN_EMPTY");
  await canonical.user.getIdToken(true);
  return { user: canonical.user, mapped: true };
}

async function saveGoogleProfile(user, identity, { mapped = false } = {}) {
  if (!user || user.isAnonymous) return;
  const ref = doc(db, "memberProfiles", user.uid);
  const current = await getDoc(ref).then((snap) => snap.exists() ? snap.data() : {}).catch(() => ({}));
  const patch = {
    uid: user.uid,
    googleEmail: identity.email || "",
    googleAvatarUrl: identity.avatarUrl || "",
    updatedAt: serverTimestamp(),
  };

  const empty = (value) => value === undefined || value === null || String(value).trim() === "";
  if (!mapped || empty(current.provider)) patch.provider = mapped ? (current.provider || "會員") : "Google";
  if (identity.displayName && empty(current.displayName)) patch.displayName = identity.displayName;
  if (identity.email && empty(current.email)) patch.email = identity.email;
  if (identity.avatarUrl && empty(current.avatarUrl)) patch.avatarUrl = identity.avatarUrl;

  await setDoc(ref, patch, { merge: true });
}

function errorText(error) {
  const code = String(error?.code || error?.message || "unknown");
  if (code.includes("operation-not-allowed")) return "Google 登入尚未在 Firebase 啟用。";
  if (code.includes("unauthorized-domain")) return "目前網站網域尚未加入 Firebase 授權網域。";
  if (code.includes("popup-closed-by-user")) return "Google 登入已取消。";
  if (code.includes("popup-blocked")) return "瀏覽器阻擋了 Google 登入視窗，請允許彈出式視窗後再試。";
  if (code.includes("account-exists-with-different-credential")) return "這個 Email 已使用其他登入方式建立會員，請先用原本方式登入。";
  if (code.includes("firebase_auth_invalid")) return "會員驗證已過期，請重新登入。";
  if (code.includes("identity_backend") || code.includes("proxy_")) return "會員綁定服務目前無法連線，請稍後再試。";
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
    const googleUser = result?.user;
    if (!googleUser || googleUser.isAnonymous) throw new Error("GOOGLE_SIGNIN_EMPTY");
    const identity = googleIdentity(googleUser);
    const resolved = await resolveGoogleMember(googleUser);
    const user = resolved.user;
    await saveGoogleProfile(user, identity, { mapped: resolved.mapped })
      .catch((error) => console.warn("Google member profile write unavailable", error));
    setStatus(resolved.mapped ? "Google 已連到原本的會員帳號。" : "Google 登入成功，正在載入會員資料…", "success");
    clearPendingTarget();
    window.dispatchEvent(new CustomEvent("77waxing:google-login-complete", { detail: { user, mapped: resolved.mapped } }));
    if (target && target !== location.href) {
      location.assign(target);
      return;
    }
    setTimeout(() => location.reload(), 160);
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
