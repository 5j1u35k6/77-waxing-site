import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
let db=null;
function ensureDb(){if(db)return db;if(!getApps().length)return null;db=getFirestore(getApp());return db;}
async function enhance(){
  const w=document.querySelector('.admin-v2-workspace');
  if(!w||w.hidden)return;
  const title=w.querySelector('h3')?.textContent.trim();
  if(title!=='網站設定'||w.querySelector('[data-email-settings]'))return;
  const firestore=ensureDb();if(!firestore)return;
  const snap=await getDoc(doc(firestore,'settings','general')).catch(()=>null);
  const s=snap?.exists()?snap.data():{};
  const box=document.createElement('section');
  box.className='email-settings-box';box.dataset.emailSettings='1';
  box.innerHTML=`<div class="admin-view-head"><div><span class="tag">EMAIL</span><h4>Email 與訂金通知</h4></div></div><div class="settings-grid"><label>店家收件／寄件 Email<input type="email" data-store-email value="${String(s.storeEmail||'').replaceAll('"','&quot;')}" placeholder="例如 hello@example.com"></label><label class="full">訂金 QR Code 圖片網址<input type="url" data-deposit-qr value="${String(s.depositQrUrl||'').replaceAll('"','&quot;')}" placeholder="https://..."></label></div><div class="actions"><button class="btn dark" type="button" data-email-settings-save>儲存 Email 設定</button><span class="muted" data-email-settings-message></span></div><p class="muted">寄信功能由 Firebase Functions 處理；SMTP 密碼不會存進網站或 Firestore。</p>`;
  w.appendChild(box);
  box.querySelector('[data-email-settings-save]').onclick=async()=>{const btn=box.querySelector('[data-email-settings-save]');const msg=box.querySelector('[data-email-settings-message]');const storeEmail=box.querySelector('[data-store-email]').value.trim();const depositQrUrl=box.querySelector('[data-deposit-qr]').value.trim();if(storeEmail&&!/^\S+@\S+\.\S+$/.test(storeEmail)){msg.textContent='請輸入正確 Email。';return;}btn.disabled=true;msg.textContent='儲存中…';try{await setDoc(doc(firestore,'settings','general'),{storeEmail,depositQrUrl:depositQrUrl||null,updatedAt:serverTimestamp()},{merge:true});msg.textContent='已儲存。';}catch(e){console.error(e);msg.textContent='儲存失敗。';}finally{btn.disabled=false;}};
}
new MutationObserver(()=>requestAnimationFrame(enhance)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
setTimeout(enhance,300);
