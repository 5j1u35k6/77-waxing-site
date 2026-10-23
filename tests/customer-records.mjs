import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';

const {recordFields}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../assets/customer-record-fields.js',import.meta.url),'utf8')).toString('base64'));
const values=recordFields('姓名：王小明\n手機：0987-123-456\n生日：民國 90 年 7 月 28 日\nEmail：test@example.com\n服務項目：熱蠟\n');
assert.deepEqual(values,{name:'王小明',phone:'0987123456',birthday:'2001-07-28',email:'test@example.com',service:'熱蠟',note:''});
assert.equal(recordFields('生日：2001/02/29').birthday,'');
assert.equal(recordFields('生日：2000/02/29').birthday,'2000-02-29');
assert.equal(recordFields('不明文字 0987123456 王小明').name,'');
assert.equal(recordFields('不明文字 0987123456 王小明').phone,'');
assert.equal(recordFields('姓名：王小明 手機：0987123456 生日：民國90/7/28').name,'王小明');
assert.equal(recordFields('姓名：王小明 手機：0987123456 生日：民國90/7/28').phone,'0987123456');
const paper=recordFields('諮詢日期：民國115/10/23 客戶編號：C001\n姓名：表單測試 身高：175 cm 體重：65 kg LINE：paper_test 職業：設計 地址：測試市測試路\n目前想除毛部位：小腿\n是否初次除毛：□否 ☑是 已除毛過次數：2 最近除毛日期：115/9/1 部位：手臂\n平常除毛方式：□無習慣 ☑刮刀 □脫毛膏 □拔毛夾 ☑熱蠟 □雷射\n去角質方式：☑凝膠類\n肌膚狀況（複選）：☑乾燥 □其他\n皮膚疾病（複選）：□過敏 ☑濕疹 □其他\n敏感肌膚：是 過敏及敏感來源：測試來源\n是否曾有過陰部發癢症狀：否\n目前有無皮膚過敏或發炎問題：是 問題部位：手臂 症狀：測試描述\n本人簽名：不能自動填 同意條款：是 簽署日期：2026/10/23');
assert.equal(paper.consultationDate,'2026-10-23');assert.equal(paper.customerNumber,'C001');
assert.equal(paper.height,'175');assert.equal(paper.weight,'65');assert.equal(paper.line,'paper_test');assert.equal(paper.occupation,'設計');assert.equal(paper.address,'測試市測試路');
assert.equal(paper.firstWaxing,'是');assert.equal(paper.waxingCount,'2');assert.equal(paper.lastWaxingDate,'2026-09-01');assert.equal(paper.lastWaxingArea,'手臂');
assert.deepEqual(paper.hairRemovalMethods,['刮刀','熱蠟']);assert.deepEqual(paper.exfoliationMethods,['凝膠類']);assert.deepEqual(paper.skinConditions,['乾燥']);assert.deepEqual(paper.skinDiseases,['濕疹']);
assert.equal(paper.sensitiveSkin,true);assert.equal(paper.sensitivitySource,'測試來源');assert.equal(paper.intimateInflammation,'否');assert.equal(paper.currentSkinIssue,'是');assert.equal(paper.issueArea,'手臂');assert.equal(paper.issueSymptoms,'測試描述');
assert.equal(paper.consent,undefined);assert.equal(paper.signatureName,undefined);assert.equal(paper.signatureDate,undefined);
assert.equal(recordFields('平常除毛方式：□無習慣 □刮刀 □脫毛膏 □拔毛夾 □熱蠟 □雷射').hairRemovalMethods,undefined);
assert.equal(recordFields('皮膚疾病：過敏 濕疹 蕁麻疹 魚鱗癬 乾癬').skinDiseases,undefined);
assert.equal(recordFields('姓名 生日 身高/體重\n手機 LINE 職業\n地址').name,'');
assert.equal(recordFields('是否初次除毛：☑否 ☑是').firstWaxing,undefined);
assert.equal(recordFields('身高：9999 cm 體重：文字 已除毛過次數：1.5').height,undefined);
assert.equal(recordFields('目前有無皮膚過敏或發炎問題：是 部位：手臂 症狀：測試').lastWaxingArea,undefined);
assert.equal(recordFields('目前有無皮膚過敏或發炎問題：是 部位：手臂 症狀：測試').issueArea,'手臂');
assert.deepEqual(recordFields('皮膚疾病 □過敏 ☑濕疹').skinDiseases,['濕疹']);

