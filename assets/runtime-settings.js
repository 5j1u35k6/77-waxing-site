import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const serviceId=(category,name)=>`${category}-${encodeURIComponent(name).replace(/%/g,"")}`;
let db=null,auth=null,serviceMap=new Map(),settings={};

function normalizePath(){let p=location.pathname.startsWith('/77-waxing-site')?location.pathname.slice('/77-waxing-site'.length):location.pathname;if(!p.startsWith('/'))p='/'+p;return p;}
function activeCategory(){return document.querySelector('.booking-service-categories [data-booking-category].on')?.dataset.bookingCategory||'';}
function applyBookingOverrides(){
  const root=document.querySelector('#booking');if(!root)return;
  const category=activeCategory();
  root.querySelectorAll('.booking-item').forEach((button)=>{
    const name=button.querySelector('b')?.textContent?.trim();if(!name||!category)return;
    const data=serviceMap.get(serviceId(category,name));
    button.hidden=data?.enabled===false;
    let price=button.querySelector('.booking-live-price');
    if(data?.priceLabel){if(!price){price=document.createElement('strong');price.className='booking-live-price';button.appendChild(price);}price.textContent=data.priceLabel;}else if(price)price.remove();
  });
  const enabled=settings.bookingEnabled!==false;
  root.classList.toggle('booking-closed',!enabled);
  root.querySelectorAll('[data-booking-item],[data-next]').forEach((el)=>{if(!enabled)el.disabled=true;});
  let banner=root.querySelector('[data-runtime-booking-note]');
  const message=!enabled?'目前暫停線上預約。':String(settings.bookingNotice||'').trim();
  if(message){if(!banner){banner=document.createElement('div');banner.className='runtime-booking-note';banner.dataset.runtimeBookingNote='1';root.prepend(banner);}banner.textContent=message;banner.hidden=false;}else if(banner)banner.hidden=true;
  const start=settings.bookingStartTime||'10:00',end=settings.bookingEndTime||'20:00';
  root.querySelectorAll('[data-slot-time]').forEach((el)=>{const t=el.dataset.slotTime||'';if(t<start||t>end)el.hidden=true;});
  const max=Number(settings.maxAdvanceDays||60);if(Number.isFinite(max)&&max>0){const now=new Date();const maxDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()+max);const maxKey=`${maxDate.getFullYear()}-${String(maxDate.getMonth()+1).padStart(2,'0')}-${String(maxDate.getDate()).padStart(2,'0')}`;root.querySelectorAll('[data-anchor-date]').forEach((el)=>{if((el.dataset.anchorDate||'')>maxKey)el.disabled=true;});}
}

function applyPriceOverrides(){
  document.querySelectorAll('.price-section[data-price-section]').forEach((section)=>{
    const category=section.dataset.priceSection;
    section.querySelectorAll('.price-row').forEach((row)=>{
      const name=row.querySelector('b')?.textContent?.trim();if(!name)return;const data=serviceMap.get(serviceId(category,name));if(data?.priceLabel){const price=row.querySelector('.price');if(price)price.textContent=data.priceLabel;}
    });
  });
}
function applyAll(){applyBookingOverrides();applyPriceOverrides();}

async function init(){
  if(!getApps().length)return;const app=getApp();auth=getAuth(app);db=getFirestore(app);
  if(!auth.currentUser){try{await signInAnonymously(auth);}catch(e){console.error(e);return;}}
  onSnapshot(collection(db,'services'),snap=>{serviceMap=new Map(snap.docs.map(d=>[d.id,d.data()]));applyAll();});
  onSnapshot(doc(db,'settings','general'),snap=>{settings=snap.exists()?snap.data():{};applyAll();});
  new MutationObserver(()=>queueMicrotask(applyAll)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  applyAll();
}
const timer=setInterval(()=>{if(getApps().length){clearInterval(timer);init();}},100);setTimeout(()=>clearInterval(timer),15000);
