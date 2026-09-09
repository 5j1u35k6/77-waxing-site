import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { collection, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const pad=n=>String(n).padStart(2,'0');
const addMinutes=(time,amount)=>{const [h,m]=String(time||'').split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return '';const total=h*60+m+amount;return `${pad(Math.floor(total/60)%24)}:${pad(total%60)}`};
let rows=[];
let scheduled=false;
function range(row){
  const start=String(row.preferredTime||'').slice(0,5);
  const duration=Number(row.actualDurationMinutes??row.durationMinutes??0);
  const lockTimes=Array.isArray(row.lockTimes)?row.lockTimes:[];
  const reservedUntil=lockTimes.length?addMinutes(lockTimes[lockTimes.length-1],30):String(row.slotEnd||'').slice(0,5);
  const end=start&&duration?addMinutes(start,duration):(reservedUntil||'');
  return {start,end,reservedUntil:reservedUntil||end};
}
function matchRow(tr){const id=tr.querySelector('[data-id]')?.dataset.id;if(id)return rows.find(r=>r.id===id);const cells=tr.querySelectorAll('td');if(cells.length<5)return null;const date=cells[0].textContent.trim();const time=(cells[1].dataset.originalStart||cells[1].textContent.trim()).slice(0,5);const name=cells[2].textContent.trim();return rows.find(r=>r.preferredDate===date&&r.preferredTime===time&&String(r.customerName||'').trim()===name);}
function enhanceTable(){document.querySelectorAll('.admin-table-scroll tbody tr').forEach(tr=>{const row=matchRow(tr);if(!row)return;const td=tr.querySelectorAll('td')[1];if(!td)return;const {start,end,reservedUntil}=range(row);if(!start||!end)return;const signature=`${start}|${end}|${reservedUntil}`;if(td.dataset.timeRangeSignature===signature)return;td.dataset.originalStart=start;td.dataset.timeRangeSignature=signature;td.innerHTML=`<div class="admin-time-range"><b>${start}–${end}</b>${reservedUntil&&reservedUntil!==end?`<small>保留至 ${reservedUntil}</small>`:''}</div>`;});}
function enhanceCalendar(){
  document.querySelectorAll('.cal-booking').forEach(card=>{const b=card.querySelector('b');const name=card.querySelector('span')?.textContent.trim();const service=card.querySelector('small')?.textContent.split(' · ')[0].trim();const start=(b?.dataset.originalStart||b?.textContent||'').slice(0,5);const row=rows.find(r=>r.preferredTime===start&&String(r.customerName||'').trim()===name&&String(r.serviceName||'').trim()===service);if(!row||!b)return;const {end}=range(row);if(end){const text=`${start}–${end}`;if(b.textContent!==text)b.textContent=text;b.dataset.originalStart=start;}});
  document.querySelectorAll('.month-event').forEach(button=>{const raw=(button.dataset.originalLabel||button.textContent||'').trim();const m=raw.match(/^(\d{2}:\d{2})(?:–\d{2}:\d{2})?\s+(.+)$/);if(!m)return;const row=rows.find(r=>r.preferredTime===m[1]&&String(r.customerName||'').trim()===m[2]);if(!row)return;const {end}=range(row);if(!end)return;button.dataset.originalLabel=`${m[1]} ${m[2]}`;const html=`<b>${m[1]}–${end}</b> ${m[2]}`;if(button.innerHTML!==html)button.innerHTML=html;});
}
function enhanceEditor(){
  document.querySelectorAll('.booking-editor-card header p').forEach(p=>{
    const raw=p.dataset.originalHeader||p.textContent.trim();
    const m=raw.match(/^(.*?)\s*·\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:–\d{2}:\d{2})?$/);
    if(!m)return;
    const [,name,date,start]=m;
    const row=rows.find(r=>r.preferredDate===date&&String(r.preferredTime||'').slice(0,5)===start&&String(r.customerName||'').trim()===name.trim());
    if(!row)return;
    const {end}=range(row);if(!end)return;
    p.dataset.originalHeader=`${name.trim()} · ${date} ${start}`;
    p.textContent=`${name.trim()} · ${date} ${start}–${end}`;
  });
}
function apply(){scheduled=false;enhanceTable();enhanceCalendar();enhanceEditor();}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}
function start(){if(!getApps().length)return setTimeout(start,80);const db=getFirestore(getApp());onSnapshot(collection(db,'bookings'),snap=>{rows=snap.docs.map(d=>({id:d.id,...d.data()}));schedule();});new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});schedule();}
start();
