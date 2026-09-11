import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getFirestore, onSnapshot, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const VERSION = "20260911-0841";
let db = null;
let auth = null;
let bookings = [];
let general = {};
let slotDate = taipeiToday();
let slotLocks = new Map();
let manualTimes = new Set();
let manualMeta = {};
let unsubSlotLocks = null;
let unsubManual = null;
let enhanceQueued = false;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const pad = (value) => String(value).padStart(2, "0");
const normalizePhone = (value) => String(value || "").replace(/[^0-9+]/g, "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const route = () => ((location.hash || "#dashboard").slice(1) || "dashboard");
const adminRoot = () => document.querySelector("body.admin-page #admin-preview");
const workspace = () => adminRoot()?.querySelector(".admin-v2-workspace");

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function addMinutes(time, amount) {
  const [h, m] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = h * 60 + m + Number(amount || 0);
  return `${pad(Math.floor(total / 60) % 24)}:${pad((total % 60 + 60) % 60)}`;
}
function timeRange(row) {
  const start = String(row?.preferredTime || "").slice(0, 5);
  const buffer = Math.max(0, Number(row?.bufferMinutes ?? 30) || 0);
  let duration = Number(row?.actualDurationMinutes ?? row?.durationMinutes ?? 0) || 0;
  const lockTimes = Array.isArray(row?.lockTimes) ? row.lockTimes : [];
  if (!duration && lockTimes.length) duration = Math.max(30, lockTimes.length * 30 - buffer);
  const end = start && duration ? addMinutes(start, duration) : "";
  return end ? `${start}–${end}` : (start || "—");
}
function bookingKey(row) {
  return `${String(row?.preferredDate || "")} ${String(row?.preferredTime || "").slice(0, 5)}`;
}
function customerIdentity(row) {
  const phone = normalizePhone(row?.customerPhone);
  if (phone) return `p:${phone}`;
  const email = normalizeEmail(row?.customerEmail);
  if (email) return `e:${email}`;
  return `n:${String(row?.customerName || "").trim().toLowerCase()}`;
}
function sameCustomer(a, b) {
  const aPhone = normalizePhone(a?.customerPhone), bPhone = normalizePhone(b?.customerPhone);
  if (aPhone && bPhone) return aPhone === bPhone;
  const aEmail = normalizeEmail(a?.customerEmail), bEmail = normalizeEmail(b?.customerEmail);
  if (aEmail && bEmail) return aEmail === bEmail;
  return customerIdentity(a) === customerIdentity(b);
}
function genderText(row) {
  const raw = String(row?.customerGender || row?.gender || "").trim();
  if (raw) return ({ female: "女性", male: "男性", private: "其他／不透露" }[raw] || raw);
  const match = String(row?.note || "").match(/\[性別\]\s*([^\n\r]+)/);
  return match?.[1]?.trim() || "—";
}
function statusText(status) {
  return ({ pending_confirmation: "待確認", pending_payment: "待付款", confirmed: "已確認", cancelled: "已取消", completed: "已完成", no_show: "未到店" }[status] || status || "—");
}
function latestValue(rows, getter) {
  for (const row of [...rows].sort((a, b) => bookingKey(b).localeCompare(bookingKey(a)))) {
    const value = getter(row);
    if (String(value ?? "").trim()) return value;
  }
  return "";
}

function matchBooking(tr) {
  const directId = tr.dataset.bookingRecordId || tr.querySelector("[data-id]")?.dataset.id || tr.querySelector("[data-admin-delete-booking]")?.dataset.adminDeleteBooking || tr.querySelector("[data-admin-critical-delete]")?.dataset.adminCriticalDelete || "";
  if (directId) {
    const direct = bookings.find((row) => row.id === directId);
    if (direct) return direct;
  }
  const cells = tr.querySelectorAll("td");
  if (cells.length < 6) return null;
  const date = cells[0]?.textContent.trim() || "";
  const start = (cells[1]?.dataset.originalStart || cells[1]?.textContent.match(/\d{2}:\d{2}/)?.[0] || "").slice(0, 5);
  const name = cells[2]?.textContent.trim() || "";
  const phone = normalizePhone(cells[3]?.textContent || "");
  return bookings.find((row) => String(row.preferredDate || "") === date && String(row.preferredTime || "").slice(0, 5) === start && String(row.customerName || "").trim() === name && (!phone || normalizePhone(row.customerPhone) === phone)) || null;
}

function ensureCustomerModal() {
  let modal = document.querySelector("[data-admin-customer-modal]");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "admin-customer-modal";
  modal.dataset.adminCustomerModal = "1";
  modal.hidden = true;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest?.("[data-customer-close]")) closeCustomerModal();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) closeCustomerModal(); });
  return modal;
}
function closeCustomerModal() {
  const modal = document.querySelector("[data-admin-customer-modal]");
  if (!modal) return;
  modal.hidden = true;
  modal.innerHTML = "";
}
function openCustomerModal(bookingId) {
  const selected = bookings.find((row) => row.id === bookingId);
  if (!selected) return;
  const related = bookings.filter((row) => sameCustomer(row, selected));
  const phone = selected.customerPhone || latestValue(related, (row) => row.customerPhone) || "—";
  const email = selected.customerEmail || latestValue(related, (row) => row.customerEmail) || "—";
  const lineId = selected.customerLineId || latestValue(related, (row) => row.customerLineId) || "—";
  const gender = genderText(selected) !== "—" ? genderText(selected) : (latestValue(related, (row) => genderText(row) === "—" ? "" : genderText(row)) || "—");
  const cutoff = bookingKey(selected);
  const history = related.filter((row) => row.id !== selected.id && bookingKey(row) < cutoff).sort((a, b) => bookingKey(b).localeCompare(bookingKey(a)));
  const phoneHtml = phone !== "—" ? `<a href="tel:${esc(String(phone).replace(/[^0-9+]/g, ""))}">${esc(phone)}</a>` : "<b>—</b>";
  const emailHtml = email !== "—" ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "<b>—</b>";
  const modal = ensureCustomerModal();
  modal.innerHTML = `<section class="admin-customer-dialog" role="dialog" aria-modal="true" aria-label="顧客聯絡資訊與過去預約紀錄"><header class="admin-customer-dialog-head"><div><small>CUSTOMER PROFILE</small><h3>${esc(selected.customerName || "未命名")}</h3></div><button type="button" class="admin-customer-close" data-customer-close aria-label="關閉">×</button></header><div class="admin-customer-body"><div class="admin-customer-contact"><article><small>姓名</small><b>${esc(selected.customerName || "—")}</b></article><article><small>電話</small>${phoneHtml}</article><article><small>性別</small><b>${esc(gender)}</b></article><article><small>信箱</small>${emailHtml}</article><article><small>LINE ID</small><b>${esc(lineId)}</b></article></div><section class="admin-customer-history"><h4>過去預約紀錄</h4><div class="admin-customer-history-list">${history.length ? history.map((row) => `<article class="admin-history-row"><time>${esc(row.preferredDate || "—")}</time><strong>${esc(timeRange(row))}</strong><span title="${esc(row.serviceName || "—")}">${esc(row.serviceName || "—")}</span><small>${esc(statusText(row.status))}</small></article>`).join("") : `<div class="admin-history-empty">目前沒有更早的預約紀錄。</div>`}</div></section></div></section>`;
  modal.hidden = false;
  modal.querySelector("[data-customer-close]")?.focus();
}

