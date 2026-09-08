import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

const REPO_BASE = "/77-waxing-site";
const B = location.hostname.endsWith("github.io") ? REPO_BASE : "";
const SERVICES = ["女性熱蠟", "男士熱蠟", "肌膚管理", "美胸保養"];
const DURATION_MINUTES = 90;
const BUFFER_MINUTES = 30;
const BLOCK_MINUTES = DURATION_MINUTES + BUFFER_MINUTES;
const TIMES = [];
for (let minutes = 600; minutes <= 1200; minutes += 30) {
  TIMES.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
}

let app = null;
let auth = null;
let db = null;
let adminUnsubscribe = null;
let authPersistenceReady = Promise.resolve();

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {});
}

const pad = (value) => String(value).padStart(2, "0");
const parseDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const formatDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const addDays = (value, amount) => {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
};
const taipeiToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const monthStart = (value) => `${value.slice(0, 7)}-01`;
const moveMonth = (value, amount) => {
  const date = parseDate(monthStart(value));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return formatDate(date);
};
const monthLabel = (value) => {
  const date = parseDate(value);
  return `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月`;
};
const shortDate = (value) => {
  const date = parseDate(value);
  return { weekday: `週${"日一二三四五六"[date.getUTCDay()]}`, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}` };
};
const calendarCells = (value) => {
  const first = parseDate(monthStart(value));
  const start = first.getUTCDay();
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
  const count = Math.round((next.getTime() - first.getTime()) / 86_400_000);
  const cells = Array(start).fill(null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(`${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
};
const blockTimes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  const start = hours * 60 + minutes;
  return Array.from({ length: BLOCK_MINUTES / 30 }, (_, index) => {
    const point = start + index * 30;
    return `${pad(Math.floor(point / 60))}:${pad(point % 60)}`;
  });
};
const lockId = (date, time) => `${date}_${time.replace(":", "")}`;
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

function setupRequired(root, area) {
  replacePreviewBanner(
    root,
    `Firebase Web 尚未完成設定：${area}目前暫停正式寫入。完成 Web App 設定與 Firestore Rules 後會直接啟用。`,
    "warning",
  );
  root.querySelectorAll("button").forEach((button) => {
    if (!button.matches("[data-month-prev],[data-month-next],[data-prev]")) button.disabled = true;
  });
}

