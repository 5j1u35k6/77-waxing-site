import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { DEFAULT_RECORD_ENDPOINT, recordRequest, encodeRecordFile } from "./customer-record-upload-api.js?v=20261022";
import { recordFields } from "./customer-record-fields.js?v=20261023-paper";
import { createRecordForm } from "./customer-record-form.js?v=20261023-paper";

let dialog=null, endpoint=DEFAULT_RECORD_ENDPOINT, session=null, generation=0, pollTimer=null, polling=false, busy=false;
let opener=null, recordEditor=null;
function openRecordEditor(){if(!recordEditor)recordEditor=createRecordForm();recordEditor.open();return recordEditor;}
const urls=new Map();
const status=(message)=>{if(dialog?.open)dialog.querySelector('[data-record-status]').textContent=message;};
async function request(action,body={}) {
  const user=getAuth(getApp()).currentUser;
  if(!user || user.isAnonymous)throw new Error("請先登入管理後台。");
  // Capture before token refresh yields: close() clears the active session immediately.
  const sessionId=session?.sessionId, target=endpoint;
  return recordRequest(target,action,{idToken:await user.getIdToken(),sessionId,...body});
}
function releaseFiles(){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
function renderFiles(files) {
  const list=dialog.querySelector('[data-record-files]');
  for(const file of files){
    if(Array.from(list.children).some(row=>row.dataset.id===file.id))continue;
    const row=document.createElement('li');row.dataset.id=file.id;
    const name=document.createElement('strong');name.textContent=`${file.name}（${Math.ceil(file.size/1024)} KB）`;
    const scan=document.createElement('button');scan.type='button';scan.className='record-button';scan.textContent='辨識並套用';
    scan.onclick=()=>scanFile(file,scan);
    const download=document.createElement('button');download.type='button';download.className='record-button';download.textContent='下載檔案';
    download.onclick=async()=>{
      const turn=generation;download.disabled=true;
      try{
        const result=await request('record_download',{fileId:file.id});
        if(turn!==generation)return;
        // Always download arbitrary input; never execute uploaded HTML/SVG in this origin.
        let url=urls.get(file.id);
        if(!url){const bytes=Uint8Array.from(atob(result.file.data),x=>x.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));urls.set(file.id,url);}
        const link=document.createElement('a');link.href=url;link.download=file.name;link.click();
      }catch(error){if(turn===generation)status(error.message);}finally{download.disabled=false;}
    };
    row.append(name,download,scan);list.append(row);
  }
}
async function scanFile(file,button) {
  if(busy)return;
  busy=true;button.disabled=true;const turn=generation;
  status(`正在辨識 ${file.name}…`);
  try{
    const result=await request('record_scan',{fileId:file.id});
    if(turn!==generation)return;
    const editor=openRecordEditor();editor.apply(recordFields(result.text),result.text);
    status(result.text?'辨識完成，已開啟完整顧客資料表。請核對文字與勾選項目；人工修改會保留。':'沒有辨識到文字，已開啟完整顧客資料表供手動補齊。');
  }catch(error){if(turn===generation)status(error.message);}
  finally{busy=false;button.disabled=false;}
}
async function ensureSession() {
  if(session && session.expiresAt>Date.now())return;
  const turn=generation;
  const settings=await getDoc(doc(getFirestore(getApp()),'settings','general'));
  const configured=settings.exists()?String(settings.data().customerRecordUploadUrl || settings.data().appsScriptEmailUrl || '').trim():'';
  // Match email-dispatch's migration from the retired deployment.
  endpoint=!configured || configured==='https://script.google.com/macros/s/AKfycby1y-oojBtmNsT8T1UPMydCTPkaZIjRss7QvxXkWi2duOs4mKI8p3tbIzvhi2xwd_Zb/exec'?DEFAULT_RECORD_ENDPOINT:configured;
  const created=await request('record_create');
  if(turn!==generation){await request('record_close',{sessionId:created.sessionId}).catch(()=>{});throw new Error('視窗已關閉。');}
  session=created;
  clearInterval(pollTimer);
  pollTimer=setInterval(poll,4000);
}
async function poll() {
  if(!dialog?.open || !session || polling)return;
  if(Date.now()>session.expiresAt){clearInterval(pollTimer);status('上傳連結已到期。已帶入的表格草稿仍保留，請重新開啟視窗以上傳。');return;}
  polling=true;const turn=generation;
  try{
    const result=await request('record_list');
    if(turn!==generation)return;
    const before=dialog.querySelector('[data-record-files]').children.length;
    renderFiles(result.files);
    if(result.files.length>before)status('已收到上傳檔案，可按「辨識並套用」。');
  }catch(error){if(turn===generation)status(error.message);}
  finally{polling=false;}
}
async function showQR() {
  if(busy)return;busy=true;const turn=generation;
  status('正在建立上傳 QR Code…');
  try {
    await ensureSession();
    // The QR is generated locally; the secret link is never sent to a QR service.
    if(!window.qrcode)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='../assets/vendor/qrcode-generator.js';script.onload=resolve;script.onerror=()=>reject(new Error('QR Code 載入失敗，請稍後重試。'));document.head.appendChild(script);});
    if(turn!==generation)return;
    const url=new URL('./record-upload.html',location.href);url.hash=new URLSearchParams({session:session.sessionId,key:session.uploadKey,endpoint}).toString();
    const code=window.qrcode(0,'M');code.addData(url.href);code.make();
    const box=dialog.querySelector('[data-record-qr]');box.replaceChildren();
    const graphic=document.createElement('div');graphic.innerHTML=code.createSvgTag({cellSize:4,margin:4,scalable:true});
    const caption=document.createElement('p');caption.textContent='使用其他裝置掃碼上傳；20 分鐘內有效，關閉此視窗即失效。';
    box.append(graphic,caption);box.hidden=false;status('等待其他裝置上傳…');
  }catch(error){if(turn===generation)status(error.message);}finally{busy=false;}
}
async function upload(files) {
  if(busy || !files.length)return;
  if(files.length>8){status('一次最多選取 8 個檔案。');return;}
  busy=true;const turn=generation;
  try{
    await ensureSession();
    for(const file of files){
      if(turn!==generation)return;
      status(`正在上傳 ${file.name}…`);
      await recordRequest(endpoint,'record_upload',{sessionId:session.sessionId,uploadKey:session.uploadKey,file:await encodeRecordFile(file)});
    }
    await poll();
    if(turn===generation)status('上傳完成，請按檔案旁的「辨識並套用」。');
  }catch(error){if(turn===generation)status(error.message);}finally{busy=false;}
}
function openImport(button) {
  if(dialog?.open)return;
  opener=button;generation++;session=null;busy=false;
  dialog?.remove();recordEditor?.remove();recordEditor=null;releaseFiles();
  dialog=document.createElement('dialog');dialog.className='record-modal';dialog.setAttribute('aria-labelledby','record-title');
  dialog.innerHTML=`<header class="record-head"><h2 id="record-title">新增紀錄</h2><button type="button" data-record-close aria-label="關閉">×</button></header><div class="record-methods"><button type="button" data-record-manual>手動輸入</button><button type="button" data-record-direct>直接上傳</button><button type="button" data-record-device>透過其他裝置上傳</button></div><input type="file" multiple hidden data-record-picker><p>可上傳任何格式的檔案或照片，每個檔案最多 5 MB，最多 8 個。照片、PDF、Word 與文字檔可嘗試辨識；辨識後會開啟完整顧客資料表供核對。</p><p class="record-status" role="status" aria-live="polite" data-record-status></p><div class="record-qr" data-record-qr hidden></div><ul class="record-files" data-record-files></ul>`;
  document.body.appendChild(dialog);
  const picker=dialog.querySelector('[data-record-picker]');
  dialog.querySelector('[data-record-manual]').onclick=openRecordEditor;
  dialog.querySelector('[data-record-direct]').onclick=()=>picker.click();
  picker.onchange=()=>{const files=Array.from(picker.files||[]);picker.value='';upload(files);};
  dialog.querySelector('[data-record-device]').onclick=showQR;
  dialog.querySelector('[data-record-close]').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
  dialog.addEventListener('close',()=>{
    generation++;clearInterval(pollTimer);releaseFiles();
    recordEditor?.remove();recordEditor=null;
    if(session)request('record_close').catch(()=>{});
    session=null;opener?.focus();
  },{once:true});
  dialog.showModal();
}
// Capture the existing entry point without interfering with the customer page's data listeners.
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-paper-import]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();openImport(button);
},true);
function renameEntry(){document.querySelectorAll('[data-paper-import]').forEach(button=>{if(button.textContent!=='新增紀錄')button.textContent='新增紀錄';});}
new MutationObserver(renameEntry).observe(document.body,{childList:true,subtree:true});renameEntry();
