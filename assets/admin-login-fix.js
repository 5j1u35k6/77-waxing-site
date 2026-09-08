import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let submitting = false;
let remounting = false;

function readableAuthError(error) {
  const code = String(error?.code || "");
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) return "Email 或密碼不正確，請重新確認後再試。";
  if (code === "auth/operation-not-allowed") return "目前無法登入，請稍後再試。";
  if (code === "auth/too-many-requests") return "登入嘗試次數過多，請稍後再試。";
  return `登入失敗（${code || "unknown"}）。`;
}

async function hasAdminAccess(user) {
  if (!user || user.isAnonymous) return false;
  try {
    const snapshot = await getDoc(doc(db, "admins", user.uid));
    return snapshot.exists();
  } catch (error) {
    console.error("Admin permission check failed", error);
    return false;
  }
}

function remountAdmin() {
  if (remounting) return;
  const root = document.querySelector("#admin-preview");
  if (!root) return;
  remounting = true;
  delete root.dataset.firebaseMounted;
  const url = new URL(window.location.href);
  url.searchParams.delete("admin_session");
  url.hash = "dashboard";
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.setTimeout(() => { remounting = false; }, 400);
}

onAuthStateChanged(auth, async (user) => {
  if (!(await hasAdminAccess(user))) return;
  if (document.querySelector("[data-admin-login]")) remountAdmin();
});

document.addEventListener("submit", async (event) => {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form?.matches("[data-admin-login]")) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (submitting) return;
  submitting = true;

  const submit = form.querySelector('button[type="submit"]');
  const message = form.querySelector("[data-admin-message]");
  if (!submit || !message) {
    submitting = false;
    return;
  }

  submit.disabled = true;
  message.textContent = "正在登入…";

  try {
    await setPersistence(auth, browserLocalPersistence);
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const credential = await signInWithEmailAndPassword(auth, email, password);

    message.textContent = "正在確認管理員權限…";
    if (!(await hasAdminAccess(credential.user))) {
      await signOut(auth);
      message.textContent = "帳號密碼正確，但目前沒有後台權限。";
      return;
    }

    message.textContent = "登入成功，正在開啟管理後台…";
    remountAdmin();
  } catch (error) {
    console.error("Firebase admin login failed", error);
    message.textContent = readableAuthError(error);
  } finally {
    if (!message.textContent.includes("登入成功")) {
      submitting = false;
      submit.disabled = false;
    }
  }
}, true);
