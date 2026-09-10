import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { collection, doc, getDoc, getFirestore, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let db=null;
let bookings=[];
let scheduled=false;

const pad=n=>String(n).padStart(2,'0');
const normalizePhone=value=>String(value||'').replace(/[^0-9+]/g,'').trim();
const addMinutes=(time,amount)=>{
  const [h,m]=String(time||'').split(':').map(Number);
  if(!Number.isFinite(h)||!Number.isFinite(m))return '';
  const total=h*60+m+Number(amount||0);
  return `${pad(Math.floor(total/60)%24)}:${pad((total%60+60)%60)}`;
};
const hhmm=value=>{
  if(!value)return '';
  if(typeof value==='string'&&/^\d{2}:\d{2}/.test(value))return value.slice(0,5);
  let date=null;
  try{
    if(value&&typeof value.toDate==='function')date=value.toDate();
    else date=new Date(value);
  }catch{}
  if(!date||Number.isNaN(date.getTime()))return '';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
};
function ensureDb(){
  if(db)return db;
  if(!getApps().length)return null;
  db=getFirestore(getApp());
  return db;
}
function range(row){
  const start=String(row.preferredTime||'').slice(0,5);
  const buffer=Math.max(0,Number(row.bufferMinutes??30)||0);
  let duration=Number(row.actualDurationMinutes??row.durationMinutes??0)||0;
  const lockTimes=Array.isArray(row.lockTimes)?row.lockTimes:[];
  if(!duration&&lockTimes.length){
    duration=Math.max(30,lockTimes.length*30-buffer);
  }
  if(!duration&&row.slotStart&&row.slotEnd){
    const a=new Date(row.slotStart),b=new Date(row.slotEnd);
    if(!Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime()))duration=Math.max(30,Math.round((b-a)/60000)-buffer);
  }
  const end=start&&duration?addMinutes(start,duration):'';
  let reservedUntil='';
  if(lockTimes.length)reservedUntil=addMinutes(String(lockTimes[lockTimes.length-1]).slice(0,5),30);
  if(!reservedUntil)reservedUntil=hhmm(row.slotEnd);
  if(!reservedUntil&&end)reservedUntil=addMinutes(end,buffer);
  return {start,end:end||reservedUntil,reservedUntil:reservedUntil||end};
}
function matchBooking(tr){
  const directId=tr.querySelector('[data-id]')?.dataset.id||tr.querySelector('[data-admin-delete-booking]')?.dataset.adminDeleteBooking||'';
  if(directId){const found=bookings.find(row=>row.id===directId);if(found)return found;}
  const cells=tr.querySelectorAll('td');
  if(cells.length<5)return null;
  const date=cells[0]?.textContent.trim()||'';
  const start=(cells[1]?.dataset.originalStart||cells[1]?.textContent.match(/\d{2}:\d{2}/)?.[0]||'').slice(0,5);
  const name=cells[2]?.textContent.trim()||'';
  const phone=normalizePhone(cells[3]?.textContent||'');
  return bookings.find(row=>String(row.preferredDate||'')===date&&String(row.preferredTime||'').slice(0,5)===start&&String(row.customerName||'').trim()===name&&(!phone||normalizePhone(row.customerPhone)===phone))||
    bookings.find(row=>String(row.preferredDate||'')===date&&String(row.preferredTime||'').slice(0,5)===start&&String(row.customerName||'').trim()===name)||null;
}
function preserveTimeRanges(){
  document.querySelectorAll('.admin-table-scroll tbody tr').forEach(tr=>{
    const row=matchBooking(tr);if(!row)return;
    const td=tr.querySelectorAll('td')[1];if(!td)return;
    const {start,end,reservedUntil}=range(row);if(!start||!end)return;
    const signature=`critical:${start}|${end}|${reservedUntil}`;
    if(td.dataset.criticalTimeRange===signature)return;
    td.dataset.originalStart=start;
    td.dataset.criticalTimeRange=signature;
    td.innerHTML=`<div class="admin-time-range"><b>${start}–${end}</b>${reservedUntil&&reservedUntil!==end?`<small>保留至 ${reservedUntil}</small>`:''}</div>`;
  });
  document.querySelectorAll('.cal-booking').forEach(card=>{
    const b=card.querySelector('b');if(!b)return;
    const start=(b.dataset.originalStart||b.textContent.match(/\d{2}:\d{2}/)?.[0]||'').slice(0,5);
    const name=card.querySelector('span')?.textContent.trim()||'';
    const service=card.querySelector('small')?.textContent.split(' · ')[0].trim()||'';
    const row=bookings.find(r=>String(r.preferredTime||'').slice(0,5)===start&&String(r.customerName||'').trim()===name&&String(r.serviceName||'').trim()===service);
    if(!row)return;const {end}=range(row);if(!end)return;
    b.dataset.originalStart=start;b.textContent=`${start}–${end}`;
  });
  document.querySelectorAll('.month-event').forEach(button=>{
    const raw=button.dataset.originalLabel||button.textContent||'';
    const m=raw.trim().match(/^(\d{2}:\d{2})(?:–\d{2}:\d{2})?\s+(.+)$/);if(!m)return;
    const row=bookings.find(r=>String(r.preferredTime||'').slice(0,5)===m[1]&&String(r.customerName||'').trim()===m[2].trim());if(!row)return;
    const {end}=range(row);if(!end)return;
    button.dataset.originalLabel=`${m[1]} ${m[2].trim()}`;
    button.innerHTML=`<b>${m[1]}–${end}</b> ${m[2].trim()}`;
  });
}
async function deleteBooking(id){
  const firestore=ensureDb();if(!firestore)return alert('後台資料尚未準備完成。');
  const ref=doc(firestore,'bookings',id);
  const snap=await getDoc(ref);
  if(!snap.exists())return alert('這筆預約已不存在。');
  const row=snap.data()||{};
  const {start,end}=range(row);
  const label=`${row.customerName||'未命名'}｜${row.preferredDate||''} ${start}${end?`–${end}`:''}`;
  if(!confirm(`確定永久刪除這筆預約？\n${label}\n\n對應保留時段也會一起釋放。此操作無法復原。`))return;
  const refs=[ref];
  (Array.isArray(row.lockIds)?row.lockIds:[]).forEach(lockId=>refs.push(doc(firestore,'availabilityLocks',lockId)));
  const unique=[...new Map(refs.map(item=>[item.path,item])).values()];
  for(let i=0;i<unique.length;i+=400){
    const batch=writeBatch(firestore);unique.slice(i,i+400).forEach(item=>batch.delete(item));await batch.commit();
  }
}
function preserveDeleteButtons(){
  document.querySelectorAll('.admin-table-scroll tbody tr').forEach(tr=>{
    const cell=tr.querySelector('.adminacts');if(!cell)return;
    if(cell.querySelector('[data-admin-delete-booking],[data-admin-critical-delete]'))return;
    const row=matchBooking(tr);if(!row)return;
    if(cell.textContent.trim()==='—')cell.textContent='';
    const button=document.createElement('button');
    button.type='button';button.className='admin-delete-record';button.dataset.adminCriticalDelete=row.id;button.textContent='刪除';
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{await deleteBooking(button.dataset.adminCriticalDelete||'');}
      catch(error){console.error(error);alert('刪除預約失敗，請稍後再試。');}
      finally{button.disabled=false;}
    });
    cell.appendChild(button);
  });
}
function apply(){scheduled=false;preserveTimeRanges();preserveDeleteButtons();}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}
function start(){
  const firestore=ensureDb();if(!firestore)return setTimeout(start,100);
  onSnapshot(collection(firestore,'bookings'),snapshot=>{bookings=snapshot.docs.map(d=>({id:d.id,...d.data()}));schedule();},error=>console.error('critical-preserve bookings',error));
  new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(schedule,0));
  schedule();
}
start();
