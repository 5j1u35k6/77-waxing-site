import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { loadCatalog, publicCatalog } from "./service-catalog-store.js?v=20261026-audit1";
import { readBookingLocks } from "./admin-booking-locks.js?v=20261026-audit1";
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const addMinutes=(time,amount)=>{const [h,m]=String(time).split(':').map(Number);const total=h*60+m+amount;return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`};
let db=null;
function ensureDb(){if(db)return db;if(!getApps().length)return null;db=getFirestore(getApp());return db;}
function modal(){let el=document.querySelector('[data-booking-editor-modal]');if(el)return el;el=document.createElement('div');el.className='booking-editor-modal';el.dataset.bookingEditorModal='1';el.hidden=true;document.body.appendChild(el);return el;}
function serviceOptions(current,currentDuration,catalog){
  let html=`<option value="${escapeHtml(current)}" data-duration="${escapeHtml(currentDuration||90)}">目前：${escapeHtml(String(current||'未設定').replace(/\u64a5筋/g,'鬆筋'))}</option>`;
  for(const category of publicCatalog(catalog)){
    const items=category.groups.filter(group=>group.kind!=='addon').flatMap(group=>group.items);
    html+=`<optgroup label="${escapeHtml(category.name)}">${items.map(item=>{
      const value=`${category.name}｜${item.name}`;
      return `<option value="${escapeHtml(value)}" data-duration="${escapeHtml(item.durationMinutes)}">${escapeHtml(value)}｜${escapeHtml(item.durationMinutes)} 分鐘</option>`;
    }).join('')}</optgroup>`;
  }
  return html;
}
function editorState(row){
  return JSON.stringify(['status','preferredDate','preferredTime','lockIds','lockTimes','serviceName','durationMinutes','actualDurationMinutes','bufferMinutes','depositRequired','depositAmount','paymentStatus'].map(key=>row[key]??null));
}
async function saveBookingEdit(firestore,id,original,{keepTimes,keepIds,serviceName,durationMinutes,depositMode,amountRaw}){
  const reservedMinutes=keepTimes.length*30;
  if(!Number.isFinite(durationMinutes)||durationMinutes<=0||durationMinutes>reservedMinutes)throw new Error('BOOKING_DURATION_EXCEEDS_LOCKS');
  if(amountRaw&&(!Number.isFinite(Number(amountRaw))||Number(amountRaw)<0||!Number.isInteger(Number(amountRaw))))throw new Error('INVALID_DEPOSIT_AMOUNT');
  const bookingRef=doc(firestore,'bookings',id);
  await runTransaction(firestore,async tx=>{
    const snapshot=await tx.get(bookingRef);
    if(!snapshot.exists())throw new Error('BOOKING_NOT_FOUND');
    const fresh=snapshot.data();
    if(!['pending_confirmation','pending_payment','confirmed'].includes(fresh.status)||editorState(fresh)!==editorState(original))throw new Error('BOOKING_STATUS_CHANGED');
    const originalIds=Array.isArray(fresh.lockIds)?fresh.lockIds:[];
    const originalTimes=Array.isArray(fresh.lockTimes)?fresh.lockTimes:[];
    if(!keepIds.length||keepIds.some((lockId,index)=>lockId!==originalIds[index]||keepTimes[index]!==originalTimes[index]))throw new Error('BOOKING_STATUS_CHANGED');
    const locks=await readBookingLocks(tx,firestore,id,fresh,{requireOwned:true});
    const keep=new Set(keepIds);
    locks.filter(lock=>!keep.has(lock.ref.id)).forEach(lock=>tx.delete(lock.ref));
    const update={serviceName,durationMinutes,actualDurationMinutes:durationMinutes,bufferMinutes:reservedMinutes-durationMinutes,lockTimes:keepTimes,lockIds:keepIds,slotEnd:addMinutes(keepTimes[keepTimes.length-1],30),updatedAt:serverTimestamp()};
    if(depositMode==='no'){update.depositRequired=false;update.depositAmount=null;update.paymentStatus='not_requested';if(fresh.status==='pending_payment')update.status='confirmed';}
    else if(depositMode==='yes'){update.depositRequired=true;update.depositAmount=amountRaw?Number(amountRaw):null;if(fresh.paymentStatus!=='paid')update.paymentStatus='not_requested';}
    else if(depositMode==='paid'){update.depositRequired=true;update.depositAmount=amountRaw?Number(amountRaw):fresh.depositAmount??null;update.paymentStatus='paid';if(fresh.status==='pending_payment')update.status='confirmed';}
    tx.update(bookingRef,update);
  });
}
async function openEditor(id){const firestore=ensureDb();if(!firestore)return alert('後台資料尚未準備完成。');const snap=await getDoc(doc(firestore,'bookings',id));if(!snap.exists())return alert('找不到這筆預約。');const row={id,...snap.data()};if(!['pending_confirmation','pending_payment','confirmed'].includes(row.status))return alert('這筆預約已結束，無法再編輯。');let catalog=[];try{catalog=await loadCatalog();}catch(error){console.error(error);}const locks=Array.isArray(row.lockTimes)&&row.lockTimes.length?row.lockTimes:[row.preferredTime].filter(Boolean);const ids=Array.isArray(row.lockIds)?row.lockIds:locks.map(t=>`${row.preferredDate}_${String(t).replace(':','')}`);const host=modal();host.hidden=false;host.innerHTML=`<div class="booking-editor-backdrop" data-editor-close></div><section class="booking-editor-card" role="dialog" aria-modal="true"><header><div><span class="tag">EDIT BOOKING</span><h3>編輯預約</h3><p>${escapeHtml(row.customerName||'未命名')} · ${escapeHtml(row.preferredDate||'')} ${escapeHtml(row.preferredTime||'')}</p></div><button type="button" class="editor-x" data-editor-close>×</button></header><div class="booking-editor-grid"><label>操作項目<select data-editor-service>${serviceOptions(row.serviceName||'',row.actualDurationMinutes??row.durationMinutes,catalog)}</select></label><label>定金<select data-editor-deposit><option value="keep">維持目前</option><option value="no">不收定金</option><option value="yes">需收定金</option><option value="paid">已收定金</option></select></label><label>定金金額<input type="number" min="0" step="1" data-editor-deposit-amount value="${escapeHtml(row.depositAmount??'')}" placeholder="例如 500"></label></div><div class="editor-slots"><b>保留時段</b><p>依原本預約的半小時時段呈現，預設全勾。最後一格也可能是環境整理／顧客善後時段；若確認可以提早釋出，可從最後一格開始取消。</p><div>${locks.map((time,i)=>`<label><input type="checkbox" data-editor-lock value="${escapeHtml(time)}" data-lock-id="${escapeHtml(ids[i]||`${row.preferredDate}_${String(time).replace(':','')}`)}" checked><span>${escapeHtml(time)}</span></label>`).join('')}</div></div><p class="editor-message" data-editor-message></p><footer><button type="button" class="btn" data-editor-close>取消</button><button type="button" class="btn dark" data-editor-save>儲存修改</button></footer></section>`;
 host.querySelectorAll('[data-editor-close]').forEach(x=>x.onclick=()=>{host.hidden=true;host.innerHTML=''});
 host.querySelector('[data-editor-save]').onclick=async()=>{const button=host.querySelector('[data-editor-save]');const message=host.querySelector('[data-editor-message]');const checks=[...host.querySelectorAll('[data-editor-lock]')];const selected=checks.filter(x=>x.checked);if(!selected.length){message.textContent='至少要保留一個半小時時段。';return}const firstUnchecked=checks.findIndex(x=>!x.checked);if(firstUnchecked>=0&&checks.slice(firstUnchecked).some(x=>x.checked)){message.textContent='時段只能從最後一格往前釋出，不能在中間留下空洞。';return}button.disabled=true;button.textContent='儲存中…';message.textContent='';try{const keepTimes=selected.map(x=>x.value);const keepIds=selected.map(x=>x.dataset.lockId);const serviceSelect=host.querySelector('[data-editor-service]');const serviceName=serviceSelect.value;const durationMinutes=Number(serviceSelect.selectedOptions[0]?.dataset.duration||row.durationMinutes||90);const depositMode=host.querySelector('[data-editor-deposit]').value;const amountRaw=host.querySelector('[data-editor-deposit-amount]').value.trim();await saveBookingEdit(firestore,id,row,{keepTimes,keepIds,serviceName,durationMinutes,depositMode,amountRaw});message.textContent='已儲存，取消勾選的尾端時段已釋出。';setTimeout(()=>{host.hidden=true;host.innerHTML=''},650)}catch(error){console.error(error);message.textContent=error.message==='BOOKING_DURATION_EXCEEDS_LOCKS'?'保留時段不足以完成此項服務，請保留足夠時段或重新安排預約。':error.message==='INVALID_DEPOSIT_AMOUNT'?'定金金額請填寫零以上的整數。':['BOOKING_STATUS_CHANGED','BOOKING_LOCK_CONFLICT'].includes(error.message)?'這筆預約或保留時段已變更，請關閉後重新開啟。':'儲存失敗，請稍後再試。'}finally{button.disabled=false;button.textContent='儲存修改'}};
}
function enhanceRows(){document.querySelectorAll('.adminacts').forEach(cell=>{if(cell.querySelector('[data-booking-edit]'))return;const source=cell.querySelector('[data-id]');if(!source)return;const button=document.createElement('button');button.type='button';button.textContent='編輯';button.dataset.bookingEdit=source.dataset.id;button.className='admin-edit-button';button.onclick=()=>openEditor(button.dataset.bookingEdit);cell.prepend(button)});}
new MutationObserver(()=>queueMicrotask(enhanceRows)).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
enhanceRows();
