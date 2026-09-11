import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

const REPO_BASE = "/77-waxing-site";
const B = location.hostname.endsWith("github.io") ? REPO_BASE : "";
const statusText = (status) => ({
  pending_confirmation: "待確認",
  pending_payment: "待付款",
  confirmed: "已確認",
  cancelled: "已取消",
  completed: "已完成",
  no_show: "未到店",
}[status] || status);

function normalizeStaticLinks(root = document) {
  if (B) return;
  root.querySelectorAll(`a[href^="${REPO_BASE}"]`).forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    anchor.setAttribute("href", href.slice(REPO_BASE.length) || "/");
  });
}

function replacePreviewBanner(root, text, kind = "info") {
  const parent = root.parentElement;
  const old = parent?.querySelector(":scope > .preview");
  if (old) old.remove();
  const existing = parent?.querySelector(":scope > .firebase-state");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.className = `firebase-state ${kind}`;
  banner.textContent = text;
  parent?.insertBefore(banner, root);
  return banner;
}

function adminLoginMarkup() {
  return `<div class="admin-login-card"><span class="tag">ADMIN LOGIN</span><h2>77 管理後台</h2><p class="muted">請使用管理員帳號登入。</p><form data-admin-login><label>管理員 Email<input type="email" name="email" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label><button class="btn dark" type="submit">登入</button><p class="form-message" data-admin-message></p></form></div>`;
}

function adminShellMarkup() {
  return `<aside class="sidebar"><h2><b>77</b>waxing</h2><a class="on" href="#dashboard">總覽</a><a href="#bookings">預約管理</a><a href="#calendar">預約行事曆</a><a href="#customers">顧客資料</a><a href="#services">服務功能</a><a href="#slots">時段功能</a><a href="#pricing">價格功能</a><a href="#settings">網站設定</a><a class="admin-site-link" href="/77-waxing-site/" data-admin-site-link>← 回到網站</a><button class="btn admin-logout" type="button" data-admin-logout>登出</button></aside><main class="dash"><div class="admin-topline"><div><span class="tag">ADMIN</span><h2>77 管理後台</h2></div><span class="firebase-live">● 即時同步</span></div><div class="metrics" data-metrics></div><div class="panel"><h3>預約與時段狀態</h3><div class="admin-table-scroll"><table><thead><tr><th>日期</th><th>時間</th><th>顧客</th><th>手機</th><th>服務</th><th>客別</th><th>狀態</th><th>操作</th></tr></thead><tbody data-admin-rows></tbody></table></div></div></main>`;
}

async function verifyAdmin(user) {
  if (!user || user.isAnonymous) return false;
  try {
    await getDoc(doc(db, "admins", user.uid));
    return true;
  } catch {
    return false;
  }
}

async function applyBookingAction(bookingId, action) {
  const bookingRef = doc(db, "bookings", bookingId);
  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists()) throw new Error("BOOKING_NOT_FOUND");
    const booking = bookingSnapshot.data();
    const lockIds = Array.isArray(booking.lockIds) ? booking.lockIds : [];
    const lockRefs = lockIds.map((id) => doc(db, "availabilityLocks", id));
    const updates = { updatedAt: serverTimestamp() };
    let releaseLocks = false;
    let confirmLocks = false;

    if (action === "deposit") {
      updates.status = "pending_payment";
      updates.depositRequired = true;
      confirmLocks = true;
    } else if (action === "nodeposit") {
      updates.status = "confirmed";
      updates.depositRequired = false;
      confirmLocks = true;
    } else if (action === "paid") {
      updates.status = "confirmed";
      updates.paymentStatus = "paid";
      confirmLocks = true;
    } else if (action === "cancel") {
      updates.status = "cancelled";
      releaseLocks = true;
    } else if (action === "complete") {
      updates.status = "completed";
      releaseLocks = true;
    } else if (action === "no_show") {
      updates.status = "no_show";
      releaseLocks = true;
    } else {
      throw new Error("UNKNOWN_ACTION");
    }

    transaction.update(bookingRef, updates);
    if (confirmLocks) {
      lockRefs.forEach((lockRef) => transaction.update(lockRef, { state: "confirmed", updatedAt: serverTimestamp() }));
    }
    if (releaseLocks) {
      lockRefs.forEach((lockRef) => transaction.delete(lockRef));
    }
  });
}