function enhanceBookingRows() {
  document.querySelectorAll(".admin-table-scroll tbody tr").forEach((tr) => {
    const row = matchBooking(tr);
    if (!row) return;
    tr.dataset.bookingRecordId = row.id;
    const cells = tr.querySelectorAll("td");
    const customerCell = cells[2];
    const customerTypeCell = cells[5];
    if (customerCell && customerCell.dataset.customerQuickId !== row.id) {
      customerCell.dataset.customerQuickId = row.id;
      customerCell.innerHTML = `<button type="button" class="admin-customer-link" data-customer-quick="${esc(row.id)}" aria-label="查看 ${esc(row.customerName || "顧客")} 聯絡資訊與過去預約紀錄">${esc(row.customerName || "未命名")}</button>`;
    }
    if (customerTypeCell) {
      const text = row.isFirstVisit ? "新" : "舊";
      if (customerTypeCell.dataset.customerType !== text) {
        customerTypeCell.dataset.customerType = text;
        customerTypeCell.innerHTML = `<span class="admin-customer-type ${row.isFirstVisit ? "new" : "returning"}" title="${row.isFirstVisit ? "新客" : "舊客"}">${text}</span>`;
      }
    }
  });
}

function serviceLink() {
  return [...document.querySelectorAll(".sidebar a")].find((link) => ["服務管理", "服務功能"].includes((link.textContent || "").trim()));
}
function priceLink() {
  return [...document.querySelectorAll(".sidebar a")].find((link) => ["價格管理", "價格功能"].includes((link.textContent || "").trim()));
}
function syncFunctionLabels() {
  const s = serviceLink();
  const p = priceLink();
  if (s?.dataset.adminV2Bound === "1" && (s.textContent || "").trim() !== "服務功能") s.textContent = "服務功能";
  if (p?.dataset.adminV2Bound === "1" && (p.textContent || "").trim() !== "價格功能") p.textContent = "價格功能";
  document.querySelectorAll(".catalog-admin-head h3,.admin-v2-workspace .admin-view-head h3").forEach((heading) => {
    const text = (heading.textContent || "").trim();
    if (text === "服務管理") heading.textContent = "服務功能";
    if (text === "價格管理") heading.textContent = "價格功能";
  });
  if (s?.dataset.adminV2Bound === "1" && !document.querySelector(".sidebar [data-admin-slot-link]")) {
    const link = document.createElement("a");
    link.href = "#slots";
    link.dataset.adminSlotLink = "1";
    link.textContent = "時段功能";
    s.insertAdjacentElement("afterend", link);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll(".sidebar a").forEach((node) => node.classList.remove("on"));
      link.classList.add("on");
      history.replaceState(null, "", `${location.pathname}#slots`);
      renderSlotView();
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }
}

