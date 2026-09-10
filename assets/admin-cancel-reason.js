import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const REASONS = {
  conflict: "目前該時段已有安排，這次無法接受此預約。",
  reschedule: "目前需要調整預約時間，請重新選擇其他可預約時段。",
  safety_or_fit: "很抱歉，本次預約目前無法受理。如有需要，請直接與77waxing聯繫。",
};

let db = null;
function ensureDb(){
  if(db) return db;
  if(!getApps().length) return null;
  db = getFirestore(getApp());
  return db;
}

function ensureStyles(){
  if(document.querySelector('#admin-cancel-reason-style')) return;
  const style=document.createElement('style');
  style.id='admin-cancel-reason-style';
  style.textContent=`
  .cancel-reason-modal[hidden]{display:none!important}.cancel-reason-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px}.cancel-reason-backdrop{position:absolute;inset:0;background:rgba(37,34,31,.48);backdrop-filter:blur(5px)}.cancel-reason-card{position:relative;width:min(520px,100%);background:#fffdf9;border-radius:22px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.22);color:#3a3836}.cancel-reason-card h3{margin:0 0 6px;font-size:22px}.cancel-reason-card>p{margin:0 0 18px;font-size:12px;opacity:.62}.cancel-reason-options{display:grid;gap:10px}.cancel-reason-options label{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1px solid rgba(58,56,54,.12);border-radius:14px;cursor:pointer}.cancel-reason-options input{margin-top:3px}.cancel-reason-other{width:100%;box-sizing:border-box;margin-top:12px;border:1px solid rgba(58,56,54,.15);border-radius:12px;padding:12px;font:inherit;resize:vertical;background:#fff}.cancel-reason-message{min-height:20px;margin:10px 0 0!important;font-size:12px!important;color:#a34b43;opacity:1!important}.cancel-reason-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.cancel-reason-actions button{border:1px solid rgba(58,56,54,.14);border-radius:999px;padding:10px 16px;background:#fffdf9;color:#3a3836;cursor:pointer}.cancel-reason-actions .dark{background:#3a3836;color:#fff;border-color:#3a3836}.cancel-reason-actions button:disabled{opacity:.5;cursor:wait}@media(max-width:560px){.cancel-reason-card{padding:20px;border-radius:18px}.cancel-reason-actions{display:grid;grid-template-columns:1fr 1fr}.cancel-reason-actions button{width:100%}}
  `;
  document.head.appendChild(style);
}

function modalHost(){
  ensureStyles();
  let host=document.querySelector('[data-cancel-reason-modal]');
  if(host) return host;
  host=document.createElement('div');
  host.className='cancel-reason-modal';
  host.dataset.cancelReasonModal='1';
  host.hidden=true;
  document.body.appendChild(host);
  return host;
}

async function openCancelDialog(bookingId){
  const firestore=ensureDb();
  if(!firestore) return alert('後台資料尚未準備完成，請稍後再試。');
  const host=modalHost();
  let row={};
  try{
    const snap=await getDoc(doc(firestore,'bookings',bookingId));
    if(!snap.exists()) return alert('找不到這筆預約。');
    row=snap.data();
  }catch(error){
    console.error(error);
    return alert('讀取預約資料失敗，請稍後再試。');
  }
  host.hidden=false;
  host.innerHTML=`<div class="cancel-reason-backdrop" data-cancel-close></div><section class="cancel-reason-card" role="dialog" aria-modal="true" aria-labelledby="cancel-reason-title"><h3 id="cancel-reason-title">取消預約原因</h3><p>${String(row.customerName||'顧客')} · ${String(row.preferredDate||'')} ${String(row.preferredTime||'')}<br>選擇的原因會保存到預約，並用於寄給顧客的取消通知。</p><div class="cancel-reason-options"><label><input type="radio" name="cancelReason" value="conflict" checked><span><b>時段無法安排</b><br><small>目前該時段已有安排，這次無法接受此預約。</small></span></label><label><input type="radio" name="cancelReason" value="reschedule"><span><b>需要顧客改約</b><br><small>請顧客重新選擇其他可預約時段。</small></span></label><label><input type="radio" name="cancelReason" value="safety_or_fit"><span><b>服務／安全評估不適合</b><br><small>本次預約目前無法受理，請顧客直接聯繫 77waxing。</small></span></label><label><input type="radio" name="cancelReason" value="other"><span><b>其他原因</b><br><small>自行輸入要讓顧客看到的原因。</small></span></label></div><textarea class="cancel-reason-other" rows="3" data-cancel-other placeholder="其他原因（選擇『其他原因』時必填）" disabled></textarea><p class="cancel-reason-message" data-cancel-message></p><div class="cancel-reason-actions"><button type="button" data-cancel-close>返回</button><button type="button" class="dark" data-cancel-confirm>確認取消</button></div></section>`;
  const close=()=>{host.hidden=true;host.innerHTML='';};
  host.querySelectorAll('[data-cancel-close]').forEach(el=>el.onclick=close);
  const other=host.querySelector('[data-cancel-other]');
  host.querySelectorAll('input[name="cancelReason"]').forEach(radio=>radio.onchange=()=>{other.disabled=radio.value!=='other'||!radio.checked;if(!other.disabled)other.focus();});
  host.querySelector('[data-cancel-confirm]').onclick=async()=>{
    const button=host.querySelector('[data-cancel-confirm]');
    const message=host.querySelector('[data-cancel-message]');
    const code=host.querySelector('input[name="cancelReason"]:checked')?.value||'other';
    const custom=other.value.trim();
    if(code==='other'&&!custom){message.textContent='請輸入取消原因。';return;}
    const publicReason=code==='other'?custom:REASONS[code];
    button.disabled=true;
    button.textContent='處理中…';
    message.textContent='';
    try{
      const bookingRef=doc(firestore,'bookings',bookingId);
      await runTransaction(firestore,async tx=>{
        const fresh=await tx.get(bookingRef);
        if(!fresh.exists()) throw new Error('BOOKING_NOT_FOUND');
        const lockIds=Array.isArray(fresh.data().lockIds)?fresh.data().lockIds:[];
        tx.update(bookingRef,{status:'cancelled',rejectionReasonCode:code,rejectionPublicReason:publicReason,cancelledAt:serverTimestamp(),updatedAt:serverTimestamp()});
        lockIds.forEach(lockId=>tx.delete(doc(firestore,'availabilityLocks',lockId)));
      });
      window.dispatchEvent(new CustomEvent('77waxing:booking-status-changed',{detail:{bookingId,status:'cancelled'}}));
      close();
    }catch(error){
      console.error(error);
      message.textContent='取消失敗，請稍後再試。';
      button.disabled=false;
      button.textContent='確認取消';
    }
  };
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-admin-action="cancel"][data-id]');
  if(!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openCancelDialog(button.dataset.id);
},true);