let now=Date.now(), count=0,held=false,lockAttempts=0;
const files=new Map(),folders=new Map(),props=new Map();
const iter=values=>{let i=0;return {hasNext:()=>i<values.length,next:()=>values[i++]};};
const blob=(value,mime,name)=>({getBytes:()=>Array.isArray(value)?value:Array.from(Buffer.from(String(value))),getDataAsString:()=>Buffer.from(Array.isArray(value)?value:Buffer.from(String(value))).toString(),mime,name});
class Folder {
  constructor(name){this.name=name;this.id='folder-'+(++count);this.children=[];this.files=[];folders.set(this.id,this);}
  getId(){return this.id;}
  createFolder(name){const f=new Folder(name);this.children.push(f);return f;}
  getFoldersByName(name){return iter(this.children.filter(f=>f.name===name&&!f.trashed));}
  getFolders(){return iter(this.children.filter(f=>!f.trashed));}
  getFilesByName(name){return iter(this.files.filter(f=>f.name===name&&!f.trashed));}
  createFile(arg,text,mime){const b=typeof arg==='string'?blob(text,mime,arg):arg;const f={id:'file-'+(++count),name:b.name,data:b,getId(){return this.id;},getBlob(){return this.data;},getSize(){return this.data.getBytes().length;},isTrashed(){return !!this.trashed;},setContent(s){this.data=blob(s);},setTrashed(v){this.trashed=v;}};this.files.push(f);files.set(f.id,f);return f;}
  setTrashed(v){this.trashed=v;}
}
const ctx=vm.createContext({console,Date:class extends Date {static now(){return now;}},
  json_:v=>v, firebaseLookupUser_:token=>{if(!token)throw Error('token_invalid');return {uid:token};},identityAdminGetDoc_:(_c,id)=>id==='admin'?{}:null,
  Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_a,v)=>Array.from(createHash('sha256').update(v).digest()),base64Decode:v=>Array.from(Buffer.from(v,'base64')),base64Encode:v=>Buffer.from(v).toString('base64'),newBlob:blob},
  MimeType:{PLAIN_TEXT:'text/plain'},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
  LockService:{getScriptLock:()=>({tryLock:()=>{lockAttempts++;assert.equal(held,false);held=true;return true;},releaseLock:()=>{held=false;}})},
  DriveApp:{createFolder:n=>new Folder(n),getFolderById:id=>folders.get(id),getFileById:id=>files.get(id)}
});
vm.runInContext(fs.readFileSync(new URL('../apps-script/CustomerRecords.gs',import.meta.url),'utf8'),ctx);
const run=(action,p={})=>ctx.routeCustomerRecordsPost_({action,...p});
assert.equal(run('other_action'),null);
assert.equal(run('record_create',{idToken:'customer'}).ok,false);
const replayId=randomUUID(),replayKey='a'.repeat(64);
const replay=run('record_create',{idToken:'admin',requestId:replayId,uploadKey:replayKey});assert.equal(replay.ok,true);
const beforeRetry=folders.size,again=run('record_create',{idToken:'admin',requestId:replayId,uploadKey:replayKey});
assert.equal(again.sessionId,replay.sessionId);assert.equal(again.uploadKey,replay.uploadKey);assert.equal(folders.size,beforeRetry);
assert.equal(run('record_create',{idToken:'admin',requestId:replayId,uploadKey:'b'.repeat(64)}).ok,false);
assert.equal(run('record_create',{idToken:'admin',requestId:'invalid',uploadKey:replayKey}).ok,false);
const session=run('record_create',{idToken:'admin'});assert.equal(session.ok,true);
const access={sessionId:session.sessionId,uploadKey:session.uploadKey};
const content={name:'session.json',mime:'text/plain',data:Buffer.from('姓名：王小明').toString('base64'),requestId:randomUUID()};
assert.equal(run('record_upload',{...access,uploadKey:'0'.repeat(64),file:content}).ok,false);
const uploaded=run('record_upload',{...access,file:content});assert.equal(uploaded.ok,true);assert.equal(uploaded.files,undefined);
assert.equal(run('record_upload',{...access,file:content}).ok,true);
const attemptsBeforeRead=lockAttempts;
const list=run('record_list',{idToken:'admin',sessionId:session.sessionId});assert.equal(list.files.length,1);
assert.equal(lockAttempts,attemptsBeforeRead);
const ocrDoc={trashed:false,setTrashed(v){this.trashed=v;}};
files.set('ocr-test-doc',ocrDoc);
ctx.ScriptApp={getOAuthToken:()=>'synthetic-token'};
ctx.UrlFetchApp={fetch:(url,options)=>{
  if(url.includes('/upload/')){
    assert.equal(new URL(url).searchParams.has('ocrLanguage'),false);
    assert.match(options.contentType,/^multipart\/related; boundary=/);
    return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({id:'ocr-test-doc'})};
  }
  assert.match(url,/\/ocr-test-doc\/export\?mimeType=text%2Fplain$/);
  return {getResponseCode:()=>200,getContentText:()=>'姓名：圖片測試'};
}};
assert.equal(ctx.recordScan_({id:list.files[0].id,name:'sample.png',mime:'image/png'},new Folder('ocr-test')),'姓名：圖片測試');
assert.equal(ocrDoc.trashed,true);
assert.notEqual(files.get(list.files[0].id).name,'session.json');
assert.equal(run('record_list',access).ok,false);
assert.equal(run('record_list',{...access,idToken:'customer'}).ok,false);
assert.equal(run('record_scan',{sessionId:session.sessionId,idToken:'admin',fileId:list.files[0].id}).text,'姓名：王小明');
assert.equal(lockAttempts,attemptsBeforeRead+1,'only image OCR lease acquisition adds a short lock');
assert.equal(run('record_download',{sessionId:session.sessionId,idToken:'admin',fileId:'other'}).ok,false);
assert.equal(run('record_upload',{...access,file:{...content,requestId:randomUUID(),data:'!invalid!'}}).ok,false);
for(let i=1;i<8;i++)assert.equal(run('record_upload',{...access,file:{...content,requestId:randomUUID()}}).ok,true);
assert.equal(run('record_upload',{...access,file:{...content,requestId:randomUUID()}}).ok,false);
assert.equal(run('record_close',{idToken:'admin',sessionId:session.sessionId}).ok,true);
assert.equal(run('record_upload',{...access,file:{...content,requestId:randomUUID()}}).ok,false);
const exp=run('record_create',{idToken:'admin'});now+=21*60*1000;
assert.equal(run('record_list',{idToken:'admin',sessionId:exp.sessionId}).ok,false);
ctx.cleanupCustomerRecordUploads();assert.equal(held,false);
// Single authenticated submission; lost replies may replay without another folder or file.
const submission={idToken:'admin',requestId:randomUUID(),uploadKey:'c'.repeat(64),file:{...content,requestId:randomUUID()}};
const submitted=run('record_submit',submission);assert.equal(submitted.ok,true);assert.equal(submitted.uploaded,true);assert.equal(submitted.verified,true);assert.equal(submitted.bytes,Buffer.from('姓名：王小明').length);
assert.equal(submitted.sessionId,submission.requestId);const counts=[folders.size,files.size];
assert.equal(run('record_submit',submission).file.id,submitted.file.id);assert.deepEqual([folders.size,files.size],counts);
assert.equal(run('record_submit',{...submission,idToken:'customer'}).ok,false);
assert.equal(run('record_submit',{...submission,idToken:''}).ok,false);
assert.equal(run('record_submit',{...submission,file:{...submission.file,data:Buffer.from('different bytes').toString('base64')}}).ok,false);
const stored=files.get(submitted.file.id),storedBlob=stored.data;stored.data=blob('short');
assert.equal(run('record_submit',submission).code,'verify_failed','never acknowledge truncated storage');stored.data=storedBlob;
stored.trashed=true;assert.equal(run('record_submit',submission).verified,undefined,'never acknowledge missing original');stored.trashed=false;
assert.equal(run('record_submit',submission).verified,true,'same request can recover after a lost verification');
// Direct uploads can return only the verified owner's accepted file; phone links remain upload-only.
const direct=run('record_create',{idToken:'admin'}),directAccess={sessionId:direct.sessionId,uploadKey:direct.uploadKey};
const imageFile={name:'large.jpg',mime:'image/jpeg',data:Buffer.from('original image bytes').toString('base64'),requestId:randomUUID(),ocr:{mime:'image/jpeg',data:Buffer.from([255,216,255,217]).toString('base64')}};
const directUpload=run('record_upload',{...directAccess,idToken:'admin',file:imageFile});assert.equal(directUpload.ok,true);assert.equal(directUpload.file.name,'large.jpg');assert.equal(directUpload.file.ocrId,undefined);
assert.equal(run('record_upload',{...directAccess,idToken:'admin',file:imageFile}).file.id,directUpload.file.id);
assert.equal(run('record_upload',{...directAccess,file:imageFile}).file,undefined);
ctx.identityAdminGetDoc_=(_c,id)=>['admin','admin2'].includes(id)?{}:null;
assert.equal(run('record_upload',{...directAccess,idToken:'admin2',file:imageFile}).ok,false);
assert.equal(run('record_upload',{...directAccess,file:{...imageFile,requestId:randomUUID(),ocr:{mime:'image/jpeg',data:'aW52YWxpZA=='}}}).ok,false);
assert.equal(run('record_download',{sessionId:direct.sessionId,idToken:'admin',fileId:directUpload.file.id}).file.data,imageFile.data,'original download is byte-identical');
let convertCount=0,exportCount=0,sleeps=[];ctx.Utilities.sleep=ms=>sleeps.push(ms);
ctx.UrlFetchApp={fetch:(url,options)=>{
  if(url.includes('/upload/')){convertCount++;assert.ok(Buffer.from(options.payload).includes(Buffer.from([255,216,255,217])),'OCR uses smaller companion');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({id:'ocr-test-doc'})};}
  exportCount++;return {getResponseCode:()=>exportCount===1?503:200,getContentText:()=>'姓名：副本測試'};
}};
const scanArgs={sessionId:direct.sessionId,idToken:'admin',fileId:directUpload.file.id};
assert.equal(run('record_scan',scanArgs).text,'姓名：副本測試');assert.equal(convertCount,1);assert.equal(exportCount,2);assert.deepEqual(sleeps,[250]);
assert.equal(run('record_scan',scanArgs).text,'姓名：副本測試');assert.equal(convertCount,1,'repeat scan reads authorized private result, no repeat conversion');
assert.equal(run('record_scan',{...scanArgs,idToken:'admin2'}).ok,false,'cached text never bypasses ownership');
const ownFolder=ctx.recordLoad_(direct.sessionId).folder;
const blockedFile=ownFolder.createFile(blob('image','image/jpeg','pending.jpg'));
ownFolder.createFile('ocr-pending-'+blockedFile.id+'.json',JSON.stringify({expiresAt:now+60000}),'text/plain');
assert.throws(()=>ctx.recordScan_({id:blockedFile.id,name:'pending.jpg',mime:'image/jpeg'},ownFolder),/ocr_busy/);
assert.equal(convertCount,1,'in-progress lease prevents duplicate conversion');assert.equal(held,false);
run('record_close',{sessionId:direct.sessionId,idToken:'admin'});assert.equal(run('record_scan',scanArgs).ok,false,'cached text never bypasses closed session');
console.log('PASS: labelled field extraction, ROC/leap dates, admin checks, upload-only token, safe manifest filenames, idempotency, count cap, invalid input, closed/expired sessions and cleanup.');
