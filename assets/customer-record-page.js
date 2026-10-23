import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc, getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { mountRecordForm } from './customer-record-page-form.js?v=20261023-tw1';
import { recordFields } from './customer-record-fields.js?v=20261023-paper';
import { saveCustomerRecord, loadCustomerRecord } from './customer-record-store.js?v=20261023-tw1';
import { DEFAULT_RECORD_ENDPOINT, recordRequest } from './customer-record-upload-api.js?v=20261022';

const status=document.querySelector('[data-page-status]'),host=document.querySelector('[data-record-page]'),params=new URLSearchParams(location.search);
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
let dirty=false,saving=false,saved=false,editor=null,user=null,endpoint=DEFAULT_RECORD_ENDPOINT,pollTimer=null,sourcePolling=false,scanning=false;
const sourceSession=/^[\da-f-]{36}$/.test(params.get('session')||'')?params.get('session'):'';
const recordId=params.get('record')||'paper_'+crypto.randomUUID();
const message=value=>{const node=host.querySelector('[data-save-message]');if(node)node.textContent=value;};
const sourceStatus=value=>document.querySelector('[data-source-status]').textContent=value;
window.addEventListener('beforeunload',e=>{if(dirty&&!saved){e.preventDefault();e.returnValue='';}});
const sourceRequest=async(action,body={})=>recordRequest(endpoint,action,{idToken:await user.getIdToken(),sessionId:sourceSession,...body});
async function closeSource(){clearInterval(pollTimer);if(sourceSession)await sourceRequest('record_close').catch(()=>{});}
async function scanSource(fileId){
  if(scanning||saved)return;scanning=true;sourceStatus('正在辨識並套用…');
  try{const result=await sourceRequest('record_scan',{fileId});if(!saved){editor.apply(recordFields(result.text),result.text);sourceStatus('辨識完成。請核對資料；人工修改、同意及簽名不會被自動覆蓋。');}}
  catch(error){sourceStatus(error.message);}finally{scanning=false;}
}
async function listSources(){
  if(!sourceSession||sourcePolling||saved)return;sourcePolling=true;
  try{
    const result=await sourceRequest('record_list'),list=document.querySelector('[data-source-files]');
    for(const file of result.files){
      if(Array.from(list.children).some(e=>e.dataset.id===file.id))continue;
      const item=document.createElement('li');item.dataset.id=file.id;const name=document.createElement('strong');name.textContent=file.name;
      const button=document.createElement('button');button.type='button';button.className='record-button';button.textContent='辨識並套用';button.onclick=async()=>{button.disabled=true;await scanSource(file.id);button.disabled=saved;};item.append(name,button);list.appendChild(item);
    }
  }catch(error){sourceStatus(error.message);clearInterval(pollTimer);}finally{sourcePolling=false;}
}
async function save(){
  if(saving||saved)return;saving=true;editor.setBusy(true);message('正在寫入並向伺服器確認…');
  try{
    const record=await saveCustomerRecord(db,user,recordId,editor.data(),editor.signature);
    saved=true;dirty=false;editor.load(record);message('已正式儲存，重新整理後仍可檢視。顧客資料清單與歷史紀錄已同步。');
    const url=new URL(location.href);url.search='';url.searchParams.set('record',record.id);history.replaceState(null,'',url);
    await closeSource();document.querySelector('[data-source-panel]').hidden=true;
  }catch(error){message(error.message||'儲存失敗，資料仍保留在本頁，請再試一次。');}
  finally{saving=false;editor.setBusy(false);}
}
async function boot(){
  try{
    await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();user=auth.currentUser;
    if(!user||user.isAnonymous)throw new Error('請先在管理後台登入，再重新載入本頁。');
    const admin=await getDoc(doc(db,'admins',user.uid));if(!admin.exists())throw new Error('此頁僅供管理員使用。');
    editor=mountRecordForm(host,{onDirty:()=>{if(!saved)dirty=true;},onSave:save});host.hidden=false;status.hidden=true;
    onAuthStateChanged(auth,current=>{if(!current||current.uid!==user.uid){dirty=false;clearInterval(pollTimer);document.querySelector('.paper-signature-dialog')?.close();host.hidden=true;document.querySelector('[data-source-panel]').hidden=true;location.replace('./');}});
    host.querySelector('[data-record-back]').onclick=async e=>{
      e.preventDefault();if(saving)return;if(dirty&&!saved&&!confirm('尚未儲存，確定返回顧客資料？未儲存內容將清除。'))return;
      dirty=false;await closeSource();location.assign('./#customers');
    };
    if(params.has('record')){const record=await loadCustomerRecord(db,recordId);editor.load(record);saved=true;dirty=false;return;}
    if(sourceSession){
      const settings=await getDoc(doc(db,'settings','general')),data=settings.exists()?settings.data():{};
      const configured=String(data.customerRecordUploadUrl||data.appsScriptEmailUrl||'').trim();
      endpoint=!configured||configured==='https://script.google.com/macros/s/AKfycby1y-oojBtmNsT8T1UPMydCTPkaZIjRss7QvxXkWi2duOs4mKI8p3tbIzvhi2xwd_Zb/exec'?DEFAULT_RECORD_ENDPOINT:configured;
      document.querySelector('[data-source-panel]').hidden=false;
      const listing=listSources();pollTimer=setInterval(listSources,5000);
      const file=params.get('file');
      // Scanning validates its own file/session; listing need not block it.
      await Promise.all([listing,file&&/^[\w-]{1,160}$/.test(file)?scanSource(file):Promise.resolve()]);
    }
  }catch(error){host.hidden=true;status.hidden=false;status.replaceChildren();const text=document.createElement('p');text.textContent=error.message||'無法載入顧客資料表。';const back=document.createElement('a');back.href='./#customers';back.textContent='返回管理後台';status.append(text,back);}
}
boot();

