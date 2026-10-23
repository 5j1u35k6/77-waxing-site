// Private Drive storage. Reuses IdentityLink.gs authentication and admin lookup.
const RECORD_TTL_MS = 20 * 60 * 1000;
const RECORD_MAX_BYTES = 5 * 1024 * 1024;

function routeCustomerRecordsPost_(payload) {
  if (!/^record_/.test(String(payload.action || ''))) return null;
  try {
    const result = recordAction_(payload);
    return json_(Object.assign({ok:true, service:'customer-records-v1'}, result));
  } catch (error) {
    console.error('customer record request failed', String(error.message));
    const messages = {
      admin_required:'請以管理員帳號重新登入。', session_expired:'上傳連結已失效，請重新產生 QR Code。',
      invalid_file:'檔案內容有誤，或已超過 5 MB。', file_limit:'此連結最多可上傳 8 個檔案。',
      file_missing:'找不到這個檔案。', unsupported:'這個格式已儲存，但目前無法辨識文字。',
      busy:'上傳服務忙碌中，請稍後再試。'
    };
    return json_({ok:false, service:'customer-records-v1', message:messages[error.message] || '處理失敗，請稍後再試；若持續發生，請檢查上傳服務的 Drive 授權與部署版本。'});
  }
}

function recordAdmin_(p) {
  const user = firebaseLookupUser_(String(p.idToken || ''));
  if (!identityAdminGetDoc_('admins', user.uid)) throw new Error('admin_required');
  return user.uid;
}
function recordRoot_() {
  const props=PropertiesService.getScriptProperties();
  const configured=props.getProperty('CUSTOMER_RECORD_FOLDER_ID');
  if(configured) return DriveApp.getFolderById(configured);
  const folder=DriveApp.createFolder('77waxing customer records (private)');
  props.setProperty('CUSTOMER_RECORD_FOLDER_ID',folder.getId());
  return folder;
}
function recordKey_() { return (Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''); }
function recordDigest_(value) {return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value)).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function recordLoad_(id) {
  if(!/^[\da-f-]{36}$/.test(String(id||''))) throw new Error('session_expired');
  const folders=recordRoot_().getFoldersByName(id);
  if(!folders.hasNext())throw new Error('session_expired');
  const folder=folders.next(), manifests=folder.getFilesByName('session.json');
  if(!manifests.hasNext())throw new Error('session_expired');
  const manifest=manifests.next(), data=JSON.parse(manifest.getBlob().getDataAsString());
  if(data.closed || data.expiresAt<=Date.now())throw new Error('session_expired');
  return {folder,manifest,data};
}
function recordPublicFiles_(files) {return files.map(f=>({id:f.id,name:f.name,size:f.size,mime:f.mime}));}
function recordAction_(p) {
  const uid=p.action==='record_upload'?null:recordAdmin_(p);
  const lock=LockService.getScriptLock();
  // Polling/reading must not queue behind uploads or starve OCR requests.
  const needsLock=['record_create','record_upload','record_close'].indexOf(p.action)>=0;
  if(needsLock && !lock.tryLock(10000))throw new Error('busy');
  let session, file;
  try {
    if(p.action==='record_create') {
      const supplied=Boolean(p.requestId||p.uploadKey);
      if(supplied&&(!/^[\da-f-]{36}$/.test(String(p.requestId||''))||!/^[\da-f]{64}$/.test(String(p.uploadKey||''))))throw new Error('invalid_file');
      const sessionId=supplied?String(p.requestId):Utilities.getUuid(),uploadKey=supplied?String(p.uploadKey):recordKey_(),root=recordRoot_();
      if(supplied&&root.getFoldersByName(sessionId).hasNext()) {
        const existing=recordLoad_(sessionId);
        if(existing.data.uid!==uid||existing.data.uploadHash!==recordDigest_(uploadKey))throw new Error('session_expired');
        return {sessionId,uploadKey,expiresAt:existing.data.expiresAt,files:recordPublicFiles_(existing.data.files)};
      }
      const folder=root.createFolder(sessionId),expiresAt=Date.now()+RECORD_TTL_MS;
      folder.createFile('session.json',JSON.stringify({uid,expiresAt,uploadHash:recordDigest_(uploadKey),files:[]}),MimeType.PLAIN_TEXT);
      return {sessionId,uploadKey,expiresAt,files:[]};
    }
    session=recordLoad_(p.sessionId);
    if(p.action==='record_upload') {
      if(!/^[\da-f]{64}$/.test(String(p.uploadKey||'')) || recordDigest_(p.uploadKey)!==session.data.uploadHash)throw new Error('session_expired');
      const f=p.file||{};
      if(!/^[\da-f-]{36}$/.test(String(f.requestId||'')))throw new Error('invalid_file');
      const duplicate=session.data.files.find(x=>x.requestId===f.requestId);
      if(duplicate)return {uploaded:true};
      if(session.data.files.length>=8)throw new Error('file_limit');
      if(typeof f.data!=='string' || f.data.length>Math.ceil(RECORD_MAX_BYTES/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.data))throw new Error('invalid_file');
      const bytes=Utilities.base64Decode(f.data);
      if(!bytes.length || bytes.length>RECORD_MAX_BYTES)throw new Error('invalid_file');
      const name=String(f.name||'file').replace(/[\x00-\x1f/\\]/g,'_').slice(0,160);
      const mime=/^[\w.+-]+\/[\w.+-]+$/.test(String(f.mime||''))?f.mime:'application/octet-stream';
      const saved=session.folder.createFile(Utilities.newBlob(bytes,mime,'upload-'+Utilities.getUuid()+'-'+name));
      session.data.files.push({id:saved.getId(),name,mime,size:bytes.length,requestId:f.requestId});
      try{session.manifest.setContent(JSON.stringify(session.data));}catch(error){saved.setTrashed(true);throw error;}
      // Upload-only capability never returns other customers' files or Drive IDs.
      return {uploaded:true};
    }
    if(session.data.uid!==uid)throw new Error('admin_required');
    if(p.action==='record_list')return {files:recordPublicFiles_(session.data.files),expiresAt:session.data.expiresAt};
    if(p.action==='record_close'){session.data.closed=true;session.manifest.setContent(JSON.stringify(session.data));return {closed:true};}
    file=session.data.files.find(f=>f.id===p.fileId);
    if(!file)throw new Error('file_missing');
  } finally {if(needsLock)lock.releaseLock();}
  if(p.action==='record_download')return {file:{name:file.name,mime:file.mime,data:Utilities.base64Encode(DriveApp.getFileById(file.id).getBlob().getBytes())}};
  if(p.action==='record_scan')return {text:recordScan_(file,session.folder)};
  throw new Error('unsupported');
}
function recordScan_(file,folder) {
  const original=DriveApp.getFileById(file.id).getBlob();
  if(/^text\//.test(file.mime) || /\.(txt|csv|json|md)$/i.test(file.name))return original.getDataAsString('UTF-8').slice(0,50000);
  if(!/^(image\/(jpeg|png|gif|bmp)|application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document)$/.test(file.mime))throw new Error('unsupported');
  const boundary='record_'+Utilities.getUuid();
  const meta=JSON.stringify({name:'OCR '+file.name,mimeType:'application/vnd.google-apps.document',parents:[folder.getId()]});
  const header=Utilities.newBlob('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: '+file.mime+'\r\n\r\n').getBytes();
  const bytes=header.concat(original.getBytes(),Utilities.newBlob('\r\n--'+boundary+'--').getBytes());
  // Let Drive detect the source language; unsupported hints reject the upload.
  const result=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'post',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},contentType:'multipart/related; boundary='+boundary,payload:bytes,muteHttpExceptions:true});
  if(result.getResponseCode()>=300){
    console.error('record OCR conversion failed',result.getResponseCode(),result.getContentText().slice(0,500));
    throw new Error('ocr_failed');
  }
  const id=JSON.parse(result.getContentText()).id;
  try {
    const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'/export?mimeType=text%2Fplain',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw new Error('ocr_failed');
    return response.getContentText().slice(0,50000);
  } finally {DriveApp.getFileById(id).setTrashed(true);}
}
// Install a daily trigger after authorization. Removes expired staging files only.
function cleanupCustomerRecordUploads() {
  const rootId=PropertiesService.getScriptProperties().getProperty('CUSTOMER_RECORD_FOLDER_ID');
  if(!rootId)return;
  const folders=DriveApp.getFolderById(rootId).getFolders();
  while(folders.hasNext()) {
    const folder=folders.next(), files=folder.getFilesByName('session.json');
    if(!files.hasNext())continue;
    const data=JSON.parse(files.next().getBlob().getDataAsString());
    if(Number(data.expiresAt)<Date.now())folder.setTrashed(true);
  }
}
function setupCustomerRecordUploads() {
  recordRoot_();
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='cleanupCustomerRecordUploads'))ScriptApp.newTrigger('cleanupCustomerRecordUploads').timeBased().everyDays(1).create();
}