function timeOptions() {
  const start = general.bookingStartTime || "10:00";
  const end = general.bookingEndTime || "20:00";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const first = Number.isFinite(sh) ? sh * 60 + sm : 600;
  const last = Number.isFinite(eh) ? eh * 60 + em : 1200;
  const list = [];
  for (let mins = first; mins <= last; mins += 30) list.push(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
  return list;
}
function manualDocId(dateValue) { return `availability_${dateValue}`; }
function metaKey(time) { return String(time || "").replace(":", ""); }
function currentReason() {
  const node = workspace();
  return node?.querySelector("[data-slot-reason]")?.value || "其他行程";
}
function currentNote() {
  const node = workspace();
  return node?.querySelector("[data-slot-note]")?.value.trim() || "";
}
function isManual(time) { return manualTimes.has(time); }
function lockAt(time) { return slotLocks.get(time) || null; }

function showSlotWorkspace() {
  const root = adminRoot();
  const dash = root?.querySelector(".dash");
  const node = workspace();
  if (!dash || !node) return null;
  dash.querySelector(".metrics")?.setAttribute("hidden", "");
  [...dash.querySelectorAll(".panel")].forEach((panel) => { if (panel !== node) panel.hidden = true; });
  const overview = dash.querySelector("[data-dashboard-v3]");
  if (overview) overview.hidden = true;
  node.hidden = false;
  node.dataset.catalogOwned = "";
  return node;
}
function renderSlotGrid() {
  if (route() !== "slots") return;
  const node = workspace();
  if (!node) return;
  const grid = node.querySelector("[data-slot-grid]");
  if (!grid) return;
  grid.innerHTML = timeOptions().map((time) => {
    const lock = lockAt(time);
    if (lock) {
      const held = lock.state === "held";
      return `<button type="button" class="admin-slot-button ${held ? "held" : "booked"}" disabled><b>${time}</b><small>${held ? "顧客保留" : "已預約"}</small></button>`;
    }
    if (isManual(time)) {
      const meta = manualMeta[metaKey(time)] || {};
      return `<button type="button" class="admin-slot-button manual" data-slot-toggle="${time}" title="點一下恢復開放"><b>${time}</b><small>${esc(meta.reason || "店家保留")}</small></button>`;
    }
    return `<button type="button" class="admin-slot-button" data-slot-toggle="${time}" title="點一下設為不可預約"><b>${time}</b><small>可預約</small></button>`;
  }).join("");
  grid.querySelectorAll("[data-slot-toggle]").forEach((button) => {
    button.onclick = async () => {
      const time = button.dataset.slotToggle;
      button.disabled = true;
      try {
        const next = new Set(manualTimes);
        const nextMeta = { ...manualMeta };
        if (next.has(time)) {
          next.delete(time);
          delete nextMeta[metaKey(time)];
        } else if (!lockAt(time)) {
          next.add(time);
          nextMeta[metaKey(time)] = { reason: currentReason(), note: currentNote() };
        }
        await saveManualState(next, nextMeta);
      } catch (error) {
        console.error("slot toggle failed", error);
        alert("時段更新失敗，請稍後再試。");
      } finally {
        button.disabled = false;
      }
    };
  });
}
async function saveManualState(nextTimes, nextMeta) {
  await setDoc(doc(db, "settings", manualDocId(slotDate)), {
    kind: "availability_override",
    date: slotDate,
    blockedTimes: [...nextTimes].sort(),
    blockMeta: nextMeta,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
function subscribeSlotDate(dateValue) {
  if (!db) return;
  if (unsubSlotLocks) unsubSlotLocks();
  if (unsubManual) unsubManual();
  slotLocks = new Map();
  manualTimes = new Set();
  manualMeta = {};
  unsubSlotLocks = onSnapshot(query(collection(db, "availabilityLocks"), where("date", "==", dateValue)), (snapshot) => {
    slotLocks = new Map();
    snapshot.docs.forEach((snapshotDoc) => {
      const value = snapshotDoc.data() || {};
      const time = String(value.time || "").slice(0, 5);
      if (/^\d{2}:\d{2}$/.test(time)) slotLocks.set(time, value);
    });
    renderSlotGrid();
  }, (error) => console.error("slot locks", error));
  unsubManual = onSnapshot(doc(db, "settings", manualDocId(dateValue)), (snapshot) => {
    const value = snapshot.exists() ? snapshot.data() : {};
    manualTimes = new Set(Array.isArray(value.blockedTimes) ? value.blockedTimes.map(String) : []);
    manualMeta = value.blockMeta && typeof value.blockMeta === "object" ? value.blockMeta : {};
    renderSlotGrid();
  }, (error) => console.error("manual availability", error));
}
function renderSlotView() {
  if (route() !== "slots") return;
  const node = showSlotWorkspace();
  if (!node) return setTimeout(renderSlotView, 80);
  node.innerHTML = `<div class="admin-slot-shell" data-admin-slot-view data-version="${VERSION}"><div class="admin-slot-head"><div><span class="tag">AVAILABILITY</span><h3>時段功能</h3><p class="muted">設定休息、其他行程或私人安排；顧客端會直接顯示為灰色不可選時段。</p></div></div><div class="admin-slot-controls"><label>日期<input type="date" data-slot-date value="${esc(slotDate)}"></label><label>原因<select data-slot-reason><option>其他行程</option><option>休息</option><option>私人行程</option><option>暫停預約</option></select></label><label>備註（只在後台使用）<input type="text" data-slot-note placeholder="可留空"></label></div><div class="admin-slot-actions"><button type="button" class="primary" data-block-day>將當天空白時段全部設為不可預約</button><button type="button" data-open-day>恢復當天店家設定的時段</button></div><div class="admin-slot-legend"><span><i class="free"></i>可預約</span><span><i class="held"></i>顧客暫時保留</span><span><i class="booked"></i>已預約／店家保留</span></div><div class="admin-slot-note" data-slot-message></div><div class="admin-slot-grid" data-slot-grid></div></div>`;
  node.querySelector("[data-slot-date]").onchange = (event) => {
    slotDate = event.target.value || taipeiToday();
    subscribeSlotDate(slotDate);
  };
  node.querySelector("[data-block-day]").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const message = node.querySelector("[data-slot-message]");
    message.textContent = "更新中…";
    try {
      const next = new Set(manualTimes);
      const nextMeta = { ...manualMeta };
      timeOptions().forEach((time) => {
        if (lockAt(time)) return;
        next.add(time);
        nextMeta[metaKey(time)] = { reason: currentReason(), note: currentNote() };
      });
      await saveManualState(next, nextMeta);
      message.textContent = "已將當天空白時段設為不可預約。";
    } catch (error) {
      console.error(error);
      message.textContent = "更新失敗，請稍後再試。";
    } finally { button.disabled = false; }
  };
  node.querySelector("[data-open-day]").onclick = async (event) => {
    const button = event.currentTarget;
    if (!confirm("恢復這一天所有由店家設定的休息／其他行程時段？\n已存在的顧客預約不會受影響。")) return;
    button.disabled = true;
    const message = node.querySelector("[data-slot-message]");
    message.textContent = "更新中…";
    try {
      await saveManualState(new Set(), {});
      message.textContent = "已恢復店家設定的時段；顧客預約仍維持鎖定。";
    } catch (error) {
      console.error(error);
      message.textContent = "更新失敗，請稍後再試。";
    } finally { button.disabled = false; }
  };
  renderSlotGrid();
  subscribeSlotDate(slotDate);
}

function scheduleEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => {
    enhanceQueued = false;
    syncFunctionLabels();
    enhanceBookingRows();
    if (route() === "slots" && !workspace()?.querySelector("[data-admin-slot-view]")) renderSlotView();
  });
}

function startData() {
  if (!db) return;
  onSnapshot(collection(db, "bookings"), (snapshot) => {
    bookings = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
    scheduleEnhance();
  }, (error) => console.error("admin functions bookings", error));
  onSnapshot(doc(db, "settings", "general"), (snapshot) => {
    general = snapshot.exists() ? snapshot.data() : {};
    if (route() === "slots") renderSlotGrid();
  }, (error) => console.error("admin functions settings", error));
}

function init() {
  scheduleEnhance();
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.querySelector("#app") || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-admin-v2-bound"] });
  document.addEventListener("click", (event) => {
    const customerButton = event.target.closest?.("[data-customer-quick]");
    if (customerButton) {
      event.preventDefault();
      event.stopPropagation();
      openCustomerModal(customerButton.dataset.customerQuick);
    }
  }, true);
  addEventListener("hashchange", () => { scheduleEnhance(); if (route() === "slots") setTimeout(renderSlotView, 0); });
  addEventListener("popstate", () => { scheduleEnhance(); if (route() === "slots") setTimeout(renderSlotView, 0); });
  const timer = setInterval(() => {
    if (!getApps().length) return;
    clearInterval(timer);
    db = getFirestore(getApp());
    auth = getAuth(getApp());
    const ready = (user) => {
      if (!user || user.isAnonymous) return;
      if (!bookings.length) startData();
      if (route() === "slots") renderSlotView();
    };
    ready(auth.currentUser);
    onAuthStateChanged(auth, ready);
  }, 100);
  setTimeout(() => clearInterval(timer), 20000);
}

init();