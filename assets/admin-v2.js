import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const pad = (n)=>String(n).padStart(2,"0");
const dateKey = (d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (date,amount)=>{const d=new Date(date);d.setDate(d.getDate()+amount);return d;};
const startOfWeek = (date)=>{const d=new Date(date);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d;};
const startOfMonth = (date)=>new Date(date.getFullYear(),date.getMonth(),1);
const monthTitle = (date)=>`${date.getFullYear()} 年 ${date.getMonth()+1} 月`;
const dayTitle = (date)=>`${date.getFullYear()} 年 ${date.getMonth()+1} 月 ${date.getDate()} 日`;
const statusText=(status)=>({pending_confirmation:"待確認",pending_payment:"待付款",confirmed:"已確認",cancelled:"已取消",completed:"已完成",no_show:"未到店"}[status]||status||"—");

let db=null,auth=null,bookings=[],settings={};
let currentView="dashboard";
let calendarMode="week";
let calendarDate=new Date();
let initialized=false;
let unsubBookings=null;

function activeAdminRoot(){return document.querySelector("body.admin-page #admin-preview");}
function dash(){return activeAdminRoot()?.querySelector(".dash");}
function originalPanel(){return dash()?.querySelector(".panel:not(.admin-v2-workspace)");}
function metrics(){return dash()?.querySelector(".metrics");}
function ensureWorkspace(){
  const host=dash(); if(!host)return null;
  let el=host.querySelector(".admin-v2-workspace");
  if(!el){el=document.createElement("section");el.className="panel admin-v2-workspace";el.hidden=true;host.appendChild(el);}return el;
}
function setBaseVisibility(showDashboard){
  const w=ensureWorkspace(); if(w)w.hidden=showDashboard;
  const m=metrics(); if(m)m.hidden=!showDashboard;
  const p=originalPanel(); if(p)p.hidden=!showDashboard;
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

function bookingCard(row){
  return `<article class="cal-booking status-${escapeHtml(row.status)}"><b>${escapeHtml(row.preferredTime||"—")}</b><span>${escapeHtml(row.customerName||"未命名")}</span><small>${escapeHtml(row.serviceName||"—")} · ${statusText(row.status)}</small></article>`;
}
function rowsForDate(key){return bookings.filter((b)=>b.preferredDate===key&&!["cancelled"].includes(b.status)).sort((a,b)=>String(a.preferredTime||"").localeCompare(String(b.preferredTime||"")));}

function renderCalendar(){
  const w=ensureWorkspace();if(!w)return;
  setBaseVisibility(false);
  const modeButtons=["day","week","month"].map((m)=>`<button type="button" data-cal-mode="${m}" class="${calendarMode===m?"on":""}">${m==="day"?"日":m==="week"?"週":"月"}</button>`).join("");
  let title="";let body="";
  if(calendarMode==="day"){
    title=dayTitle(calendarDate);
    const key=dateKey(calendarDate);const rows=rowsForDate(key);
    body=`<div class="admin-day-calendar"><div class="day-date"><strong>${calendarDate.getDate()}</strong><span>${"日一二三四五六"[calendarDate.getDay()]}</span></div><div class="day-events">${rows.length?rows.map(bookingCard).join(""):"<p class='muted'>這一天沒有預約。</p>"}</div></div>`;
  } else if(calendarMode==="week"){
    const start=startOfWeek(calendarDate);const end=addDays(start,6);title=`${start.getMonth()+1}/${start.getDate()} – ${end.getMonth()+1}/${end.getDate()}`;
    body=`<div class="admin-week-calendar">${Array.from({length:7},(_,i)=>{const d=addDays(start,i);const key=dateKey(d);const rows=rowsForDate(key);return `<section class="week-day ${key===dateKey(new Date())?"today":""}"><header><small>週${"日一二三四五六"[d.getDay()]}</small><b>${d.getMonth()+1}/${d.getDate()}</b></header><div>${rows.length?rows.map(bookingCard).join(""):"<span class='empty'>—</span>"}</div></section>`;}).join("")}</div>`;
  } else {
    const first=startOfMonth(calendarDate);title=monthTitle(first);const offset=first.getDay();const start=addDays(first,-offset);
    body=`<div class="admin-month-weekdays">${"日一二三四五六".split("").map(x=>`<span>${x}</span>`).join("")}</div><div class="admin-month-calendar">${Array.from({length:42},(_,i)=>{const d=addDays(start,i);const key=dateKey(d);const rows=rowsForDate(key);return `<section class="month-day ${d.getMonth()!==first.getMonth()?"other":""} ${key===dateKey(new Date())?"today":""}"><header>${d.getDate()}</header><div>${rows.slice(0,3).map((r)=>`<button type="button" class="month-event" data-calendar-date="${key}"><b>${escapeHtml(r.preferredTime||"")}</b> ${escapeHtml(r.customerName||"")}</button>`).join("")}${rows.length>3?`<small>+${rows.length-3} 筆</small>`:""}</div></section>`;}).join("")}</div>`;
  }
  w.innerHTML=`<div class="admin-view-head"><div><span class="tag">CALENDAR</span><h3>預約行事曆</h3></div><div class="calendar-mode">${modeButtons}</div></div><div class="calendar-toolbar"><div><button data-cal-nav="prev">‹</button><button data-cal-today>今天</button><button data-cal-nav="next">›</button></div><strong>${title}</strong></div>${body}`;
  w.querySelectorAll("[data-cal-mode]").forEach(btn=>btn.onclick=()=>{calendarMode=btn.dataset.calMode;renderCalendar();});
  w.querySelectorAll("[data-cal-nav]").forEach(btn=>btn.onclick=()=>{const dir=btn.dataset.calNav==="next"?1:-1;calendarDate=calendarMode==="month"?new Date(calendarDate.getFullYear(),calendarDate.getMonth()+dir,1):addDays(calendarDate,calendarMode==="week"?dir*7:dir);renderCalendar();});
  w.querySelector("[data-cal-today]").onclick=()=>{calendarDate=new Date();renderCalendar();};
  w.querySelectorAll("[data-calendar-date]").forEach(btn=>btn.onclick=()=>{calendarDate=new Date(`${btn.dataset.calendarDate}T00:00:00`);calendarMode="day";renderCalendar();});
}

function renderCustomers(){
  const w=ensureWorkspace();if(!w)return;setBaseVisibility(false);
  const map=new Map();
  bookings.forEach((b)=>{const phone=String(b.customerPhone||"").trim();if(!phone)return;const current=map.get(phone)||{name:b.customerName||"未命名",phone,count:0,last:"",services:new Set()};current.count+=1;if((b.preferredDate||"")>current.last)current.last=b.preferredDate||"";if(b.serviceName)current.services.add(b.serviceName);map.set(phone,current);});
  const rows=[...map.values()].sort((a,b)=>b.last.localeCompare(a.last));
  w.innerHTML=`<div class="admin-view-head"><div><span class="tag">CUSTOMERS</span><h3>顧客資料</h3></div><button class="btn dark" type="button" data-paper-import>＋ 新增紙本轉電子紀錄</button></div><p class="muted">線上預約紀錄會自動彙整；紙本資料之後可由右上按鈕建立電子紀錄。</p><div class="customer-table-wrap"><table><thead><tr><th>顧客</th><th>手機</th><th>線上預約</th><th>最近預約</th><th>曾預約服務</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.phone)}</td><td>${r.count} 次</td><td>${escapeHtml(r.last||"—")}</td><td>${escapeHtml([...r.services].slice(0,3).join("、")||"—")}</td></tr>`).join("")||"<tr><td colspan='5' class='muted'>目前沒有線上顧客紀錄。</td></tr>"}</tbody></table></div><div class="paper-import-note" data-paper-note hidden>紙本轉電子入口已建立；下一步會補上紙本欄位與匯入表單。</div>`;
  w.querySelector("[data-paper-import]").onclick=()=>{const note=w.querySelector("[data-paper-note]");note.hidden=false;note.scrollIntoView({behavior:"smooth",block:"nearest"});};
}

async function renderSettings(){
  const w=ensureWorkspace();if(!w)return;setBaseVisibility(false);
  let live=settings;
  try{const snap=await getDoc(doc(db,"settings","general"));if(snap.exists())live={...live,...snap.data()};}catch{}
  const start=live.bookingStartTime||"08:00",end=live.bookingEndTime||"20:00",max=Number(live.maxAdvanceDays||60),enabled=live.bookingEnabled!==false,notice=live.bookingNotice||"";
  const timeOptions=Array.from({length:25},(_,i)=>{const mins=480+i*30;return `${pad(Math.floor(mins/60))}:${pad(mins%60)}`;});
  w.innerHTML=`<div class="admin-view-head"><div><span class="tag">SETTINGS</span><h3>網站設定</h3></div></div><div class="settings-grid"><label class="setting-switch"><span><b>開放線上預約</b><small>關閉時顧客無法選擇服務與時段</small></span><input type="checkbox" name="bookingEnabled" ${enabled?"checked":""}><i></i></label><label>每日最早可約時間<select name="bookingStartTime">${timeOptions.map(t=>`<option ${t===start?"selected":""}>${t}</option>`).join("")}</select></label><label>每日最晚開始時間<select name="bookingEndTime">${timeOptions.map(t=>`<option ${t===end?"selected":""}>${t}</option>`).join("")}</select></label><label>最遠可預約天數<input name="maxAdvanceDays" type="number" min="7" max="180" value="${max}"></label><label class="full">預約頁公告<textarea name="bookingNotice" rows="4" placeholder="例如：近期較忙，送出後請等待確認。">${escapeHtml(notice)}</textarea></label></div><div class="actions"><button class="btn dark" type="button" data-save-settings>儲存網站設定</button><span class="muted" data-settings-message></span></div>`;
  w.querySelector("[data-save-settings]").onclick=async()=>{const button=w.querySelector("[data-save-settings]");const msg=w.querySelector("[data-settings-message]");const a=w.querySelector('[name="bookingStartTime"]').value,b=w.querySelector('[name="bookingEndTime"]').value;if(a>b){msg.textContent="最晚開始時間不可早於最早時間。";return;}button.disabled=true;msg.textContent="儲存中…";try{settings={bookingEnabled:w.querySelector('[name="bookingEnabled"]').checked,bookingStartTime:a,bookingEndTime:b,maxAdvanceDays:Number(w.querySelector('[name="maxAdvanceDays"]').value||60),bookingNotice:w.querySelector('[name="bookingNotice"]').value.trim()};await setDoc(doc(db,"settings","general"),{...settings,updatedAt:serverTimestamp()},{merge:true});msg.textContent="已儲存，前台會套用最新設定。";}catch(e){console.error(e);msg.textContent="儲存失敗，請稍後再試。";}finally{button.disabled=false;}};
}

function delegateCatalog(view){
  setBaseVisibility(false);
  const w=ensureWorkspace();
  if(w){
    w.hidden=false;
    w.dataset.catalogOwned="pending";
    w.innerHTML=`<div class="admin-view-head"><div><span class="tag">${view==="services"?"SERVICES":"PRICING"}</span><h3>${view==="services"?"服務功能":"價格功能"}</h3></div></div><p class="muted">正在載入管理工具…</p>`;
  }
  window.dispatchEvent(new CustomEvent("77waxing:admin-catalog-route",{detail:{view}}));
}

function renderView(view){
  currentView=view;
  if(view==="dashboard"){setBaseVisibility(true);return;}
  if(view==="calendar")return renderCalendar();
  if(view==="customers")return renderCustomers();
  if(view==="services"||view==="pricing")return delegateCatalog(view);
  if(view==="slots"){setBaseVisibility(false);const w=ensureWorkspace();if(w){w.hidden=false;w.innerHTML=`<div class="admin-view-head"><div><span class="tag">AVAILABILITY</span><h3>時段功能</h3></div></div><p class="muted">正在載入時段功能…</p>`;}setTimeout(()=>window.dispatchEvent(new HashChangeEvent("hashchange")),0);return;}
  if(view==="settings")return renderSettings();
  if(view==="bookings"){
    setBaseVisibility(true);
    const p=originalPanel();
    if(p){metrics().hidden=true;p.hidden=false;p.querySelector("h3").textContent="預約管理";p.scrollIntoView({behavior:"smooth",block:"start"});}
  }
}

function bindSidebar(){
  const root=activeAdminRoot();if(!root)return false;const sidebar=root.querySelector(".sidebar");if(!sidebar)return false;
  const map={"總覽":"dashboard","Dashboard":"dashboard","預約管理":"bookings","預約行事曆":"calendar","顧客資料":"customers","服務管理":"services","服務功能":"services","時段功能":"slots","價格管理":"pricing","價格功能":"pricing","網站設定":"settings"};
  sidebar.querySelectorAll("a").forEach(link=>{const view=map[(link.textContent||"").trim()];if(!view||link.dataset.adminV2Bound)return;link.dataset.adminV2Bound="1";link.addEventListener("click",(event)=>{event.preventDefault();event.stopImmediatePropagation();sidebar.querySelectorAll("a").forEach(a=>a.classList.remove("on"));link.classList.add("on");history.replaceState(null,"",`${location.pathname}#${view}`);renderView(view);},true);});
  return true;
}

function startData(){
  if(unsubBookings)return;
  unsubBookings=onSnapshot(query(collection(db,"bookings"),orderBy("preferredDate","asc")),snap=>{bookings=snap.docs.map(d=>({id:d.id,...d.data()}));if(currentView==="calendar")renderCalendar();if(currentView==="customers")renderCustomers();});
  onSnapshot(doc(db,"settings","general"),snap=>{settings=snap.exists()?snap.data():{};});
}

function init(){
  if(initialized)return; if(!getApps().length)return;
  const app=getApp();auth=getAuth(app);db=getFirestore(app);initialized=true;
  onAuthStateChanged(auth,(user)=>{if(!user||user.isAnonymous)return;const timer=setInterval(()=>{if(bindSidebar()){clearInterval(timer);startData();const hash=(location.hash||"#dashboard").slice(1);if(["bookings","calendar","customers","services","slots","pricing","settings"].includes(hash))renderView(hash);}},120);});
}

const boot=setInterval(()=>{if(getApps().length){clearInterval(boot);init();}},100);
setTimeout(()=>clearInterval(boot),15000);
