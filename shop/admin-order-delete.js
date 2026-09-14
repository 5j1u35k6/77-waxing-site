import { getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_APP_NAME = "77waxing-shop-admin";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let ordersByDisplayKey = new Map();
let injectScheduled = false;

async function waitForAdminApp() {
  for (let i = 0; i < 160; i += 1) {
    const app = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME);
    if (app) return app;
    await sleep(50);
  }
  throw new Error("77select admin Firebase app did not initialize in time.");
}

function flash(message, type = "ok") {
  const el = $("#admin-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = type === "error" ? "#a64b43" : "#55745b";
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { el.textContent = ""; }, 4200);
}

function scheduleInject() {
  if (injectScheduled) return;
  injectScheduled = true;
  requestAnimationFrame(() => {
    injectScheduled = false;
    injectDeleteButtons();
  });
}

function injectDeleteButtons() {
  $$("#orders-table .admin-table tbody tr").forEach((row) => {
    const displayKey = $("td:first-child b", row)?.textContent?.trim();
    if (!displayKey) return;
    const order = ordersByDisplayKey.get(displayKey);
    if (!order) return;

    const actionCell = row.querySelector("td:last-child");
    if (!actionCell) return;
    let actions = actionCell.querySelector(".admin-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "admin-actions";
      actionCell.appendChild(actions);
    }
    if ([...actions.querySelectorAll("[data-delete-order]")].some((button) => button.dataset.deleteOrder === order.id)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-btn";
    button.dataset.deleteOrder = order.id;
    button.textContent = "刪除";
    button.setAttribute("aria-label", `永久刪除訂單 ${order.orderNo || order.id}`);
    button.style.borderColor = "rgba(166,75,67,.45)";
    button.style.color = "#a64b43";
    actions.appendChild(button);
  });
}

async function audit(db, auth, order) {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, "shopAuditLogs"), {
    adminUid: user.uid,
    adminEmail: user.email || null,
    action: "order_delete_permanent",
    targetId: order.id,
    detail: JSON.stringify({
      orderNo: order.orderNo || order.id,
      status: order.status || null,
      customerName: order.customerName || null,
      total: Number(order.total || 0),
    }).slice(0, 1000),
    createdAt: serverTimestamp(),
  }).catch(console.warn);
}

const app = await waitForAdminApp();
const auth = getAuth(app);
const db = getFirestore(app);

onSnapshot(collection(db, "shopOrders"), (snap) => {
  const next = new Map();
  snap.docs.forEach((row) => {
    const order = { id: row.id, ...row.data() };
    next.set(String(order.orderNo || order.id), order);
    next.set(String(order.id), order);
  });
  ordersByDisplayKey = next;
  scheduleInject();
}, (error) => console.error("77select order-delete listener failed", error));

document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-delete-order]");
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.disabled) return;

  const orderId = button.dataset.deleteOrder;
  const order = [...ordersByDisplayKey.values()].find((row) => row.id === orderId);
  if (!order) {
    flash("找不到這筆訂單，請重新整理後再試。", "error");
    return;
  }

  const orderNo = order.orderNo || order.id;
  const confirmed = window.confirm(
    `確定要永久刪除訂單 ${orderNo}？\n\n刪除後：\n• 商店後台會立即移除\n• 顧客端「我的訂單」也會同步消失\n• 不會自動回補庫存\n\n若需要回補庫存，請先使用「已取消」流程。`
  );
  if (!confirmed) return;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = "刪除中…";

  try {
    await deleteDoc(doc(db, "shopOrders", order.id));
    await audit(db, auth, order);
    flash(`訂單 ${orderNo} 已永久刪除，顧客端已同步移除。`);
  } catch (error) {
    console.error("77select permanent order delete failed", error);
    flash(error?.message || "刪除訂單失敗。", "error");
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}, true);

new MutationObserver(scheduleInject).observe(document.documentElement, { childList: true, subtree: true });
scheduleInject();
