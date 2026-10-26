import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20261026-audit1";

let db=null,auth=null,settings={};

function bookingDateKey(offset=0){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const date=new Date(Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day)+offset));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}

function applyBookingSettings(){
  const root=document.querySelector('#booking');
  if(!root)return;
  const enabled=settings.bookingEnabled!==false;
  root.classList.toggle('booking-closed',!enabled);
  root.querySelectorAll('[data-booking-item],[data-next],[data-submit]').forEach(el=>{
    if(!enabled){
      if(el.dataset.runtimeDisabled!=='1')el.dataset.runtimeWasDisabled=el.disabled?'1':'0';
      el.dataset.runtimeDisabled='1';
      el.disabled=true;
    }else if(el.dataset.runtimeDisabled==='1'){
      el.disabled=el.dataset.runtimeWasDisabled==='1';
      delete el.dataset.runtimeDisabled;
      delete el.dataset.runtimeWasDisabled;
    }
  });
  let banner=root.querySelector('[data-runtime-booking-note]');
  const message=!enabled?'目前暫停線上預約。':String(settings.bookingNotice||'').trim();
  if(message){
    if(!banner){banner=document.createElement('div');banner.className='runtime-booking-note';banner.dataset.runtimeBookingNote='1';root.prepend(banner)}
    if(banner.textContent!==message)banner.textContent=message;
    banner.hidden=false;
  }else if(banner)banner.hidden=true;
  const start=settings.bookingStartTime||'08:00',end=settings.bookingEndTime||'20:00';
  const configuredMax=Number(settings.maxAdvanceDays||60);
  const max=Number.isFinite(configuredMax)&&configuredMax>0?configuredMax:60;
  const minKey=bookingDateKey(1),maxKey=bookingDateKey(max);
  const outside=date=>!date||date<minKey||date>maxKey;
  root.querySelectorAll('[data-slot-time]').forEach(el=>{
    const t=el.dataset.slotTime||'';
    el.hidden=!enabled||outside(el.dataset.slotDate)||t<start||t>end;
  });
  root.querySelectorAll('[data-anchor-date]').forEach(el=>{el.disabled=!enabled||outside(el.dataset.anchorDate)});
  root.querySelectorAll('[data-visible-date]').forEach(el=>{
    const unavailable=!enabled||outside(el.dataset.visibleDate);
    el.disabled=unavailable;
    const column=el.closest('.daycol');
    if(column)column.hidden=unavailable;
  });
}

function applyAll(){applyBookingSettings()}

function waitForExistingSignIn(timeout=900){
  if(auth.currentUser)return Promise.resolve(auth.currentUser);
  return new Promise(resolve=>{
    let settled=false;
    let unsubscribe=()=>{};
    const finish=user=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      unsubscribe();
      resolve(user||null);
    };
    unsubscribe=onAuthStateChanged(auth,user=>{if(user)finish(user)});
    const timer=setTimeout(()=>finish(auth.currentUser),timeout);
  });
}

async function ensureSignedIn(){
  if(typeof auth.authStateReady==='function')await auth.authStateReady();
  if(auth.currentUser)return auth.currentUser;
  if(!window.__77_PUBLIC_ANON_AUTH_PROMISE__){
    window.__77_PUBLIC_ANON_AUTH_PROMISE__=signInAnonymously(auth)
      .then(credential=>credential.user)
      .finally(()=>{window.__77_PUBLIC_ANON_AUTH_PROMISE__=null});
  }
  return window.__77_PUBLIC_ANON_AUTH_PROMISE__;
}

async function init(){
  try{
    const firebase=getPublicFirebase();
    auth=firebase.auth;db=firebase.db;
    await ensureSignedIn();
  }catch(e){console.error(e);return}
  onSnapshot(doc(db,'settings','general'),snap=>{settings=snap.exists()?snap.data():{};applyAll()});
  new MutationObserver(()=>queueMicrotask(applyAll)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  applyAll();
}
init();
