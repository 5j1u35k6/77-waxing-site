import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { recordPayload, RECORD_KIND } from './customer-record-data.js?v=20261023-record-page';

export async function saveCustomerRecord(db,user,id,data,signaturePng=''){
  if(!user||user.isAnonymous)throw new Error('請先登入管理員帳號。');
  if(!/^paper_[\da-f-]{36}$/.test(id))throw new Error('紀錄編號無效，請重新開啟表單。');
  const payload=recordPayload(data,signaturePng);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
  const payloadHash=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
  const ref=doc(db,'customers',id);
  await runTransaction(db,async tx=>{
    const existing=await tx.get(ref);
    if(existing.exists()){
      const saved=existing.data();
      if(saved.kind!==RECORD_KIND||saved.createdBy!==user.uid||saved.payloadHash!==payloadHash)throw new Error('這個紀錄編號已有已儲存的內容，不會覆寫。請重新開啟表單建立另一份紀錄。');
      return;
    }
    tx.set(ref,{...payload,payloadHash,createdBy:user.uid,createdAt:serverTimestamp()});
  });
  const verified=await getDocFromServer(ref);
  if(!verified.exists()||verified.data().payloadHash!==payloadHash)throw new Error('尚未確認伺服器儲存結果，請在同一頁再試一次，避免重複新增。');
  return {id,...verified.data()};
}
export async function loadCustomerRecord(db,id){
  if(!/^paper_[\da-f-]{36}$/.test(id))throw new Error('紀錄編號無效。');
  const saved=await getDocFromServer(doc(db,'customers',id));
  if(!saved.exists()||saved.data().kind!==RECORD_KIND)throw new Error('找不到這份顧客資料表。');
  return {id,...saved.data()};
}
