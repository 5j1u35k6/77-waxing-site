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
  .cancel-reason-modal[hidden]{display:none!important}
  .cancel-reason-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:24px;box-sizing:border-box}
  .cancel-reason-backdrop{position:absolute;inset:0;background:rgba(37,34,31,.52);backdrop-filter:blur(5px)}
  .cancel-reason-card{position:relative;width:min(720px,calc(100vw - 48px));max-height:calc(100dvh - 48px);overflow:auto;box-sizing:border-box;background:#fffdf9;border-radius:24px;padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.24);color:#3a3836}
  .cancel-reason-card h3{margin:0;font-size:24px;line-height:1.2;font-weight:600}
  .cancel-reason-meta{margin:8px 0 0!important;font-size:12px!important;line-height:1.55;opacity:.58!important}
  .cancel-reason-help{margin:4px 0 20px!important;font-size:12px!important;line-height:1.55;opacity:.58!important}
  .cancel-reason-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .cancel-reason-options label{display:grid!important;grid-template-columns:20px minmax(0,1fr);gap:11px;align-items:start;min-height:92px;box-sizing:border-box;padding:15px 16px;border:1px solid rgba(58,56,54,.13);border-radius:16px;background:#fff;cursor:pointer;transition:border-color .15s ease,background-color .15s ease,box-shadow .15s ease}
  .cancel-reason-options label:hover{border-color:rgba(58,56,54,.28);background:#fbf7f0}
  .cancel-reason-options label:has(input:checked){border-color:#8b7355;background:#f6f0e6;box-shadow:inset 0 0 0 1px rgba(139,115,85,.08)}
  .cancel-reason-options input[type="radio"]{appearance:auto!important;-webkit-appearance:radio!important;width:18px!important;height:18px!important;min-width:18px!important;max-width:18px!important;margin:2px 0 0!important;padding:0!important;border:0!important;border-radius:50%!important;box-shadow:none!important;background:transparent!important;accent-color:#3a3836;justify-self:start}
  .cancel-reason-options span{display:block;min-width:0;text-align:left}
  .cancel-reason-options b{display:block;margin:0 0 6px;font-size:14px;line-height:1.35}
  .cancel-reason-options small{display:block;font-size:12px;line-height:1.6;opacity:.64}
  .cancel-reason-other[hidden]{display:none!important}
  .cancel-reason-other{width:100%;box-sizing:border-box;margin-top:14px;border:1px solid rgba(58,56,54,.16);border-radius:14px;padding:13px 14px;font:inherit;line-height:1.55;resize:vertical;background:#fff;min-height:96px}
  .cancel-reason-other:focus{outline:2px solid rgba(139,115,85,.22);border-color:#8b7355}
  .cancel-reason-message{min-height:18px;margin:8px 0 0!important;font-size:12px!important;color:#a34b43;opacity:1!important}
  .cancel-reason-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(58,56,54,.08)}
  .cancel-reason-actions button{min-width:108px;border:1px solid rgba(58,56,54,.14);border-radius:999px;padding:10px 18px;background:#fffdf9;color:#3a3836;cursor:pointer;font:inherit}
  .cancel-reason-actions .dark{background:#3a3836;color:#fff;border-color:#3a3836}
  .cancel-reason-actions button:disabled{opacity:.5;cursor:wait}
  @media(max-width:720px){.cancel-reason-modal{padding:16px;align-items:center}.cancel-reason-card{width:min(100%,560px);max-height:calc(100dvh - 32px);padding:22px;border-radius:20px}.cancel-reason-options{grid-template-columns:1fr}.cancel-reason-options label{min-height:0;padding:13px 14px}.cancel-reason-help{margin-bottom:16px!important}}
  @media(max-width:430px){.cancel-reason-modal{padding:10px}.cancel-reason-card{width:100%;max-height:calc(100dvh - 20px);padding:18px;border-radius:18px}.cancel-reason-card h3{font-size:21px}.cancel-reason-options{gap:9px}.cancel-reason-options label{grid-template-columns:18px minmax(0,1fr);gap:10px;padding:12px}.cancel-reason-options input[type="radio"]{width:17px!important;height:17px!important;min-width:17px!important;max-width:17px!important}.cancel-reason-options b{font-size:13px}.cancel-reason-options small{font-size:11px}.cancel-reason-actions{position:sticky;bottom:-18px;margin-left:-18px;margin-right:-18px;padding:14px 18px 18px;background:#fffdf9;grid-template-columns:1fr 1fr;display:grid}.cancel-reason-actions button{width:100%;min-width:0}}
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
  host.innerHTML=`<div class="cancel-reason-backdrop" data-cancel-close></div><section class="cancel-reason-card" role="dialog" aria-modal="true" aria-labelledby="cancel-reason-title"><h3 id="cancel-reason-title">取消預約原因</h3><p class="cancel-reason-meta">${String(row.customerName||'顧客')} · ${String(row.preferredDate||'')} ${String(row.preferredTime||'')}</p><p class="cancel-reason-help">請選擇一個最符合的原因；確認後會保存於預約紀錄，並用於寄給顧客的取消通知。</p><div class="cancel-reason-options"><label><input type="radio" name="cancelReason" value="conflict" checked><span><b>時段無法安排</b><small>目前該時段已有安排，這次無法接受此預約。</small></span></label><label><input type="radio" name="cancelReason" value="reschedule"><span><b>需要顧客改約</b><small>請顧客重新選擇其他可預約時段。</small></span></label><label><input type="radio" name="cancelReason" value="safety_or_fit"><span><b>服務／安全評估不適合</b><small>本次預約目前無法受理，請顧客直接聯繫 77waxing。</small></span></label><label><input type="radio" name="cancelReason" value="other"><span><b>其他原因</b><small>自行輸入要讓顧客看到的原因。</small></span></label></div><textarea class="cancel-reason-other" rows="3" data-cancel-other placeholder="請輸入要讓顧客看到的取消原因" disabled hidden></textarea><p class="cancel-reason-message" data-cancel-message></p><div class="cancel-reason-actions"><button type="button" data-cancel-close>返回</button><button type="button" class="dark" data-cancel-confirm>確認取消</button></div></section>`;
  const close=()=>{host.hidden=true;host.innerHTML='';};
  host.querySelectorAll('[data-cancel-close]').forEach(el=>el.onclick=close);
  const other=host.querySelector('[data-cancel-other]');
  const syncOther=()=>{
    const selected=host.querySelector('input[name="cancelReason"]:checked')?.value;
    const show=selected==='other';
    other.hidden=!show;
    other.disabled=!show;
    if(show) requestAnimationFrame(()=>other.focus());
  };
  host.querySelectorAll('input[name="cancelReason"]').forEach(radio=>radio.onchange=syncOther);
  host.querySelector('[data-cancel-confirm]').onclick=async()=>{
    const button=host.querySelector('[data-cancel-confirm]');
    const message=host.querySelector('[data-cancel-message]');
    const code=host.querySelector('input[name="cancelReason"]:checked')?.value||'other';
    const custom=other.value.trim();
    if(code==='other'&&!custom){message.textContent='請輸入取消原因。';other.focus();return;}
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
