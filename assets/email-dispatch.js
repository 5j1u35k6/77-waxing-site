import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const DEFAULT_APPS_SCRIPT_EMAIL_URL='https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec';
const LEGACY_APPS_SCRIPT_EMAIL_URL='https://script.google.com/macros/s/AKfycby1y-oojBtmNsT8T1UPMydCTPkaZIjRss7QvxXkWi2duOs4mKI8p3tbIzvhi2xwd_Zb/exec';
const DISPATCH_VERSION='20260911-1755';
let started=false;
let adminUnsub=null;
let statusMap=new Map();
let publicObserver=null;
let currentUser=null;
let currentDb=null;
const inFlight=new Set();
const queuedCreated=new Set();
const pendingCreated=new Set();

function appReady(){return getApps().length?getApp():null;}
async function emailUrl(db){
  const snap=await getDoc(doc(db,'settings','general')).catch(()=>null);
  const configured=snap?.exists()?String(snap.data().appsScriptEmailUrl||'').trim():'';
  if(!configured||configured===LEGACY_APPS_SCRIPT_EMAIL_URL)return DEFAULT_APPS_SCRIPT_EMAIL_URL;
  return configured;
}
async function dispatchBooking(user,db,bookingId){
  if(!user||!db||!bookingId)return false;
  const flightKey=`${user.uid}:${bookingId}`;
  if(inFlight.has(flightKey))return false;
  inFlight.add(flightKey);
  try{
    const url=await emailUrl(db);
    if(!url)return false;
    const idToken=await user.getIdToken();
    console.info('[77 email] dispatch',DISPATCH_VERSION,bookingId,url);
    await fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({bookingId,idToken})});
    return true;
  }catch(error){
    console.error('Email dispatch failed',error);
    return false;
  }finally{
    setTimeout(()=>inFlight.delete(flightKey),1200);
  }
}
function queueCreatedBooking(user,db,bookingId){
  const id=String(bookingId||'').trim();
  if(!id)return;
  if(!user||!db){pendingCreated.add(id);return;}
  const queueKey=`${user.uid}:${id}`;
  if(queuedCreated.has(queueKey))return;
  queuedCreated.add(queueKey);
  try{sessionStorage.setItem(`77-email-created-queued-${id}`,'1');}catch(_error){}
  dispatchBooking(user,db,id);
  setTimeout(()=>dispatchBooking(user,db,id),4000);
}
async function latestOwnedBooking(user,db){
  const snap=await getDocs(query(collection(db,'bookings'),where('ownerUid','==',user.uid)));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  rows.sort((a,b)=>{
    const ta=a.createdAt?.toMillis?.()||0;
    const tb=b.createdAt?.toMillis?.()||0;
    return tb-ta;
  });
  return rows[0]||null;
}
function watchPublicSuccess(user,db){
  if(publicObserver)return;
  let busy=false;
  const run=async()=>{
    const success=document.querySelector('#booking .success.on');
    if(busy||!success)return;
    busy=true;
    try{
      const row=await latestOwnedBooking(user,db);
      if(!row)return;
      const key=`77-email-created-queued-${row.id}`;
      try{if(sessionStorage.getItem(key))return;}catch(_error){}
      queueCreatedBooking(user,db,row.id);
    }catch(error){console.error('Booking email lookup failed',error);}finally{busy=false;}
  };
  publicObserver=new MutationObserver(()=>queueMicrotask(run));
  publicObserver.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  run();
}
async function isAdmin(user,db){
  if(!user||user.isAnonymous)return false;
  const snap=await getDoc(doc(db,'admins',user.uid)).catch(()=>null);
  return Boolean(snap?.exists());
}
function watchAdmin(user,db){
  if(adminUnsub)return;
  let first=true;
  adminUnsub=onSnapshot(collection(db,'bookings'),snap=>{
    const next=new Map();
    snap.docs.forEach(d=>{
      const data=d.data();
      next.set(d.id,String(data.status||''));
      if(first)return;
      const before=statusMap.get(d.id);
      const after=String(data.status||'');
      if(before===after)return;
      if(['pending_payment','confirmed','cancelled'].includes(after))dispatchBooking(user,db,d.id);
    });
    statusMap=next;
    first=false;
  });
}
async function startForUser(user){
  const app=appReady();if(!app||!user)return;
  const db=getFirestore(app);
  currentUser=user;
  currentDb=db;
  if(pendingCreated.size){
    [...pendingCreated].forEach(id=>{pendingCreated.delete(id);queueCreatedBooking(user,db,id);});
  }
  if(await isAdmin(user,db))watchAdmin(user,db);else watchPublicSuccess(user,db);
}
function dispatchCreatedFromEvent(event){
  const bookingId=String(event?.detail?.bookingId||'').trim();
  if(!bookingId)return;
  queueCreatedBooking(currentUser,currentDb,bookingId);
}
function dispatchStatusFromEvent(event){
  const bookingId=String(event?.detail?.bookingId||'').trim();
  if(!bookingId||!currentUser||!currentDb)return;
  dispatchBooking(currentUser,currentDb,bookingId);
}
window.addEventListener('77waxing:booking-created',dispatchCreatedFromEvent);
window.addEventListener('77waxing:booking-status-changed',dispatchStatusFromEvent);
function start(){
  if(started)return;started=true;
  const app=appReady();if(!app){started=false;return setTimeout(start,120);}
  const auth=getAuth(app);
  onAuthStateChanged(auth,user=>{if(user)startForUser(user);});
  if(auth.currentUser)startForUser(auth.currentUser);
}
start();
