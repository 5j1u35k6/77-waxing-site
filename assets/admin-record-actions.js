import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let db=null;
let bookings=[];
let scheduled=false;

const normalizePhone=value=>String(value||'').replace(/[^0-9+]/g,'').trim();

function ensureDb(){
  if(db)return db;
  if(!getApps().length)return null;
  db=getFirestore(getApp());
  return db;
}

async function commitDeletes(refs){
  const firestore=ensureDb();
  if(!firestore||!refs.length)return;
  const unique=[...new Map(refs.map(ref=>[ref.path,ref])).values()];
  for(let i=0;i<unique.length;i+=400){
    const batch=writeBatch(firestore);
    unique.slice(i,i+400).forEach(ref=>batch.delete(ref));
    await batch.commit();
  }
}

async function deleteBooking(id){
  const firestore=ensureDb();
  if(!firestore)return alert('後台資料尚未準備完成。');
  const snap=await getDoc(doc(firestore,'bookings',id));
  if(!snap.exists())return alert('這筆預約已不存在。');
  const row=snap.data();
  const label=`${row.customerName||'未命名'}｜${row.preferredDate||''} ${row.preferredTime||''}`;
  if(!confirm(`確定永久刪除這筆預約？\n${label}\n\n對應的保留時段也會一起釋放。此操作無法復原。`))return;
  const refs=[doc(firestore,'bookings',id)];
  (Array.isArray(row.lockIds)?row.lockIds:[]).forEach(lockId=>refs.push(doc(firestore,'availabilityLocks',lockId)));
  await commitDeletes(refs);
}

async function deleteCustomer(phone,name){
  const firestore=ensureDb();
  if(!firestore)return alert('後台資料尚未準備完成。');
  const normalized=normalizePhone(phone);
  const linked=bookings.filter(row=>normalizePhone(row.customerPhone)===normalized);
  if(!confirm(`確定永久刪除顧客「${name||phone}」？\n\n此操作會同時刪除這位顧客的 ${linked.length} 筆預約紀錄，並釋放相關保留時段。此操作無法復原。`))return;

  const refs=[];
  linked.forEach(row=>{
    refs.push(doc(firestore,'bookings',row.id));
    (Array.isArray(row.lockIds)?row.lockIds:[]).forEach(lockId=>refs.push(doc(firestore,'availabilityLocks',lockId)));
  });

  for(const collectionName of ['customers','customerPhoneIndex']){
    try{
      const snap=await getDocs(collection(firestore,collectionName));
      snap.docs.forEach(snapshotDoc=>{
        const data=snapshotDoc.data()||{};
        const values=[snapshotDoc.id,data.phone,data.customerPhone,data.mobile,data.phoneNormalized,data.normalizedPhone].map(normalizePhone);
        if(values.includes(normalized))refs.push(snapshotDoc.ref);
      });
    }catch(error){console.warn(`Unable to inspect ${collectionName}`,error);}
  }

  await commitDeletes(refs);
}

function bookingIdForCell(cell){
  const source=cell.querySelector('[data-id]');
  if(source?.dataset.id)return source.dataset.id;
  const tr=cell.closest('tr');
  const cells=tr?.querySelectorAll('td');
  if(!cells||cells.length<5)return '';
  const date=cells[0]?.textContent.trim()||'';
  const start=(cells[1]?.dataset.originalStart||cells[1]?.textContent.match(/\d{2}:\d{2}/)?.[0]||'').slice(0,5);
  const name=cells[2]?.textContent.trim()||'';
  const phone=normalizePhone(cells[3]?.textContent||'');
  return bookings.find(row=>row.preferredDate===date&&String(row.preferredTime||'').slice(0,5)===start&&String(row.customerName||'').trim()===name&&normalizePhone(row.customerPhone)===phone)?.id||'';
}

function enhanceBookingRows(){
  document.querySelectorAll('.adminacts').forEach(cell=>{
    if(cell.querySelector('[data-admin-delete-booking]'))return;
    const id=bookingIdForCell(cell);
    if(!id)return;
    const button=document.createElement('button');
    button.type='button';
    button.className='admin-delete-record';
    button.dataset.adminDeleteBooking=id;
    button.textContent='刪除';
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{await deleteBooking(button.dataset.adminDeleteBooking)}
      catch(error){console.error(error);alert('刪除預約失敗，請稍後再試。')}
      finally{button.disabled=false;}
    });
    cell.appendChild(button);
  });
}

function enhanceCustomerTable(){
  const table=document.querySelector('.customer-table-wrap table');
  if(!table)return;
  const head=table.querySelector('thead tr');
  if(head&&!head.querySelector('[data-customer-action-head]')){
    const th=document.createElement('th');
    th.dataset.customerActionHead='1';
    th.textContent='操作';
    head.appendChild(th);
  }
  table.querySelectorAll('tbody tr').forEach(row=>{
    const cells=row.querySelectorAll('td');
    if(!cells.length||row.querySelector('[data-admin-delete-customer]'))return;
    if(cells.length===1&&cells[0].hasAttribute('colspan')){
      cells[0].colSpan=6;
      return;
    }
    const name=cells[0]?.textContent.trim()||'';
    const phone=cells[1]?.textContent.trim()||'';
    if(!phone)return;
    const td=document.createElement('td');
    const button=document.createElement('button');
    button.type='button';
    button.className='admin-delete-record';
    button.dataset.adminDeleteCustomer=phone;
    button.textContent='刪除顧客';
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{await deleteCustomer(phone,name)}
      catch(error){console.error(error);alert('刪除顧客資料失敗，請稍後再試。')}
      finally{button.disabled=false;}
    });
    td.appendChild(button);
    row.appendChild(td);
  });
}

function apply(){
  scheduled=false;
  enhanceBookingRows();
  enhanceCustomerTable();
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(apply);
}

function start(){
  const firestore=ensureDb();
  if(!firestore)return setTimeout(start,100);
  onSnapshot(collection(firestore,'bookings'),snapshot=>{
    bookings=snapshot.docs.map(snapshotDoc=>({id:snapshotDoc.id,...snapshotDoc.data()}));
    schedule();
  });
  new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  schedule();
}
start();
