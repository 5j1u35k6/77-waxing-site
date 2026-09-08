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

function readableAuthError(error) {
  const code = String(error?.code || "");
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) {
    return "Firebase Authentication 找不到這組 Email／密碼。請確認你使用的是 Firebase → Authentication → Users 裡建立的管理員帳號；舊 Netlify 的 ADMIN_PASSWORD 不會自動沿用。";
  }
  if (code === "auth/operation-not-allowed") {
    return "Firebase 的 Email/Password 登入尚未啟用，請到 Authentication → Sign-in method 開啟。";
  }
  if (code === "auth/too-many-requests") {
    return "登入嘗試次數過多，Firebase 暫時限制登入。請稍後再試。";
  }
  return `登入失敗（${code || "unknown"}）。`;
}

function requestAdminRemount() {
  const root = document.querySelector("#admin-preview");
  if (!root) return;
  delete root.dataset.firebaseMounted;
  window.dispatchEvent(new PopStateEvent("popstate"));
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

onAuthStateChanged(auth, async (user) => {
  if (!(await hasAdminAccess(user))) return;
  const loginForm = document.querySelector("[data-admin-login]");
  if (loginForm) requestAdminRemount();
});

document.addEventListener("submit", async (event) => {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form?.matches("[data-admin-login]")) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const submit = form.querySelector('button[type="submit"]');
  const message = form.querySelector("[data-admin-message]");
  if (!submit || !message) return;

  submit.disabled = true;
  message.textContent = "正在驗證 Firebase Authentication…";

  try {
    await setPersistence(auth, browserLocalPersistence);
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const credential = await signInWithEmailAndPassword(auth, email, password);

    message.textContent = "帳號密碼正確，正在確認後台權限…";

    let adminSnapshot;
    try {
      adminSnapshot = await getDoc(doc(db, "admins", credential.user.uid));
    } catch (error) {
      console.error("Admin permission check failed", error);
      await signOut(auth);
      message.textContent = `帳號密碼正確，但尚未取得後台權限。請確認 Firestore 已建立 admins/${credential.user.uid} 文件，且已發布最新 Rules。`;
      return;
    }

    if (!adminSnapshot.exists()) {
      await signOut(auth);
      message.textContent = `帳號密碼正確，但 Firestore 缺少 admins/${credential.user.uid} 文件。請以這個 UID 建立管理員文件。`;
      return;
    }

    message.textContent = "登入成功，正在開啟管理後台…";
    requestAdminRemount();

    window.setTimeout(() => {
      if (document.querySelector("[data-admin-login]")) requestAdminRemount();
    }, 500);
  } catch (error) {
    console.error("Firebase admin login failed", error);
    message.textContent = readableAuthError(error);
  } finally {
    submit.disabled = false;
  }
}, true);
