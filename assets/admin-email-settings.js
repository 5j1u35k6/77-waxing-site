import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
const DEFAULT_APPS_SCRIPT_EMAIL_URL='https://script.google.com/macros/s/AKfycby1y-oojBtmNsT8T1UPMydCTPkaZIjRss7QvxXkWi2duOs4mKI8p3tbIzvhi2xwd_Zb/exec';
const DEFAULT_STORE_EMAIL='77waxing.mail@gmail.com';
let db=null;
let scheduled=false;
function ensureDb(){if(db)return db;if(!getApps().length)return null;db=getFirestore(getApp());return db;}
async function enhance(){
  scheduled=false;
  const w=document.querySelector('.admin-v2-workspace');
  if(!w||w.hidden)return;
  const title=w.querySelector('h3')?.textContent.trim();
  if(title!=='網站設定'||w.querySelector('[data-email-settings]'))return;
  const firestore=ensureDb();if(!firestore)return;
  const snap=await getDoc(doc(firestore,'settings','general')).catch(()=>null);
  const s=snap?.exists()?snap.data():{};
  const safe=v=>String(v||'').replaceAll('"','&quot;');
  const box=document.createElement('section');
  box.className='email-settings-box';box.dataset.emailSettings='1';
  box.innerHTML=`<div class="admin-view-head"><div><span class="tag">EMAIL</span><h4>Email 與訂金通知</h4></div></div><div class="settings-grid"><label>店家收件／寄件 Email<input type="email" data-store-email value="${safe(s.storeEmail||DEFAULT_STORE_EMAIL)}" placeholder="例如 hello@example.com"></label><label class="full">Google Apps Script Web App 網址<input type="url" data-apps-script-email-url value="${safe(s.appsScriptEmailUrl||DEFAULT_APPS_SCRIPT_EMAIL_URL)}" placeholder="https://script.google.com/macros/s/.../exec"></label><label class="full">訂金 QR Code 圖片網址<input type="url" data-deposit-qr value="${safe(s.depositQrUrl)}" placeholder="https://..."></label></div><div class="actions"><button class="btn dark" type="button" data-email-settings-save>儲存 Email 設定</button><span class="muted" data-email-settings-message></span></div><p class="muted">Email 由 Google Apps Script 以你的 Google 帳號寄出，不需要 Firebase Blaze，也不需要把 Gmail 密碼存進網站。</p>`;
  w.appendChild(box);
  box.querySelector('[data-email-settings-save]').onclick=async()=>{
    const btn=box.querySelector('[data-email-settings-save]');
    const msg=box.querySelector('[data-email-settings-message]');
    const storeEmail=box.querySelector('[data-store-email]').value.trim()||DEFAULT_STORE_EMAIL;
    const appsScriptEmailUrl=box.querySelector('[data-apps-script-email-url]').value.trim();
    const depositQrUrl=box.querySelector('[data-deposit-qr]').value.trim();
    if(storeEmail&&!/^\S+@\S+\.\S+$/.test(storeEmail)){msg.textContent='請輸入正確 Email。';return;}
    if(appsScriptEmailUrl&&!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(appsScriptEmailUrl)){msg.textContent='請貼上 Apps Script 部署後的 /exec 網址。';return;}
    btn.disabled=true;msg.textContent='儲存中…';
    try{await setDoc(doc(firestore,'settings','general'),{storeEmail,appsScriptEmailUrl:appsScriptEmailUrl||DEFAULT_APPS_SCRIPT_EMAIL_URL,depositQrUrl:depositQrUrl||null,updatedAt:serverTimestamp()},{merge:true});msg.textContent='已儲存。';}
    catch(e){console.error(e);msg.textContent='儲存失敗。';}
    finally{btn.disabled=false;}
  };
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance);}
new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
setTimeout(enhance,300);
