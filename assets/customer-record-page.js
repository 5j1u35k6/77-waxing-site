import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc, getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { mountRecordForm } from './customer-record-page-form.js?v=20261023-tw1';
import { recordFields } from './customer-record-fields.js?v=20261023-paper';
import { saveCustomerRecord, loadCustomerRecord } from './customer-record-store.js?v=20261023-tw1';
import { DEFAULT_RECORD_ENDPOINT, recordRequest } from './customer-record-upload-api.js?v=20261023-auto5';

const status=document.querySelector('[data-page-status]'),host=document.querySelector('[data-record-page]'),params=new URLSearchParams(location.search);
// Older cached HTML remains usable while the new page and module deploy separately.
if(!document.querySelector('[data-source-summary]')){
  const summary=document.createElement('section');summary.className='record-source-summary';summary.dataset.sourceSummary='';summary.hidden=true;
  summary.innerHTML='<p role="status" aria-live="polite" data-source-summary-text></p><progress aria-label="文字辨識處理中" data-source-progress hidden></progress><button class="record-button" type="button" data-source-retry hidden>重新辨識</button>';host.before(summary);
}
if(!document.querySelector('[data-source-list-status]')){const note=document.createElement('p');note.dataset.sourceListStatus='';note.setAttribute('role','status');document.querySelector('[data-source-files]').before(note);}
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
let dirty=false,saving=false,saved=false,editor=null,user=null,endpoint=DEFAULT_RECORD_ENDPOINT,pollTimer=null,sourcePolling=false,scanning=false;
let activeFile='',lastFailedFile='';const recognized=new Map();
let sourceExpiresAt=Date.now()+20*60*1000,sourceStopped=false,sourceFailures=0;
const sourceSession=/^[\da-f-]{36}$/.test(params.get('session')||'')?params.get('session'):'';
const recordId=params.get('record')||'paper_'+crypto.randomUUID();
const message=value=>{const node=host.querySelector('[data-save-message]');if(node)node.textContent=value;};
const sourceStatus=value=>{document.querySelector('[data-source-status]').textContent=value?'檔案處理：'+value:'';document.querySelector('[data-source-summary-text]').textContent=value;};
window.addEventListener('beforeunload',e=>{if(dirty&&!saved){e.preventDefault();e.returnValue='';}});
const sourceRequest=async(action,body={})=>recordRequest(endpoint,action,{idToken:await user.getIdToken(),sessionId:sourceSession,...body});
async function closeSource(){clearTimeout(pollTimer);if(sourceSession)await sourceRequest('record_close').catch(()=>{});}
function setScanning(value){
  scanning=value;document.querySelector('[data-source-progress]').hidden=!value;
  document.querySelector('[data-source-summary]').setAttribute('aria-busy',String(value));
  document.querySelectorAll('[data-scan-file]').forEach(button=>{button.disabled=value||saved;button.textContent=value&&button.dataset.scanFile===activeFile?'辨識中…':'辨識並套用';});
  document.querySelector('[data-source-retry]').hidden=value||!lastFailedFile||saved;
}
async function scanSource(fileId){
  if(scanning||saved)return;activeFile=fileId;setScanning(true);sourceStatus('原檔已上傳，正在辨識並套用；不必重複上傳…');
  try{
    const text=recognized.has(fileId)?recognized.get(fileId):(await recordRequest(endpoint,'record_scan',{idToken:await user.getIdToken(),sessionId:sourceSession,fileId},{onState:state=>{if(state==='retrying')sourceStatus('辨識連線暫時中斷，正在重新連接；原檔已保留…');}})).text;
    if(!String(text||'').trim())throw new Error('原檔已保留，但未辨識到文字。請換一張清晰照片或手動填寫。');
    recognized.set(fileId,text);lastFailedFile='';
    if(!saved){editor.apply(recordFields(text),text);sourceStatus('辨識完成。請核對資料；人工修改、同意及簽名不會被自動覆蓋。');}
  }catch(error){lastFailedFile=fileId;sourceStatus(error.code==='transport'?'原檔上傳與文字辨識是分開的：辨識連線中斷，請按「重新辨識」，不必重傳原檔。':error.message);}
  finally{setScanning(false);}
}
function scheduleSources(){clearTimeout(pollTimer);if(sourceSession&&!saved&&!sourceStopped)pollTimer=setTimeout(listSources,sourceFailures?Math.min(30000,sourceFailures*10000):document.hidden?15000:5000);}
async function listSources(){
  if(!sourceSession||sourcePolling||saved||sourceStopped)return;
  if(Date.now()>sourceExpiresAt){sourceStopped=true;document.querySelector('[data-source-list-status]').textContent='暫存連結已到期，已停止背景連線；表格內已帶入的資料仍保留，請核對並正式儲存。';return;}
  if(scanning){scheduleSources();return;}sourcePolling=true;
  try{
    const result=await sourceRequest('record_list'),list=document.querySelector('[data-source-files]');
    if(result.expiresAt)sourceExpiresAt=result.expiresAt;sourceFailures=0;
    for(const file of result.files){
      if(Array.from(list.children).some(e=>e.dataset.id===file.id))continue;
      const item=document.createElement('li');item.dataset.id=file.id;const name=document.createElement('strong');name.textContent=file.name;
      const button=document.createElement('button');button.type='button';button.className='record-button';button.dataset.scanFile=file.id;button.textContent='辨識並套用';button.disabled=scanning||saved;button.onclick=()=>scanSource(file.id);item.append(name,button);list.appendChild(item);
    }
    document.querySelector('[data-source-list-status]').textContent='';
  }catch(error){sourceFailures++;if(['session_expired','admin_required'].includes(error.code))sourceStopped=true;document.querySelector('[data-source-list-status]').textContent='檔案清單暫時無法更新；這不代表辨識失敗。'+error.message;}
  finally{sourcePolling=false;scheduleSources();}
}
async function save(){
  if(saving||saved)return;saving=true;editor.setBusy(true);message('正在寫入並向伺服器確認…');
  try{
    const record=await saveCustomerRecord(db,user,recordId,editor.data(),editor.signature);
    saved=true;dirty=false;editor.load(record);message('已正式儲存，重新整理後仍可檢視。顧客資料清單與歷史紀錄已同步。');
    const url=new URL(location.href);url.search='';url.searchParams.set('record',record.id);history.replaceState(null,'',url);
    closeSource();document.querySelector('[data-source-panel]').hidden=true;
  }catch(error){message(error.message||'儲存失敗，資料仍保留在本頁，請再試一次。');}
  finally{saving=false;editor.setBusy(false);}
}
async function boot(){
  try{
    await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();user=auth.currentUser;
    if(!user||user.isAnonymous)throw new Error('請先在管理後台登入，再重新載入本頁。');
    const settingsReady=sourceSession?getDoc(doc(db,'settings','general')):null;if(settingsReady)settingsReady.catch(()=>{});
    const admin=await getDoc(doc(db,'admins',user.uid));if(!admin.exists())throw new Error('此頁僅供管理員使用。');
    editor=mountRecordForm(host,{onDirty:()=>{if(!saved)dirty=true;},onSave:save});
    const openingSaved=params.has('record');
    host.hidden=openingSaved;status.hidden=!openingSaved;
    if(openingSaved)status.textContent='正在讀取顧客紀錄…';
    onAuthStateChanged(auth,current=>{if(!current||current.uid!==user.uid){dirty=false;clearInterval(pollTimer);document.querySelector('.paper-signature-dialog')?.close();host.hidden=true;document.querySelector('[data-source-panel]').hidden=true;location.replace('./');}});
    host.querySelector('[data-record-back]').onclick=async e=>{
      e.preventDefault();if(saving)return;if(dirty&&!saved&&!confirm('尚未儲存，確定返回顧客資料？未儲存內容將清除。'))return;
      dirty=false;closeSource();location.assign('./#customers');
    };
    if(openingSaved){const record=await loadCustomerRecord(db,recordId);if(auth.currentUser?.uid!==user.uid)return;editor.load(record);saved=true;dirty=false;host.hidden=false;status.hidden=true;return;}
    if(sourceSession){
      document.querySelector('[data-source-summary]').hidden=false;
      document.querySelector('[data-source-summary]').setAttribute('aria-busy','true');
      document.querySelector('[data-source-progress]').hidden=false;
      sourceStatus('正在讀取上傳檔案，準備辨識…');
      const settings=await settingsReady,data=settings.exists()?settings.data():{};
      const configured=String(data.customerRecordUploadUrl||data.appsScriptEmailUrl||'').trim();
      endpoint=!configured||configured==='https://script.google.com/macros/s/AKfycby1y-oojBtmNsT8T1UPMydCTPkaZIjRss7QvxXkWi2duOs4mKI8p3tbIzvhi2xwd_Zb/exec'?DEFAULT_RECORD_ENDPOINT:configured;
      document.querySelector('[data-source-panel]').hidden=false;document.querySelector('[data-source-summary]').hidden=false;
      document.querySelector('[data-source-retry]').onclick=()=>{if(lastFailedFile)scanSource(lastFailedFile);};
      const listing=listSources();
      const file=params.get('file');
      // Scanning validates its own file/session; listing need not block it.
      await Promise.all([listing,file&&/^[\w-]{1,160}$/.test(file)?scanSource(file):Promise.resolve()]);
      if(!scanning){document.querySelector('[data-source-progress]').hidden=true;document.querySelector('[data-source-summary]').setAttribute('aria-busy','false');}
      if(!file)sourceStatus('請在下方選擇檔案進行辨識。');
    }
  }catch(error){host.hidden=true;document.querySelector('[data-source-summary]').hidden=true;document.querySelector('[data-source-progress]').hidden=true;status.hidden=false;status.replaceChildren();const text=document.createElement('p');text.textContent=error.message||'無法載入顧客資料表。';const back=document.createElement('a');back.href='./#customers';back.textContent='返回管理後台';status.append(text,back);}
}
boot();
