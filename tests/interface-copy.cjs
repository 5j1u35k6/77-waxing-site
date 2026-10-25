const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function fn(file,name){const text=read(file),start=text.indexOf('function '+name+'('),end=text.indexOf('\n}',start);assert.ok(start>=0&&end>start,file+': '+name);return text.slice(start,end+2);}
(async()=>{
 const helper=await import('data:text/javascript;base64,'+Buffer.from(read('assets/interface-copy.js')).toString('base64'));
 const friendly=helper.operationErrorText,fallback='操作未完成，請稍後再試。';
 for(const value of ['Firebase: Missing or insufficient permissions.','FirebaseError: permission-denied','Error: auth/network-request-failed','internal_server_error',new Error('Failed to fetch')]){
  assert.equal(friendly(value,fallback),fallback);
 }
 for(const value of ['「掃碼先生的乳液」庫存不足，請調整數量。','請先填寫姓名。','姓名：中國客人／保留原始辨識文字']){
  assert.equal(friendly(value,fallback),value,'never rewrite customer names or existing Chinese business messages');
 }
 const contexts=[
  ['assets/account-linking.js','statusReadErrorText',['invalid_action','missing_data','missing_shop_data','firebase_auth_invalid','identity_server_error','identity_backend_invalid','proxy_http_503','unknown_private_code']],
  ['assets/account-linking.js','bindingErrorText',['popup-closed-by-user','popup-blocked','google_already_linked','line_already_linked','primary_google_exists','firebase_auth_invalid','invalid_action','missing_data','identity_server_error','unknown_private_code']],
  ['assets/google-auth-ui.js','errorText',['operation-not-allowed','unauthorized-domain','popup-closed-by-user','popup-blocked','account-exists-with-different-credential','firebase_auth_invalid','identity_backend_invalid','proxy_http_503','unknown_private_code']]
 ];
 for(const [file,name,codes] of contexts){
  const context=vm.createContext({});vm.runInContext(fn(file,name),context);
  for(const code of codes){const message=context[name]({code});assert.match(message,/[\u3400-\u9fff]/);assert.doesNotMatch(message,/Firebase|Firestore|Cloudflare|Apps Script|IdentityLink|invalid_action|missing_data|identity_server_error|proxy_http_|unknown_private_code/);}
 }
 const boundaries=[
  ['shop/app.js','toast'],['shop/regional-store.js','toast'],['shop/promotion-storefront.js','toast'],
  ['shop/admin.js','flash'],['shop/admin-order-variants.js','flash'],['shop/admin-order-delete.js','flash'],
  ['shop/admin-promotions.js','message']
 ];
 for(const [file,name]of boundaries){
  const alerts=[],el={textContent:'',style:{},classList:{add(){},remove(){}}};
  const context=vm.createContext({$:()=>el,operationErrorText:friendly,setTimeout:()=>1,clearTimeout(){},alert:text=>alerts.push(text)});
  vm.runInContext(fn(file,name),context);context[name]('Firebase: Missing or insufficient permissions.',name==='message'?true:'error');
  const rendered=alerts.at(-1)||el.textContent;
  assert.match(rendered,/[\u3400-\u9fff]/);assert.doesNotMatch(rendered,/Firebase|permissions/);
  context[name]('此規格庫存不足，請調整數量。',name==='message'?true:'error');
  assert.equal(alerts.at(-1)||el.textContent,'此規格庫存不足，請調整數量。');
 }
 const api=await import('data:text/javascript;base64,'+Buffer.from(read('assets/customer-record-upload-api.js')).toString('base64')),previous=globalThis.fetch;
 try{
  let requests=0;globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({ok:false,service:'customer-records-v1',code:'processing_failed',message:'請檢查上傳服務的 Drive 授權與部署版本。'}));};
  await assert.rejects(api.recordRequest('https://script.google.com/macros/s/test/exec','record_scan',{}),error=>error.code==='processing_failed'&&error.message==='目前無法處理檔案，請稍後再試；若仍無法使用，請聯絡網站管理人員。');
  assert.equal(requests,1,'do not change retry behavior');
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,service:'customer-records-v1',text:'姓名：掃碼先生\n備註：保留原始文字'}));
  assert.equal((await api.recordRequest('https://script.google.com/macros/s/test/exec','record_scan',{})).text,'姓名：掃碼先生\n備註：保留原始文字');
 }finally{globalThis.fetch=previous;}
 assert.doesNotMatch(read('shop/admin.js'),/Firestore transaction|Base64 圖片塞進|Hero 小標|Hero 主標|Apps Script Email URL/);
 assert.doesNotMatch(read('shop/admin-promotions.js'),/不改商品、圖片、規格與購物車既有程式/);
 assert.doesNotMatch(read('shop/admin-media.js'),/Firestore 單筆|不再提供「顯示範圍」/);
 assert.doesNotMatch(read('assets/pages.js'),/這個頁面只保留正式公告位置/);
 assert.match(read('assets/admin-dashboard-layout.js'),/預約概況/);
 console.log('PASS: four-platform UI wording; 27 auth/link errors, seven actual message boundaries, storage-service error localization; business messages, OCR content, error codes and retry behavior preserved.');
})().catch(error=>{console.error(error);process.exitCode=1;});

