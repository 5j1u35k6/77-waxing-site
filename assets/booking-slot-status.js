import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const TIMES = [];
for (let minutes = 480; minutes <= 1200; minutes += 30) TIMES.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
let db = null;
let started = false;
let queued = false;
const manualByDate = new Map();
const manualSubs = new Map();

const pad = (value) => String(value).padStart(2, "0");
function blockTimes(time, blockMinutes) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  const start = hours * 60 + minutes;
  return Array.from({ length: Math.max(1, Math.ceil(Number(blockMinutes || 120) / 30)) }, (_, index) => {
    const point = start + index * 30;
    return `${pad(Math.floor(point / 60) % 24)}:${pad(point % 60)}`;
  });
}
function selectedBlockMinutes() {
  const active = document.querySelector("#booking .booking-item.on[data-booking-item]");
  const id = active?.dataset.bookingItem || "";
  const catalog = Array.isArray(window.__77_SERVICE_CATALOG__) ? window.__77_SERVICE_CATALOG__ : [];
  for (const category of catalog) {
    for (const group of category.groups || []) {
      const item = (group.items || []).find((entry) => entry.id === id);
      if (item) return Number(item.blockMinutes || ((Math.floor(Number(item.durationMinutes || 90) / 30) + 1) * 30));
    }
  }
  return 120;
}
function visibleDates() {
  return [...document.querySelectorAll("#booking [data-dayrail] .dayhead[data-visible-date]")].map((node) => node.dataset.visibleDate).filter(Boolean);
}
function syncSubscriptions() {
  if (!db) return;
  const dates = new Set(visibleDates());
  [...manualSubs.entries()].forEach(([date, unsubscribe]) => {
    if (dates.has(date)) return;
    unsubscribe();
    manualSubs.delete(date);
    manualByDate.delete(date);
  });
  dates.forEach((date) => {
    if (manualSubs.has(date)) return;
    const unsubscribe = onSnapshot(doc(db, "settings", `availability_${date}`), (snapshot) => {
      const value = snapshot.exists() ? snapshot.data() : {};
      manualByDate.set(date, new Set(Array.isArray(value.blockedTimes) ? value.blockedTimes.map(String) : []));
      schedule();
    }, (error) => console.error("booking manual availability", error));
    manualSubs.set(date, unsubscribe);
  });
}
function overlapsManual(date, time, minutes) {
  const blocked = manualByDate.get(date) || new Set();
  return blockTimes(time, minutes).some((point) => blocked.has(point));
}
function insertBlockedButton(container, date, time) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "slot blocked";
  button.disabled = true;
  button.dataset.slotDate = date;
  button.dataset.slotTime = time;
  button.dataset.slotStatusAdded = "1";
  button.setAttribute("aria-label", `${time} 不可預約`);
  button.innerHTML = `<b>${time}</b>`;
  const next = [...container.querySelectorAll("[data-slot-time]")].find((node) => String(node.dataset.slotTime || "") > time);
  if (next) container.insertBefore(button, next); else container.appendChild(button);
}
function augment() {
  queued = false;
  const root = document.querySelector("#booking");
  const rail = root?.querySelector("[data-dayrail]");
  if (!rail) return;
  syncSubscriptions();
  const blockMinutes = selectedBlockMinutes();
  rail.querySelectorAll(".daycol").forEach((column) => {
    const date = column.querySelector(".dayhead[data-visible-date]")?.dataset.visibleDate || "";
    const container = column.querySelector(".times");
    if (!date || !container) return;
    const existing = new Map([...container.querySelectorAll("[data-slot-time]")].map((button) => [button.dataset.slotTime, button]));
    existing.forEach((button, time) => {
      button.querySelectorAll("small").forEach((node) => node.remove());
      if (button.classList.contains("held")) {
        button.disabled = true;
        button.classList.remove("blocked");
        delete button.dataset.manualBlocked;
        return;
      }
      const manual = overlapsManual(date, time, blockMinutes);
      if (manual) {
        if (button.dataset.manualBlocked !== "1") {
          button.dataset.manualBlocked = "1";
          button.dataset.manualWasDisabled = button.disabled ? "1" : "0";
        }
        button.classList.add("blocked");
        button.classList.remove("pick");
        button.disabled = true;
        button.setAttribute("aria-label", `${time} 不可預約`);
      } else if (button.dataset.manualBlocked === "1") {
        button.classList.remove("blocked");
        button.disabled = button.dataset.manualWasDisabled === "1";
        button.removeAttribute("aria-label");
        delete button.dataset.manualBlocked;
        delete button.dataset.manualWasDisabled;
      }
    });
    TIMES.forEach((time) => {
      if (existing.has(time)) return;
      insertBlockedButton(container, date, time);
    });
  });
}
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(augment);
}
function hasValidPickedSlot() {
  return Boolean(document.querySelector("#booking [data-dayrail] .slot.pick:not(.blocked):not(.held):not(:disabled)"));
}
function returnToSlotStep() {
  const root = document.querySelector("#booking");
  const step4Prev = root?.querySelector('[data-step="4"] [data-prev]');
  const step3Prev = root?.querySelector('[data-step="3"] [data-prev]');
  if (step4Prev) step4Prev.click();
  setTimeout(() => { if (step3Prev) step3Prev.click(); }, 0);
}
function start() {
  if (started) return;
  started = true;
  const appRoot = document.querySelector("#app") || document.body;
  new MutationObserver(schedule).observe(appRoot, { childList: true, subtree: true });
  window.addEventListener("77waxing:catalog-ready", schedule);
  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("#booking [data-booking-item],#booking [data-visible-date],#booking [data-anchor-date],#booking [data-slot-time]");
    if (target) setTimeout(schedule, 0);
    const step2Next = event.target.closest?.('#booking [data-step="2"] [data-next]');
    if (step2Next && !hasValidPickedSlot()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("請重新選擇可預約時段。");
      return;
    }
    const submit = event.target.closest?.("#booking [data-submit]");
    if (submit && !hasValidPickedSlot()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("剛才選擇的時段目前已無法預約，請重新選擇。");
      returnToSlotStep();
    }
  }, true);
  schedule();
}
function boot() {
  if (!getApps().length) return setTimeout(boot, 100);
  const app = getApp();
  db = getFirestore(app);
  const auth = getAuth(app);
  const ready = (user) => { if (user) start(); };
  ready(auth.currentUser);
  onAuthStateChanged(auth, ready);
}
boot();