import "../assets/member-auth.js?v=20260914-member1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20260913-shop2";

const { auth, db } = getPublicFirebase();
let orderUnsubscribe = null;
let ownOrderLookup = new Map();

function normalizeProductCardActions() {
  document.querySelectorAll(".regional-product-card .product-actions").forEach((actions) => {
    const detail = actions.querySelector("[data-regional-detail]");
    if (!detail) return;

    // Keep the original buy control in the DOM as a hidden sentinel.
    // regional-store.js watches for data-regional-buy; removing it causes the
    // legacy card renderer to rebuild the card repeatedly and can make the
    // visible detail button appear unresponsive.
    const buyButtons = actions.querySelectorAll("[data-regional-buy]");
    buyButtons.forEach((button) => {
      button.hidden = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      button.classList.add("card-format-buy-sentinel");
    });

    if (detail.textContent.trim() !== "詳情") detail.textContent = "詳情";
    if (detail.classList.contains("secondary-btn")) detail.classList.remove("secondary-btn");
    if (!detail.classList.contains("primary-btn")) detail.classList.add("primary-btn");
    if (!detail.classList.contains("product-detail-only")) detail.classList.add("product-detail-only");
    if (!actions.classList.contains("single-detail-action")) actions.classList.add("single-detail-action");
  });
}

function normalizeMarketBadge() {
  const badge = document.querySelector("#market-badge");
  if (!badge) return;
  const raw = badge.querySelector("b")?.textContent?.trim() || badge.textContent.trim();
  const label = raw.includes("香港") ? "香港" : raw.includes("台灣") ? "台灣" : "";
  if (!label) return;
  if (badge.children.length === 0 && badge.textContent.trim() === label) return;
  badge.textContent = label;
  badge.setAttribute("aria-label", `目前地區：${label}`);
}

function ensureOrderReasonStyle() {
  if (document.querySelector("#order-status-polish-style")) return;
  const style = document.createElement("style");
  style.id = "order-status-polish-style";
  style.textContent = `
    .order-cancel-reason{margin-top:14px;padding:12px 14px;border:1px solid #e6cfc7;border-radius:12px;background:#fff7f4;color:#7b4439;display:grid;gap:4px}
    .order-cancel-reason b{font-size:13px;letter-spacing:.04em}
    .order-cancel-reason span{font-size:14px;line-height:1.6;white-space:pre-wrap}
  `;
  document.head.appendChild(style);
}

function polishOrderCards() {
  ensureOrderReasonStyle();
  const labels = {
    pending: "待接單",
    confirmed: "已接單",
    packing: "處理中",
    ready: "已準備完成・待取貨",
    shipped: "已出貨",
    completed: "已完成",
    cancelled: "已取消",
  };

  document.querySelectorAll("#orders-list .order-card").forEach((card) => {
    const orderNo = card.querySelector(".order-no")?.textContent?.trim() || "";
    const order = ownOrderLookup.get(orderNo);
    if (!order) return;

    const status = card.querySelector(".status");
    if (status && labels[order.status]) status.textContent = labels[order.status];

    let reason = card.querySelector(".order-cancel-reason");
    const reasonText = String(order.cancellationReason || "").trim();
    if (order.status === "cancelled" && reasonText) {
      if (!reason) {
        reason = document.createElement("div");
        reason.className = "order-cancel-reason";
        const title = document.createElement("b");
        title.textContent = "取消原因";
        const body = document.createElement("span");
        reason.append(title, body);
        card.appendChild(reason);
      }
      reason.querySelector("span").textContent = reasonText;
    } else {
      reason?.remove();
    }
  });
}

function apply77selectBranding() {
  document.querySelectorAll(".product-media").forEach((node) => {
    if (node.children.length === 0 && node.textContent.trim() === "77waxing") node.textContent = "77select";
  });

  const heroEyebrow = document.querySelector("#hero-eyebrow");
  if (heroEyebrow && heroEyebrow.textContent.trim() === "77WAXING SELECT") heroEyebrow.textContent = "77SELECT";

  const heroDescription = document.querySelector("#hero-description");
  if (heroDescription?.textContent.includes("77waxing 後台")) {
    heroDescription.textContent = heroDescription.textContent.replace("77waxing 後台", "77select 後台");
  }

  normalizeMarketBadge();
  normalizeProductCardActions();
  polishOrderCards();
}

let scheduled = false;
function scheduleEnhancements() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    apply77selectBranding();
  });
}

onAuthStateChanged(auth, (user) => {
  orderUnsubscribe?.();
  orderUnsubscribe = null;
  ownOrderLookup = new Map();
  if (!user) return scheduleEnhancements();
  orderUnsubscribe = onSnapshot(
    query(collection(db, "shopOrders"), where("ownerUid", "==", user.uid)),
    (snap) => {
      ownOrderLookup = new Map();
      snap.docs.forEach((row) => {
        const data = { id: row.id, ...row.data() };
        ownOrderLookup.set(String(data.orderNo || data.id), data);
      });
      scheduleEnhancements();
    },
    (error) => console.warn("77select order status polish unavailable", error),
  );
});

const observer = new MutationObserver(scheduleEnhancements);
observer.observe(document.documentElement, { childList: true, subtree: true });
apply77selectBranding();
