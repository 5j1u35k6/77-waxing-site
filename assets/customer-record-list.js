import { normalizeRecordPhone } from './customer-record-data.js?v=20261023-record-page';
export const customerRecordKey=row=>normalizeRecordPhone(row.customerPhone||row.phone||'')||String(row.customerEmail||row.email||'').trim().toLowerCase()||`${row.customerName||row.name||''}|${row.customerLineId||''}`;
let cachedRecords=[];
export function mergeStoredCustomerRecords(map,records){
  cachedRecords=records;
  const sorted=[...records].sort((a,b)=>(Number(a.createdAt?.seconds)||0)-(Number(b.createdAt?.seconds)||0));
  for(const record of sorted){
    const key=customerRecordKey(record);if(!key)continue;
    const current=map.get(key)||{key,name:record.name||'未命名',phone:record.phone||'',birthday:record.birthday||'',lineId:'',lineName:'',email:record.email||'',count:0,last:'',services:new Set()};
    if(!current.name||current.name==='未命名')current.name=record.name;
    for(const field of ['phone','birthday','email'])if(!current[field]&&record[field])current[field]=record[field];
    // A paper LINE entry is not a verified account binding.
    if(!current.lineId&&!current.lineName&&record.line){current.lineId=`紙本：${record.line}`;current.lineName=current.lineId;}
    map.set(key,current);
  }
  return map;
}
if(typeof document!=='undefined')document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-customer-index]');if(!button)return;
  const phone=button.closest('tr')?.querySelectorAll('td')[1]?.textContent||'';
  const related=cachedRecords.filter(r=>normalizeRecordPhone(r.phoneNormalized||r.phone)===normalizeRecordPhone(phone));
  const modal=document.querySelector('[data-customer-history-modal] .admin-customer-body');if(!modal)return;
  modal.querySelector('[data-stored-record-history]')?.remove();
  const section=document.createElement('section');section.className='admin-customer-history';section.dataset.storedRecordHistory='1';
  const title=document.createElement('h4');title.textContent='已儲存顧客資料表';section.appendChild(title);
  if(!related.length){const empty=document.createElement('p');empty.textContent='目前沒有已儲存的顧客資料表。';section.appendChild(empty);}
  for(const record of related.sort((a,b)=>(Number(b.createdAt?.seconds)||0)-(Number(a.createdAt?.seconds)||0))){
    if(!/^paper_[\da-f-]{36}$/.test(record.id))continue;
    const row=document.createElement('p'),link=document.createElement('a');link.href='./customer-record.html?record='+encodeURIComponent(record.id);link.textContent=`${record.consultationDate||'未填諮詢日期'} · 檢視顧客資料表`;const state=document.createElement('small');state.textContent=record.confirmationStatus==='customer_confirmed'?'（本人確認欄位齊全）':'（未完成本人確認）';row.append(link,state);section.appendChild(row);
  }
  modal.appendChild(section);
});
