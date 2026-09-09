import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let db=null,auth=null,settings={};

function applyBookingSettings(){
  const root=document.querySelector('#booking');
  if(!root)return;
  const enabled=settings.bookingEnabled!==false;
  root.classList.toggle('booking-closed',!enabled);
  root.querySelectorAll('[data-booking-item],[data-next]').forEach(el=>{if(!enabled)el.disabled=true});
  let banner=root.querySelector('[data-runtime-booking-note]');
  const message=!enabled?'目前暫停線上預約。':String(settings.bookingNotice||'').trim();
  if(message){
    if(!banner){banner=document.createElement('div');banner.className='runtime-booking-note';banner.dataset.runtimeBookingNote='1';root.prepend(banner)}
    banner.textContent=message;banner.hidden=false;
  }else if(banner)banner.hidden=true;
  const start=settings.bookingStartTime||'10:00',end=settings.bookingEndTime||'20:00';
  root.querySelectorAll('[data-slot-time]').forEach(el=>{const t=el.dataset.slotTime||'';el.hidden=t<start||t>end});
  const max=Number(settings.maxAdvanceDays||60);
  if(Number.isFinite(max)&&max>0){
    const now=new Date();
    const maxDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()+max);
    const maxKey=`${maxDate.getFullYear()}-${String(maxDate.getMonth()+1).padStart(2,'0')}-${String(maxDate.getDate()).padStart(2,'0')}`;
    root.querySelectorAll('[data-anchor-date]').forEach(el=>{if((el.dataset.anchorDate||'')>maxKey)el.disabled=true});
  }
}

function applyAll(){applyBookingSettings()}

async function init(){
  if(!getApps().length)return;
  const app=getApp();auth=getAuth(app);db=getFirestore(app);
  if(!auth.currentUser){try{await signInAnonymously(auth)}catch(e){console.error(e);return}}
  onSnapshot(doc(db,'settings','general'),snap=>{settings=snap.exists()?snap.data():{};applyAll()});
  new MutationObserver(()=>queueMicrotask(applyAll)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  applyAll();
}
const timer=setInterval(()=>{if(getApps().length){clearInterval(timer);init()}},100);
setTimeout(()=>clearInterval(timer),15000);
