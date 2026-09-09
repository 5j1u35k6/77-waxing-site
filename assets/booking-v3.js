import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDocsFromServer, getFirestore, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";
import { loadCatalog, publicCatalog } from "./service-catalog-store.js";

const REPO_BASE = "/77-waxing-site";
const B = location.hostname.endsWith("github.io") ? REPO_BASE : "";
const TIMES = [];
for (let minutes = 600; minutes <= 1200; minutes += 30) TIMES.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const pad = (value) => String(value).padStart(2, "0");
const parseDate = (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); };
const formatDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const addDays = (value, amount) => { const date = parseDate(value); date.setUTCDate(date.getUTCDate() + amount); return formatDate(date); };
const monthStart = (value) => `${value.slice(0, 7)}-01`;
const moveMonth = (value, amount) => { const date = parseDate(monthStart(value)); date.setUTCMonth(date.getUTCMonth() + amount); return formatDate(date); };
const monthLabel = (value) => { const date = parseDate(value); return `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月`; };
const shortDate = (value) => { const date = parseDate(value); return { weekday: `週${"日一二三四五六"[date.getUTCDay()]}`, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}` }; };
const calendarCells = (value) => {
  const first = parseDate(monthStart(value));
  const start = first.getUTCDay();
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
  const count = Math.round((next.getTime() - first.getTime()) / 86_400_000);
  const cells = Array(start).fill(null);
  for (let day = 1; day <= count; day += 1) cells.push(`${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
};
const taipeiToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const addMinutesToTime = (time, minutesToAdd) => { const [hours, minutes] = time.split(":").map(Number); const total = hours * 60 + minutes + minutesToAdd; return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`; };
const blockTimes = (time, blockMinutes) => { const [hours, minutes] = time.split(":").map(Number); const start = hours * 60 + minutes; return Array.from({ length: blockMinutes / 30 }, (_, index) => { const point = start + index * 30; return `${pad(Math.floor(point / 60) % 24)}:${pad(point % 60)}`; }); };
const lockId = (date, time) => `${date}_${time.replace(":", "")}`;
const blockMinutesFor = (durationMinutes) => (Math.floor(Number(durationMinutes || 90) / 30) + 1) * 30;

let app = null;
let auth = null;
let db = null;
if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

async function ensureSignedIn() {
  if (!auth) throw new Error("FIREBASE_NOT_READY");
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function dynamicCatalog() {
  const source = publicCatalog(await loadCatalog());
  const catalog = source.map((category) => ({
    ...category,
    groups: category.groups.map((group) => ({
      ...group,
      items: group.items.map((entry) => ({
        ...entry,
        durationMinutes: Math.max(1, Math.min(180, Number(entry.durationMinutes || 90))),
        durationLabel: entry.durationLabel || `約 ${Number(entry.durationMinutes || 90)} 分鐘`,
        blockMinutes: blockMinutesFor(entry.durationMinutes),
      })),
    })),
  }));
  window.__77_SERVICE_CATALOG__ = catalog;
  window.dispatchEvent(new CustomEvent("77waxing:catalog-ready", { detail: catalog }));
  return catalog;
}

async function loadLocks(anchorDate) {
  await ensureSignedIn();
  const earliestDate = addDays(taipeiToday(), 1);
  const naturalStart = addDays(anchorDate, -3);
  const startDate = naturalStart < earliestDate ? earliestDate : naturalStart;
  const endDate = addDays(startDate, 6);
  const windowDates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
  const locksByDate = new Map();
  const snapshot = await getDocsFromServer(query(collection(db, "availabilityLocks"), where("date", ">=", startDate), where("date", "<=", endDate)));
  snapshot.forEach((snapshotDoc) => {
    const value = snapshotDoc.data();
    const date = String(value.date || "");
    const time = String(value.time || "").slice(0, 5);
    if (!date || !/^\d{2}:\d{2}$/.test(time)) return;
    const day = locksByDate.get(date) || new Map();
    day.set(time, value.state === "confirmed" ? "hidden" : "held");
    locksByDate.set(date, day);
  });
  return { startDate, endDate, windowDates, locksByDate };
}

function slotState(locksByDate, date, time, blockMinutes) {
  const day = locksByDate.get(date) || new Map();
  const states = blockTimes(time, blockMinutes).map((blockedTime) => day.get(blockedTime)).filter(Boolean);
  if (states.includes("hidden")) return "hidden";
  if (states.includes("held")) return "held";
  return "available";
}

function bookingMarkup(catalog) {
  if (!catalog.length) return `<div class="notice"><b>目前沒有開放中的服務</b><p>請稍後再回來查看，或直接聯絡 77waxing。</p></div>`;
  return `<div class="steps"><span class="on">1 服務</span><span>2 日期時段</span><span>3 資料</span><span>4 確認</span></div>
    <section class="step on" data-step="1"><h2>選擇服務項目</h2><p class="muted booking-prefill-note" data-booking-prefill-note hidden></p><div class="booking-service-picker"><aside class="booking-service-categories" aria-label="服務分類">${catalog.map((category, index) => `<button type="button" data-booking-category="${esc(category.key)}" class="${index === 0 ? "on" : ""}">${esc(category.name)}</button>`).join("")}</aside><div class="booking-service-items" data-booking-items></div></div><div class="booking-service-note muted" data-booking-service-note></div><div class="actions"><button class="btn dark" type="button" data-next disabled>下一步</button></div></section>
    <section class="step" data-step="2"><h2>先從月曆選基準日期，再比較固定 7 天</h2><p class="muted">月曆選定後，下面 7 天會鎖定。要更換這組日期，請回月曆重新選基準日期。</p><div class="flight-calendar"><div class="calbar"><button type="button" data-month-prev>←</button><b data-month-label></b><button type="button" data-month-next>→</button></div><div class="calweek">${"日一二三四五六".split("").map((weekday) => `<span>${weekday}</span>`).join("")}</div><div class="calgrid" data-calgrid></div></div><div class="slotlegend"><span><i class="free"></i>可選</span><span><i class="hold"></i>其他顧客預約中</span><span><i class="pick"></i>你的選擇</span></div><div class="booking-sync" data-booking-sync>正在確認可預約時段…</div><div class="dayrail" data-dayrail></div><div class="notice"><b>時段保留方式</b><p data-booking-block-note></p></div><div class="actions"><button class="btn" type="button" data-prev>上一步</button><button class="btn dark" type="button" data-next>下一步</button></div></section>
    <section class="step" data-step="3"><h2>留下聯絡方式</h2><p class="muted">不用建立會員帳號，填寫資料後即可送出預約需求。</p><div class="fields"><label>姓名<input name="name" autocomplete="name"></label><label>手機<input name="phone" inputmode="tel" autocomplete="tel"></label><label>Email<input name="email" type="email" autocomplete="email" placeholder="用於接收預約確認信"></label><label>LINE ID<input name="line"></label><label>第一次來店？<select name="first"><option value="yes">是</option><option value="no">曾經來過</option></select></label></div><label class="full">備註<textarea name="note" rows="3"></textarea></label><p><label><input style="width:auto" type="checkbox" name="ok"> 同意 77美學工作室為處理本次預約使用我填寫的聯絡資料。</label></p><div class="actions"><button class="btn" type="button" data-prev>上一步</button><button class="btn dark" type="button" data-next>確認內容</button></div></section>
    <section class="step" data-step="4"><h2>確認預約需求</h2><div class="summary"></div><div class="notice"><b>送出後先保留</b><p>成功送出後，對應時段會先變成「保留中」，等待 77 後台確認。</p></div><div class="actions"><button class="btn" type="button" data-prev>上一步</button><button class="btn dark" type="button" data-submit>送出預約需求</button></div></section>
    <section class="success"><h2>預約需求已建立</h2><p>預約需求已送出，該時段已暫時保留，等待 77 確認。</p><div class="btns" style="justify-content:center"><a class="btn" href="${B}/booking/">回到預約頁面</a></div></section>`;
}

function currentBookingRoot() {
  const path = location.pathname.startsWith(REPO_BASE) ? location.pathname.slice(REPO_BASE.length) : location.pathname;
  if (!(path === "/booking" || path === "/booking/")) return null;
  return document.querySelector("#booking");
}

function mainItems(category) {
  return category.groups.filter((group) => group.kind !== "addon").flatMap((group) => group.items);
}

async function mount(root) {
  if (!root || root.dataset.bookingV3Mounted === "1" || !firebaseConfigured) return;
  let catalog;
  try {
    catalog = await dynamicCatalog();
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="notice"><b>服務資料載入失敗</b><p>請重新整理頁面後再試。</p></div>`;
    document.body.classList.remove("booking-boot");
    return;
  }
  root.dataset.bookingV3Mounted = "1";
  root.innerHTML = bookingMarkup(catalog);
  if (!catalog.length) { document.body.classList.remove("booking-boot"); return; }

  const earliestDate = addDays(taipeiToday(), 1);
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const requestedCategoryKey = search.get("category") || hash.get("category") || "";
  const requestedItemName = search.get("item") || hash.get("item") || "";

  let step = 1;
  let selectedCategory = catalog.find((category) => category.key === requestedCategoryKey) || catalog[0];
  let selectedItem = mainItems(selectedCategory).find((entry) => entry.name === requestedItemName) || null;
  let anchorDate = earliestDate;
  let selectedDate = earliestDate;
  let selectedTime = "";
  let calendarMonth = monthStart(earliestDate);
  let availability = { windowDates: [], locksByDate: new Map() };
  const nextButton = root.querySelector('[data-step="1"] [data-next]');
  const prefillNote = root.querySelector('[data-booking-prefill-note]');

  const syncPrefillNote = () => {
    if (!prefillNote) return;
    if (selectedItem && requestedCategoryKey && requestedItemName) {
      prefillNote.hidden = false;
      prefillNote.textContent = `已從價目表帶入：${selectedCategory.name}｜${selectedItem.name}`;
    } else {
      prefillNote.hidden = true;
      prefillNote.textContent = "";
    }
  };

  const drawItems = () => {
    const target = root.querySelector("[data-booking-items]");
    const groups = selectedCategory.groups.filter((group) => group.kind !== "addon" && group.items.length);
    target.innerHTML = groups.length ? groups.map((group) => `<section class="booking-item-group" data-booking-group="${esc(group.id)}"><h3>${esc(group.title)}</h3><div>${group.items.map((serviceItem) => `<button type="button" class="booking-item ${selectedItem?.id === serviceItem.id ? "on" : ""}" data-booking-item="${esc(serviceItem.id)}"><span><b>${esc(serviceItem.name)}</b><small>施作時間｜${esc(serviceItem.durationLabel)}</small>${serviceItem.priceLabel ? `<strong class="booking-live-price">${esc(serviceItem.priceLabel)}</strong>` : ""}</span><em>時段保留 ${serviceItem.blockMinutes} 分鐘</em></button>`).join("")}</div></section>`).join("") : `<div class="notice"><b>目前沒有可預約項目</b><p>請選擇其他服務分類。</p></div>`;
    root.querySelector("[data-booking-service-note]").textContent = "";
    target.querySelectorAll("[data-booking-item]").forEach((button) => {
      button.onclick = () => {
        selectedItem = mainItems(selectedCategory).find((entry) => entry.id === button.dataset.bookingItem) || null;
        selectedTime = "";
        drawItems();
        nextButton.disabled = !selectedItem;
        if (prefillNote) { prefillNote.hidden = true; prefillNote.textContent = ""; }
      };
    });
  };

  root.querySelectorAll("[data-booking-category]").forEach((button) => {
    button.onclick = () => {
      selectedCategory = catalog.find((category) => category.key === button.dataset.bookingCategory) || catalog[0];
      selectedItem = null;
      selectedTime = "";
      root.querySelectorAll("[data-booking-category]").forEach((entry) => entry.classList.toggle("on", entry === button));
      nextButton.disabled = true;
      if (prefillNote) { prefillNote.hidden = true; prefillNote.textContent = ""; }
      window.dispatchEvent(new CustomEvent("77waxing:booking-category", { detail: selectedCategory }));
      drawItems();
    };
  });

  const show = (nextStep) => {
    step = nextStep;
    root.querySelectorAll(".step").forEach((element) => element.classList.toggle("on", Number(element.dataset.step) === nextStep));
    root.querySelectorAll(".steps span").forEach((element, index) => element.classList.toggle("on", index === nextStep - 1));
    if (nextStep === 2 && selectedItem) {
      const cleanup = selectedItem.blockMinutes - selectedItem.durationMinutes;
      root.querySelector("[data-booking-block-note]").textContent = `${selectedItem.durationLabel}施作結束後，結束邊界的半小時時段也會保留給環境整理與顧客善後。本項目共保留 ${selectedItem.blockMinutes} 分鐘${cleanup > 0 ? `（比施作時間多保留約 ${cleanup} 分鐘）` : ""}。`;
      refreshAvailability();
    }
  };

  const drawCalendar = () => {
    root.querySelector("[data-month-label]").textContent = monthLabel(calendarMonth);
    root.querySelector("[data-calgrid]").innerHTML = calendarCells(calendarMonth).map((date) => {
      if (!date) return "<span></span>";
      const disabled = date < earliestDate;
      return `<button type="button" ${disabled ? "disabled" : ""} class="calday ${date === anchorDate ? "on" : ""} ${date === taipeiToday() ? "today" : ""}" data-anchor-date="${date}">${parseDate(date).getUTCDate()}</button>`;
    }).join("");
    root.querySelectorAll("[data-anchor-date]").forEach((button) => {
      button.onclick = async () => { anchorDate = button.dataset.anchorDate; selectedDate = anchorDate; selectedTime = ""; calendarMonth = monthStart(anchorDate); await refreshAvailability(); };
    });
  };

  const drawRail = () => {
    const rail = root.querySelector("[data-dayrail]");
    if (!selectedItem) return;
    rail.innerHTML = availability.windowDates.map((date) => {
      const label = shortDate(date);
      const slots = TIMES.map((time) => ({ time, state: slotState(availability.locksByDate, date, time, selectedItem.blockMinutes) })).filter((slot) => slot.state !== "hidden");
      return `<article class="daycol ${date === selectedDate ? "on" : ""}"><button type="button" class="dayhead" data-visible-date="${date}"><small>${label.weekday}</small><b>${label.label}</b>${date === anchorDate ? "<em>基準日</em>" : ""}</button><div class="times">${slots.map((slot) => `<button type="button" class="slot ${slot.state === "held" ? "held" : ""} ${selectedDate === date && selectedTime === slot.time ? "pick" : ""}" data-slot-date="${date}" data-slot-time="${slot.time}" ${slot.state === "held" ? "disabled" : ""}><b>${slot.time}</b>${slot.state === "held" ? "<small>保留中</small>" : ""}</button>`).join("")}</div></article>`;
    }).join("");
    rail.querySelectorAll("[data-visible-date]").forEach((button) => button.onclick = () => { selectedDate = button.dataset.visibleDate; selectedTime = ""; drawRail(); });
    rail.querySelectorAll("[data-slot-time]").forEach((button) => button.onclick = () => { selectedDate = button.dataset.slotDate; selectedTime = button.dataset.slotTime; drawRail(); });
  };

  async function refreshAvailability() {
    if (!selectedItem) return;
    const sync = root.querySelector("[data-booking-sync]");
    sync.textContent = "正在確認可預約時段…";
    sync.classList.add("loading");
    try {
      availability = await loadLocks(anchorDate);
      drawCalendar();
      drawRail();
      sync.textContent = `可選日期範圍：${shortDate(availability.windowDates[0]).label} ～ ${shortDate(availability.windowDates[6]).label}`;
    } catch (error) {
      console.error(error);
      sync.textContent = "目前無法取得可預約時段，請稍後再試。";
    } finally {
      sync.classList.remove("loading");
    }
  }

  root.querySelector("[data-month-prev]").onclick = () => { calendarMonth = moveMonth(calendarMonth, -1); drawCalendar(); };
  root.querySelector("[data-month-next]").onclick = () => { calendarMonth = moveMonth(calendarMonth, 1); drawCalendar(); };

  root.querySelectorAll("[data-next]").forEach((button) => {
    button.onclick = () => {
      if (step === 1 && !selectedItem) return;
      if (step === 2 && (!selectedDate || !selectedTime)) return alert("請選擇日期與時段。");
      if (step === 3) {
        const name = root.querySelector('[name="name"]').value.trim();
        const phone = root.querySelector('[name="phone"]').value.trim();
        const email = root.querySelector('[name="email"]').value.trim();
        const accepted = root.querySelector('[name="ok"]').checked;
        if (!name || !phone || !email || !accepted) return alert("請填寫姓名、手機、Email 並勾選同意。");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("請確認 Email 格式。");
        const endTime = addMinutesToTime(selectedTime, selectedItem.durationMinutes);
        const summary = { 服務分類: selectedCategory.name, 服務項目: selectedItem.name, 施作時間: selectedItem.durationLabel, 日期: selectedDate, 開始時間: selectedTime, 結束時間: `${endTime}（${selectedItem.durationLabel}）`, 姓名: name, 手機: phone, Email: email, 來店: root.querySelector('[name="first"]').value === "yes" ? "第一次" : "回訪" };
        root.querySelector(".summary").innerHTML = Object.entries(summary).map(([key, value]) => `<div><small>${esc(key)}</small><b>${esc(value)}</b></div>`).join("");
      }
      show(Math.min(4, step + 1));
    };
  });
  root.querySelectorAll("[data-prev]").forEach((button) => button.onclick = () => show(Math.max(1, step - 1)));

  root.querySelector("[data-submit]").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "送出中…";
    try {
      const user = await ensureSignedIn();
      const name = root.querySelector('[name="name"]').value.trim();
      const phone = root.querySelector('[name="phone"]').value.replace(/[\s()-]/g, "").trim();
      const email = root.querySelector('[name="email"]').value.trim().toLowerCase();
      const lineId = root.querySelector('[name="line"]').value.trim();
      const note = root.querySelector('[name="note"]').value.trim();
      const firstVisit = root.querySelector('[name="first"]').value === "yes";
      const lockTimes = blockTimes(selectedTime, selectedItem.blockMinutes);
      const lockIds = lockTimes.map((time) => lockId(selectedDate, time));
      const bookingRef = doc(collection(db, "bookings"));
      const lockRefs = lockIds.map((id) => doc(db, "availabilityLocks", id));
      await runTransaction(db, async (transaction) => {
        for (const lockRef of lockRefs) { const snapshot = await transaction.get(lockRef); if (snapshot.exists()) throw new Error("SLOT_CONFLICT"); }
        transaction.set(bookingRef, { ownerUid: user.uid, customerName: name, customerPhone: phone, customerEmail: email, customerLineId: lineId || null, serviceName: `${selectedCategory.name}｜${selectedItem.name}`, preferredDate: selectedDate, preferredTime: selectedTime, status: "pending_confirmation", isFirstVisit: firstVisit, depositRequired: null, depositAmount: null, paymentStatus: "not_requested", durationMinutes: selectedItem.durationMinutes, bufferMinutes: selectedItem.blockMinutes - selectedItem.durationMinutes, lockIds, lockTimes, note: note || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        lockRefs.forEach((lockRef, index) => transaction.set(lockRef, { bookingId: bookingRef.id, date: selectedDate, time: lockTimes[index], state: "held", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
      });
      root.querySelectorAll(".step").forEach((element) => element.classList.remove("on"));
      root.querySelector(".steps").style.display = "none";
      root.querySelector(".success").classList.add("on");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "SLOT_CONFLICT") {
        alert("這個時段剛被其他預約保留，請重新選擇。");
        selectedTime = "";
        show(2);
        await refreshAvailability();
      } else alert("預約送出失敗，請稍後再試。");
    } finally {
      button.disabled = false;
      button.textContent = "送出預約需求";
    }
  };

  root.querySelectorAll("[data-booking-category]").forEach((button) => button.classList.toggle("on", button.dataset.bookingCategory === selectedCategory.key));
  drawItems();
  nextButton.disabled = !selectedItem;
  syncPrefillNote();
  drawCalendar();
  window.dispatchEvent(new CustomEvent("77waxing:booking-category", { detail: selectedCategory }));
}

function tryMount() {
  const root = currentBookingRoot();
  if (!root) return;
  if (root.dataset.firebaseMounted !== "1" || root.querySelector("[data-booking-sync].loading")) { setTimeout(tryMount, 60); return; }
  mount(root);
}

const appRoot = document.querySelector("#app");
if (appRoot) new MutationObserver(() => queueMicrotask(tryMount)).observe(appRoot, { childList: true, subtree: true });
window.addEventListener("popstate", () => setTimeout(tryMount, 0));
setTimeout(tryMount, 0);