async function ensureSignedIn() {
  if (!auth) throw new Error("Firebase 尚未設定。");
  await authPersistenceReady;
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function loadLocks(anchorDate) {
  await ensureSignedIn();
  const earliestDate = addDays(taipeiToday(), 1);
  const naturalStart = addDays(anchorDate, -3);
  const startDate = naturalStart < earliestDate ? earliestDate : naturalStart;
  const endDate = addDays(startDate, 6);
  const windowDates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
  const locksByDate = new Map();
  const locksQuery = query(
    collection(db, "availabilityLocks"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  );
  const snapshot = await getDocsFromServer(locksQuery);
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

function slotState(locksByDate, date, time) {
  const day = locksByDate.get(date) || new Map();
  const states = blockTimes(time).map((blockedTime) => day.get(blockedTime)).filter(Boolean);
  if (states.includes("hidden")) return "hidden";
  if (states.includes("held")) return "held";
  return "available";
}

function bookingMarkup() {
  return `<div class="steps"><span class="on">1 服務</span><span>2 日期時段</span><span>3 資料</span><span>4 確認</span></div>
    <section class="step on" data-step="1"><h2>想預約什麼？</h2><p class="muted">目前所有項目先設定 90 分鐘服務時間。</p><div class="choices">${SERVICES.map((service) => `<button class="choice" type="button" data-service="${service}"><b>${service}</b><small>目前預估 90 分鐘</small></button>`).join("")}</div><div class="actions"><button class="btn dark" type="button" data-next disabled>下一步</button></div></section>
    <section class="step" data-step="2"><h2>先從月曆選基準日期，再比較固定 7 天</h2><p class="muted">月曆選定後，下面 7 天會鎖定。要更換這組日期，請回月曆重新選基準日期。</p><div class="flight-calendar"><div class="calbar"><button type="button" data-month-prev>←</button><b data-month-label></b><button type="button" data-month-next>→</button></div><div class="calweek">${"日一二三四五六".split("").map((weekday) => `<span>${weekday}</span>`).join("")}</div><div class="calgrid" data-calgrid></div></div><div class="slotlegend"><span><i class="free"></i>可選</span><span><i class="hold"></i>其他顧客預約中</span><span><i class="pick"></i>你的選擇</span></div><div class="booking-sync" data-booking-sync>正在讀取 Firestore 空檔…</div><div class="dayrail" data-dayrail></div><div class="notice"><b>單一操作者時段</b><p>所有服務共用 77 的同一條時間軸。任何項目只要佔用某段時間，其他項目重疊的開始時間也會同步保留或隱藏。</p></div><div class="actions"><button class="btn" type="button" data-prev>上一步</button><button class="btn dark" type="button" data-next>下一步</button></div></section>
    <section class="step" data-step="3"><h2>留下聯絡方式</h2><p class="muted">不用建立會員帳號；系統會以匿名 Firebase 工作階段安全送出預約。</p><div class="fields"><label>姓名<input name="name" autocomplete="name"></label><label>手機<input name="phone" inputmode="tel" autocomplete="tel"></label><label>LINE ID<input name="line"></label><label>第一次來店？<select name="first"><option value="yes">是</option><option value="no">曾經來過</option></select></label></div><label class="full">備註<textarea name="note" rows="3"></textarea></label><p><label><input style="width:auto" type="checkbox" name="ok"> 同意 77美學工作室為處理本次預約使用我填寫的聯絡資料。</label></p><div class="actions"><button class="btn" type="button" data-prev>上一步</button><button class="btn dark" type="button" data-next>確認內容</button></div></section>
    <section class="step" data-step="4"><h2>確認預約需求</h2><div class="summary"></div><div class="notice"><b>送出後先保留</b><p>成功送出後會立即寫入 Firestore，對應時段同步變成「保留中」，等待 77 後台確認。</p></div><div class="actions"><button class="btn" type="button" data-prev>上一步</button><button class="btn dark" type="button" data-submit>送出預約需求</button></div></section>
    <section class="success"><h2>預約需求已建立</h2><p>資料已寫入 Firestore。後台會使用同一份資料即時顯示這筆待確認預約。</p><div class="btns" style="justify-content:center"><a data-link class="btn" href="${B}/booking/">再看時段</a></div></section>`;
}

async function mountBooking(root) {
  if (root.dataset.firebaseMounted) return;
  root.dataset.firebaseMounted = "1";
  const parentPreview = root.parentElement?.querySelector(":scope > .preview");
  if (parentPreview) parentPreview.remove();
  if (!firebaseConfigured) {
    setupRequired(root, "預約頁");
    return;
  }

  root.innerHTML = bookingMarkup();
  replacePreviewBanner(root, "正式資料模式｜GitHub Pages → Firebase Authentication → Firestore", "ok");

  const earliestDate = addDays(taipeiToday(), 1);
  let step = 1;
  let service = "";
  let anchorDate = earliestDate;
  let selectedDate = earliestDate;
  let selectedTime = "";
  let calendarMonth = monthStart(earliestDate);
  let availability = { windowDates: [], locksByDate: new Map() };

  const show = (nextStep) => {
    step = nextStep;
    root.querySelectorAll(".step").forEach((element) => element.classList.toggle("on", Number(element.dataset.step) === nextStep));
    root.querySelectorAll(".steps span").forEach((element, index) => element.classList.toggle("on", index === nextStep - 1));
    if (nextStep === 2) refreshAvailability();
  };

  const drawCalendar = () => {
    root.querySelector("[data-month-label]").textContent = monthLabel(calendarMonth);
    root.querySelector("[data-calgrid]").innerHTML = calendarCells(calendarMonth).map((date) => {
      if (!date) return "<span></span>";
      const disabled = date < earliestDate;
      return `<button type="button" ${disabled ? "disabled" : ""} class="calday ${date === anchorDate ? "on" : ""} ${date === taipeiToday() ? "today" : ""}" data-anchor-date="${date}">${parseDate(date).getUTCDate()}</button>`;
    }).join("");
    root.querySelectorAll("[data-anchor-date]").forEach((button) => {
      button.onclick = async () => {
        anchorDate = button.dataset.anchorDate;
        selectedDate = anchorDate;
        selectedTime = "";
        calendarMonth = monthStart(anchorDate);
        await refreshAvailability();
      };
    });
  };

  const drawRail = () => {
    const rail = root.querySelector("[data-dayrail]");
    rail.innerHTML = availability.windowDates.map((date) => {
      const label = shortDate(date);
      const slots = TIMES.map((time) => ({ time, state: slotState(availability.locksByDate, date, time) }))
        .filter((slot) => slot.state !== "hidden");
      return `<article class="daycol ${date === selectedDate ? "on" : ""}"><button class="dayhead" type="button" data-window-date="${date}"><small>${label.weekday}</small><b>${label.label}</b>${date === selectedDate ? "<em>目前選擇</em>" : ""}</button><div class="times">${slots.map((slot) => `<button type="button" class="slot ${slot.state === "held" ? "held" : ""} ${date === selectedDate && slot.time === selectedTime ? "pick" : ""}" data-slot-date="${date}" data-slot-time="${slot.time}" ${slot.state === "held" ? "disabled" : ""}><b>${slot.time}</b>${slot.state === "held" ? "<small>保留中</small>" : ""}</button>`).join("")}</div></article>`;
    }).join("");

    rail.querySelectorAll("[data-window-date]").forEach((button) => {
      button.onclick = () => {
        selectedDate = button.dataset.windowDate;
        selectedTime = "";
        drawRail();
      };
    });
    rail.querySelectorAll("[data-slot-time]").forEach((button) => {
      button.onclick = () => {
        selectedDate = button.dataset.slotDate;
        selectedTime = button.dataset.slotTime;
        drawRail();
      };
    });
  };

  async function refreshAvailability() {
    const sync = root.querySelector("[data-booking-sync]");
    sync.textContent = "正在讀取 Firestore 空檔…";
    sync.classList.add("loading");
    try {
      availability = await loadLocks(anchorDate);
      drawCalendar();
      drawRail();
      sync.textContent = `固定日期範圍：${shortDate(availability.windowDates[0]).label} ～ ${shortDate(availability.windowDates[6]).label}`;
    } catch (error) {
      console.error(error);
      sync.textContent = "無法讀取 Firestore。請確認 Firebase Authentication 與 Firestore Rules 已完成設定。";
    } finally {
      sync.classList.remove("loading");
    }
  }

  root.querySelectorAll("[data-service]").forEach((button) => {
    button.onclick = () => {
      service = button.dataset.service;
      root.querySelectorAll("[data-service]").forEach((item) => item.classList.remove("on"));
      button.classList.add("on");
      root.querySelector('[data-step="1"] [data-next]').disabled = false;
    };
  });

  root.querySelector("[data-month-prev]").onclick = () => {
    calendarMonth = moveMonth(calendarMonth, -1);
    drawCalendar();
  };
  root.querySelector("[data-month-next]").onclick = () => {
    calendarMonth = moveMonth(calendarMonth, 1);
    drawCalendar();
  };

  root.querySelectorAll("[data-next]").forEach((button) => {
    button.onclick = () => {
      if (step === 1 && !service) return;
      if (step === 2 && (!selectedDate || !selectedTime)) return alert("請選擇日期與時段。");
      if (step === 3) {
        const name = root.querySelector('[name="name"]').value.trim();
        const phone = root.querySelector('[name="phone"]').value.trim();
        const accepted = root.querySelector('[name="ok"]').checked;
        if (!name || !phone || !accepted) return alert("請填寫姓名、手機並勾選同意。");
        const summary = {
          服務: service,
          日期: selectedDate,
          開始時間: selectedTime,
          預留: "90 分鐘服務＋30 分鐘整理",
          姓名: name,
          手機: phone,
          來店: root.querySelector('[name="first"]').value === "yes" ? "第一次" : "回訪",
        };
        root.querySelector(".summary").innerHTML = Object.entries(summary).map(([key, value]) => `<div><small>${key}</small><b>${value}</b></div>`).join("");
      }
      show(Math.min(4, step + 1));
    };
  });
  root.querySelectorAll("[data-prev]").forEach((button) => {
    button.onclick = () => show(Math.max(1, step - 1));
  });

  root.querySelector("[data-submit]").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "送出中…";
    try {
      const user = await ensureSignedIn();
      const name = root.querySelector('[name="name"]').value.trim();
      const phone = root.querySelector('[name="phone"]').value.replace(/[\s()-]/g, "").trim();
      const lineId = root.querySelector('[name="line"]').value.trim();
      const note = root.querySelector('[name="note"]').value.trim();
      const firstVisit = root.querySelector('[name="first"]').value === "yes";
      const lockTimes = blockTimes(selectedTime);
      const lockIds = lockTimes.map((time) => lockId(selectedDate, time));
      const bookingRef = doc(collection(db, "bookings"));
      const lockRefs = lockIds.map((id) => doc(db, "availabilityLocks", id));

      await runTransaction(db, async (transaction) => {
        for (const lockRef of lockRefs) {
          const snapshot = await transaction.get(lockRef);
          if (snapshot.exists()) throw new Error("SLOT_CONFLICT");
        }
        transaction.set(bookingRef, {
          ownerUid: user.uid,
          customerName: name,
          customerPhone: phone,
          customerLineId: lineId || null,
          serviceName: service,
          preferredDate: selectedDate,
          preferredTime: selectedTime,
          status: "pending_confirmation",
          isFirstVisit: firstVisit,
          depositRequired: null,
          depositAmount: null,
          paymentStatus: "not_requested",
          durationMinutes: DURATION_MINUTES,
          bufferMinutes: BUFFER_MINUTES,
          lockIds,
          lockTimes,
          note: note || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        lockRefs.forEach((lockRef, index) => {
          transaction.set(lockRef, {
            bookingId: bookingRef.id,
            date: selectedDate,
            time: lockTimes[index],
            state: "held",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      });

      root.querySelectorAll(".step").forEach((element) => element.classList.remove("on"));
      root.querySelector(".steps").style.display = "none";
      root.querySelector(".success").classList.add("on");
      normalizeStaticLinks(root);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "SLOT_CONFLICT") {
        alert("這個時段剛被其他預約保留，請重新選擇。");
        show(2);
        selectedTime = "";
        await refreshAvailability();
      } else {
        alert("預約送出失敗。請確認 Firebase 設定與網路狀態後再試。");
      }
    } finally {
      button.disabled = false;
      button.textContent = "送出預約需求";
    }
  };

  drawCalendar();
  await refreshAvailability();
}

function adminLoginMarkup() {
  return `<div class="admin-login-card"><span class="tag">ADMIN LOGIN</span><h2>77 管理後台</h2><p class="muted">使用 Firebase Authentication 的管理員帳號登入。</p><form data-admin-login><label>管理員 Email<input type="email" name="email" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label><button class="btn dark" type="submit">登入</button><p class="form-message" data-admin-message></p></form></div>`;
}

function adminShellMarkup() {
  return `<aside class="sidebar"><h2><b>77</b>waxing</h2><a class="on">Dashboard</a><a>預約管理</a><a>預約行事曆</a><a>顧客資料</a><a>服務管理</a><a>價格管理</a><a>網站設定</a><button class="btn admin-logout" type="button" data-admin-logout>登出</button></aside><main class="dash"><div class="admin-topline"><div><span class="tag">FIRESTORE ADMIN</span><h2>77 管理後台</h2></div><span class="firebase-live">● Firestore 即時同步</span></div><div class="metrics" data-metrics></div><div class="panel"><h3>預約與時段狀態</h3><p class="muted">資料直接來自 Firestore。待確認會顯示保留中；確認後重疊時段從顧客端隱藏；取消／完成／未到店會釋放鎖定。</p><div class="admin-table-scroll"><table><thead><tr><th>日期</th><th>時間</th><th>顧客</th><th>手機</th><th>服務</th><th>客別</th><th>狀態</th><th>操作</th></tr></thead><tbody data-admin-rows></tbody></table></div></div></main>`;
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
  replacePreviewBanner(root, "正式後台｜Firebase Authentication + Firestore", "ok");
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
  replacePreviewBanner(root, "管理員登入由 Firebase Authentication 保護；未登入無法讀取顧客或預約資料。", "info");
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
    root.innerHTML = `<main class="dash admin-setup"><span class="tag">FIREBASE SETUP REQUIRED</span><h2>正式後台尚未啟用</h2><p>程式已切換為 GitHub Pages + Firebase 架構，但還需要填入 Firebase Web App 公開設定，並啟用 Authentication / Firestore Rules。</p></main>`;
    replacePreviewBanner(root, "請先完成 Firebase Web App 設定；完成前不要刪除 Netlify。", "warning");
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
  const booking = document.querySelector("#booking");
  if (booking) mountBooking(booking);
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