function renderAdminRows(root, rows) {
  const active = rows.filter((row) => !["cancelled", "completed", "no_show"].includes(row.status));
  const counts = {
    pending: active.filter((row) => row.status === "pending_confirmation").length,
    payment: active.filter((row) => row.status === "pending_payment").length,
    confirmed: active.filter((row) => row.status === "confirmed").length,
    newCustomers: active.filter((row) => row.isFirstVisit).length,
  };
  root.querySelector("[data-metrics]").innerHTML = `<div class="metric">待確認<b>${counts.pending}</b></div><div class="metric">待付款<b>${counts.payment}</b></div><div class="metric">已確認<b>${counts.confirmed}</b></div><div class="metric">新客<b>${counts.newCustomers}</b></div>`;
  root.querySelector("[data-admin-rows]").innerHTML = rows.map((row) => {
    let actions = "—";
    if (row.status === "pending_confirmation") {
      actions = `<button type="button" data-admin-action="deposit" data-id="${row.id}">確認＋收訂金</button>${row.isFirstVisit ? "" : `<button type="button" data-admin-action="nodeposit" data-id="${row.id}">確認免訂金</button>`}<button type="button" data-admin-action="cancel" data-id="${row.id}">取消</button>`;
    } else if (row.status === "pending_payment") {
      actions = `<button type="button" data-admin-action="paid" data-id="${row.id}">標記已付款</button><button type="button" data-admin-action="cancel" data-id="${row.id}">取消</button>`;
    } else if (row.status === "confirmed") {
      actions = `<button type="button" data-admin-action="complete" data-id="${row.id}">完成</button><button type="button" data-admin-action="no_show" data-id="${row.id}">未到店</button><button type="button" data-admin-action="cancel" data-id="${row.id}">取消</button>`;
    }
    return `<tr><td>${row.preferredDate || "—"}</td><td>${row.preferredTime || "—"}</td><td>${row.customerName || "未命名"}</td><td>${row.customerPhone || "—"}</td><td>${row.serviceName || "—"}</td><td>${row.isFirstVisit ? "新客" : "回訪"}</td><td><span class="status-${row.status}">${statusText(row.status)}</span></td><td class="adminacts">${actions}</td></tr>`;
  }).join("") || '<tr><td colspan="8" class="muted">目前沒有預約資料。</td></tr>';

  root.querySelectorAll("[data-admin-action]").forEach((button) => {
    button.onclick = async () => {
      button.disabled = true;
      try {
        await applyBookingAction(button.dataset.id, button.dataset.adminAction);
      } catch (error) {
        console.error(error);
        alert("更新預約失敗，請稍後再試。");
      } finally {
        button.disabled = false;
      }
    };
  });
}

async function showAdminDashboard(root) {
  root.innerHTML = adminShellMarkup();
  root.querySelector("[data-admin-logout]").onclick = async () => {
    if (adminUnsubscribe) adminUnsubscribe();
    adminUnsubscribe = null;
    await signOut(auth);
    renderAdminLogin(root);
  };
  const bookingsQuery = query(collection(db, "bookings"), orderBy("preferredDate", "asc"), limit(300));
  if (adminUnsubscribe) adminUnsubscribe();
  adminUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
    const rows = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
    rows.sort((a, b) => `${a.preferredDate || ""} ${a.preferredTime || ""}`.localeCompare(`${b.preferredDate || ""} ${b.preferredTime || ""}`));
    renderAdminRows(root, rows);
  }, (error) => {
    console.error(error);
    root.querySelector("[data-admin-rows]").innerHTML = '<tr><td colspan="8" class="muted">無法讀取預約資料，請確認此帳號具有 admins/{uid} 權限。</td></tr>';
  });
}

function renderAdminLogin(root) {
  root.innerHTML = adminLoginMarkup();
  const form = root.querySelector("[data-admin-login]");
  const message = root.querySelector("[data-admin-message]");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = "登入中…";
    try {
      await authPersistenceReady;
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!(await verifyAdmin(credential.user))) {
        await signOut(auth);
        throw new Error("NOT_ADMIN");
      }
      await showAdminDashboard(root);
    } catch (error) {
      console.error(error);
      message.textContent = "登入失敗或此帳號沒有後台權限。";
    } finally {
      submit.disabled = false;
    }
  };
}

async function mountAdmin(root) {
  if (root.dataset.firebaseMounted) return;
  root.dataset.firebaseMounted = "1";
  const oldPreview = root.querySelector(".preview");
  if (oldPreview) oldPreview.remove();
  if (!firebaseConfigured) {
    root.innerHTML = `<main class="dash admin-setup"><span class="tag">FIREBASE SETUP REQUIRED</span><h2>正式後台尚未啟用</h2><p>Firebase Web App 設定尚未完成，請確認 Authentication 與 Firestore 設定。</p></main>`;
    replacePreviewBanner(root, "請先完成 Firebase Web App 設定。", "warning");
    return;
  }

  const currentUser = auth.currentUser;
  if (currentUser && await verifyAdmin(currentUser)) {
    await showAdminDashboard(root);
  } else {
    renderAdminLogin(root);
  }
}

function mountCurrentPage() {
  normalizeStaticLinks(document);
  const admin = document.querySelector("#admin-preview");
  if (admin) mountAdmin(admin);
}

const appRoot = document.querySelector("#app");
if (appRoot) {
  new MutationObserver(() => queueMicrotask(mountCurrentPage)).observe(appRoot, { childList: true, subtree: true });
}
window.addEventListener("popstate", () => setTimeout(mountCurrentPage, 0));
if (auth) onAuthStateChanged(auth, () => setTimeout(mountCurrentPage, 0));
mountCurrentPage();
