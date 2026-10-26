import { operationErrorText } from "./interface-copy.js?v=20261026-audit1";
import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { DEFAULT_RECORD_ENDPOINT, recordRequest, encodeRecordFile, recordCapability } from "./customer-record-upload-api.js?v=20261026-audit1";
import { showUploadQueue } from "./customer-record-progress.js?v=20261026-audit1";

let dialog=null,endpoint=DEFAULT_RECORD_ENDPOINT,session=null,generation=0,pollTimer=null,polling=false,busy=false,opener=null,prepared=null,creating=null,qrLoading=null,watching=false,watchStarted=0;
let transfer=null,navigating=false;
const urls=new Map();
const status=message=>{if(dialog?.open)dialog.querySelector('[data-record-status]').textContent=message;};
function setBusy(value){busy=value;if(dialog){dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('[data-record-manual],[data-record-direct],[data-record-device],.record-scan').forEach(button=>button.disabled=value);}}
function openRecordPage(fileId=''){
  if(transfer&&transfer.completed<transfer.jobs.length&&!confirm('仍有未確認的檔案，離開後無法繼續傳送。確定先開啟表格？'))return;
  if(navigating)return;navigating=true;watching=false;clearTimeout(pollTimer);
  const url=new URL('./customer-record.html',location.href);
  if(session&&session.expiresAt>Date.now())url.searchParams.set('session',session.sessionId);
  if(fileId)url.searchParams.set('file',fileId);
  if(fileId){setBusy(true);status('正在開啟顧客資料表並辨識檔案…');}
  location.assign(url.href);
}
async function request(action,body={},options) {
  const user=getAuth(getApp()).currentUser;
  if(!user||user.isAnonymous)throw new Error('請先登入管理後台。');
  const sessionId=session?.sessionId,target=endpoint;
  return recordRequest(target,action,{idToken:await user.getIdToken(),sessionId,...body},options);
}
function releaseFiles(){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
function renderFiles(files){
  const list=dialog.querySelector('[data-record-files]');
  for(const file of files){
    if(Array.from(list.children).some(row=>row.dataset.id===file.id))continue;
    const row=document.createElement('li');row.dataset.id=file.id;
    const name=document.createElement('strong');name.textContent=file.name+'（'+Math.ceil(file.size/1024)+' KB）';
    const scan=document.createElement('button');scan.type='button';scan.className='record-button record-scan';scan.textContent='辨識並套用';scan.disabled=busy;
    scan.onclick=()=>{if(!busy)openRecordPage(file.id);};
    const download=document.createElement('button');download.type='button';download.className='record-button';download.textContent='下載檔案';
    download.onclick=async()=>{
      const turn=generation;download.disabled=true;
      try{
        let url=urls.get(file.id);
        if(!url){const result=await request('record_download',{fileId:file.id});if(turn!==generation)return;const bytes=Uint8Array.from(atob(result.file.data),x=>x.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));urls.set(file.id,url);}
        const link=document.createElement('a');link.href=url;link.download=file.name;link.click();
      }catch(error){if(turn===generation)status(operationErrorText(error));}finally{download.disabled=false;}
    };
    row.append(name,download,scan);list.append(row);
  }
}
function prepare(){
  if(prepared)return prepared;
  prepared=(async()=>{
    const user=getAuth(getApp()).currentUser;
    if(!user||user.isAnonymous)throw new Error('請先登入管理後台。');
    const [settings,idToken]=await Promise.all([getDoc(doc(getFirestore(getApp()),'settings','general')),user.getIdToken()]);
    const data=settings.exists()?settings.data():{},configured=String(data.customerRecordUploadUrl||data.appsScriptEmailUrl||'').trim();
    return {idToken,endpoint:!configured||configured==='https://script.google.com/macros/s/AKfycby1y-oojBtmNsT8T1UPMydCTPkaZIjRss7QvxXkWi2duOs4mKI8p3tbIzvhi2xwd_Zb/exec'?DEFAULT_RECORD_ENDPOINT:configured};
  })().catch(error=>{prepared=null;throw error;});
  return prepared;
}
async function ensureSession(){
  if(session&&session.expiresAt>Date.now())return session;
  if(creating)return creating;
  const turn=generation;
  const pending=(async()=>{
    const ready=await prepare();endpoint=ready.endpoint;
    const user=getAuth(getApp()).currentUser;
    if(!user||user.isAnonymous)throw new Error('請先登入管理後台。');
    const created=await recordRequest(ready.endpoint,'record_create',{idToken:await user.getIdToken()});
    if(turn!==generation){recordRequest(ready.endpoint,'record_close',{idToken:await user.getIdToken(),sessionId:created.sessionId}).catch(()=>{});throw new Error('視窗已關閉。');}
    session=created;return session;
  })().finally(()=>{if(creating===pending)creating=null;});
  creating=pending;return pending;
}
function schedulePoll(turn=generation){
  clearTimeout(pollTimer);
  if(watching&&dialog?.open&&turn===generation)pollTimer=setTimeout(poll,document.hidden?15000:Date.now()-watchStarted<60000?2000:5000);
}
async function poll(){
  if(!dialog?.open||!session||polling)return;
  if(Date.now()>session.expiresAt){watching=false;status('上傳連結已到期，請重新開啟視窗以上傳。');return;}
  polling=true;const turn=generation;
  try{
    const result=await request('record_list');if(turn!==generation)return;
    const before=dialog.querySelector('[data-record-files]').children.length;renderFiles(result.files);
    if(result.files.length>before&&!busy){
      status('檔案已上傳，正在開啟資料表並辨識…');
      if(watching)openRecordPage(result.files[0].id);
    }
  }catch(error){if(turn===generation&&!busy)status(operationErrorText(error));}
  finally{polling=false;schedulePoll(turn);}
}
function loadQR(){
  if(window.qrcode)return Promise.resolve();
  if(qrLoading)return qrLoading;
  qrLoading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='../assets/vendor/qrcode-generator.js?v=20261026-audit1';script.onload=resolve;script.onerror=()=>{script.remove();qrLoading=null;reject(new Error('QR Code 載入失敗，請稍後再試。'));};document.head.appendChild(script);});return qrLoading;
}
async function showQR(){
  if(busy)return;setBusy(true);const turn=generation;status('正在建立上傳 QR Code…');
  try{
    await Promise.all([ensureSession(),loadQR()]);if(turn!==generation)return;
    const url=new URL('./record-upload.html',location.href);url.hash=new URLSearchParams({session:session.sessionId,key:session.uploadKey,endpoint}).toString();
    const code=window.qrcode(0,'M');code.addData(url.href);code.make();
    const box=dialog.querySelector('[data-record-qr]');box.replaceChildren();
    const graphic=document.createElement('div');graphic.innerHTML=code.createSvgTag({cellSize:4,margin:4,scalable:true});
    const caption=document.createElement('p');caption.textContent='使用其他裝置掃描 QR Code 上傳；20 分鐘內有效，關閉此視窗即失效。';
    box.append(graphic,caption);box.hidden=false;status('等待其他裝置上傳…');watching=true;watchStarted=Date.now();schedulePoll(turn);
  }catch(error){if(turn===generation)status(operationErrorText(error));}finally{if(turn===generation)setBusy(false);}
}
async function upload(files){
  if(busy||!files.length)return;
  if(files.length>8){status('一次最多選取 8 個檔案。');return;}
  const queue=showUploadQueue(dialog.querySelector('[data-upload-queue]'),files);
  transfer={turn:generation,capability:recordCapability(),jobs:files.map(file=>({file,encoded:null,accepted:false})),queue,completed:0};
  return continueUpload();
}
async function continueUpload(){
  if(!transfer||busy)return;
  const batch=transfer,turn=batch.turn,{jobs,queue}=batch;setBusy(true);dialog.querySelector('[data-upload-retry]').hidden=true;
  const files=jobs.map(job=>job.file);
  status('已選取 '+files.length+' 個檔案，正在準備上傳…');
  // One authenticated request creates/reuses staging and saves the original; no separate create round trip.
  const connected=prepare();connected.catch(()=>{});
  try{
    for(let index=0;index<jobs.length;index++){
      if(turn!==generation)return;
      const job=jobs[index];if(job.accepted)continue;
      if(!job.encoded){queue.update(index,'reading');job.encoded=await encodeRecordFile(job.file,{onProgress:(loaded,total)=>{if(turn===generation)queue.update(index,'reading','',loaded,total);},onState:state=>{if(turn===generation)queue.update(index,state);}});}
      queue.update(index,'ready');const ready=await connected;if(turn!==generation)return;endpoint=ready.endpoint;
      const user=getAuth(getApp()).currentUser;if(!user||user.isAnonymous)throw new Error('請先登入管理後台。');
      const result=await recordRequest(endpoint,'record_submit',{idToken:await user.getIdToken(),...batch.capability,file:job.encoded},{onState:state=>{if(turn===generation&&state!=='accepted')queue.update(index,state);}});
      if(turn!==generation){recordRequest(endpoint,'record_close',{idToken:await user.getIdToken(),sessionId:result.sessionId}).catch(()=>{});return;}
      if(!result.uploaded||!result.verified||!result.file)throw new Error('尚未取得原檔儲存確認，請按「繼續上傳」。');
      session=result;job.accepted=true;job.serverFile=result.file;job.encoded=null;job.file=null;batch.completed++;
      queue.update(index,'accepted');renderFiles([result.file]);
    }
    if(turn===generation){status('檔案已上傳，正在辨識並帶入表格…');openRecordPage(jobs[0].serverFile.id);}
  }catch(error){if(turn===generation){queue.update(batch.completed,'failed',operationErrorText(error));status('已上傳 '+batch.completed+' 個。'+operationErrorText(error)+' 未完成的檔案仍保留在此頁，請按「繼續上傳」；關閉或重新整理會清除尚未確認的檔案。');dialog.querySelector('[data-upload-retry]').hidden=false;}}
  finally{if(turn===generation&&!navigating)setBusy(false);}
}
function openImport(button){
  if(dialog?.open)return;
  opener=button;generation++;session=null;prepared=null;creating=null;watching=false;polling=false;busy=false;transfer=null;navigating=false;clearTimeout(pollTimer);
  dialog?.remove();releaseFiles();
  dialog=document.createElement('dialog');dialog.className='record-modal';dialog.setAttribute('aria-labelledby','record-title');
  dialog.innerHTML='<header class="record-head"><h2 id="record-title">新增紀錄</h2><button type="button" data-record-close aria-label="關閉">×</button></header><div class="record-methods"><button type="button" data-record-manual>手動輸入</button><button type="button" data-record-direct>直接上傳</button><button type="button" data-record-device>透過其他裝置上傳</button></div><input type="file" multiple hidden data-record-picker><p>選取檔案後會自動上傳，接著開啟資料表、辨識並帶入資料。每個檔案最多 5 MB，最多 8 個；多個檔案會先帶入第一份，其他檔案可在表格中選擇核對。</p><p class="record-status" role="status" aria-live="polite" data-record-status></p><button class="record-button" type="button" data-upload-retry hidden>繼續上傳</button><ul class="record-files" data-upload-queue hidden></ul><div class="record-qr" data-record-qr hidden></div><ul class="record-files" data-record-files></ul>';
  document.body.appendChild(dialog);
  const picker=dialog.querySelector('[data-record-picker]');
  dialog.querySelector('[data-record-manual]').onclick=()=>openRecordPage();
  dialog.querySelector('[data-record-direct]').onclick=()=>picker.click();
  picker.onchange=()=>{const files=Array.from(picker.files||[]);picker.value='';if(!files.length)return;if(transfer&&transfer.completed<transfer.jobs.length){if(!confirm('改選會結束這批上傳，這批檔案不再帶入新表格。確定改選？'))return;if(session)request('record_close').catch(()=>{});session=null;dialog.querySelector('[data-record-files]').replaceChildren();}upload(files);};
  dialog.querySelector('[data-upload-retry]').onclick=continueUpload;
  dialog.querySelector('[data-record-device]').onclick=showQR;
  const close=()=>{if(transfer&&transfer.completed<transfer.jobs.length&&!confirm('仍有未確認的檔案，關閉後無法繼續傳送。確定關閉？'))return;dialog.close();};
  dialog.querySelector('[data-record-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{
    generation++;watching=false;clearTimeout(pollTimer);releaseFiles();
    if(session)request('record_close').catch(()=>{});
    session=null;prepared=null;transfer=null;opener?.focus();
  },{once:true});
  dialog.showModal();prepare().catch(()=>{});
  for(const [rel,href] of [['modulepreload','../assets/customer-record-page-form.js?v=20261026-audit1'],['prefetch','./customer-record.html']]){
    if(!Array.from(document.querySelectorAll('link[href]')).some(link=>link.getAttribute('href')===href)){const link=document.createElement('link');link.rel=rel;link.href=href;document.head.append(link);}
  }
}
window.addEventListener('beforeunload',event=>{if(!navigating&&transfer&&transfer.completed<transfer.jobs.length){event.preventDefault();event.returnValue='';}});
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-paper-import]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();openImport(button);
},true);
function renameEntry(){document.querySelectorAll('[data-paper-import]').forEach(button=>{if(button.textContent!=='新增紀錄')button.textContent='新增紀錄';});}
new MutationObserver(renameEntry).observe(document.body,{childList:true,subtree:true});renameEntry();
