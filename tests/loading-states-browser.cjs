// Loading states use controlled delayed reads; no real identities, records or writes.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.TEST_SITE_ROOT||path.join(__dirname,'..'));
const fallbackRoot=path.resolve(process.env.TEST_FALLBACK_ROOT||root);
const artifacts=path.resolve(process.env.TEST_ARTIFACTS||path.join(__dirname,'../artifacts/loading-states'));
fs.mkdirSync(artifacts,{recursive:true});
const authMock=[
 'export const browserLocalPersistence={};export const setPersistence=async()=>{};export const getRedirectResult=async()=>null;export const getIdTokenResult=async()=>({claims:{}});',
 'export class OAuthProvider{addScope(){}} export const signInWithRedirect=async()=>{};export const signOut=async()=>{};',
 'const user={uid:"A",isAnonymous:false,displayName:"測試會員",email:"test@example.invalid",providerData:[],getIdToken:async()=>"fixture"};',
 'export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});',
 'export const onAuthStateChanged=(auth,cb)=>{if(location.pathname==="/member")setTimeout(()=>cb(user),0);return()=>{};};',
].join('\n');
const firestoreMock=[
 'export const getFirestore=()=>({});export const collection=(_db,name)=>name;export const doc=(_db,name,id)=>({name,id});export const query=(...a)=>a;export const where=(...a)=>a;export const serverTimestamp=()=>1;',
 'export const setDoc=async()=>{throw Error("Unexpected write");};',
 'export const getDoc=async ref=>{if(ref.name==="memberProfiles")await new Promise(r=>window.releaseProfile=r);if(ref.name==="settings"&&location.search.includes("session="))await new Promise(r=>window.releaseSettings=r);return{exists:()=>true,data:()=>({displayName:"測試會員",email:"test@example.invalid",phone:"0900000000",birthday:"2000-01-02"})};};',
 'export const getDocs=async()=>{await new Promise(r=>window.releaseHistory=r);return{docs:[{id:"test-booking",data:()=>({serviceName:"測試熱蠟",preferredDate:"2026-11-01",preferredTime:"20:00"})}]};};',
].join('\n');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture'),route=url.pathname;
 res.setHeader('Content-Type',route.endsWith('.css')?'text/css':route.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
 if(route==='/member')return res.end('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}</style>'+(url.searchParams.has('shop')?'<nav class="shop-nav"><button data-tab="orders">我的訂單</button><button id="cart-open">購物車</button></nav>':'<header class="header"><nav></nav></header>')+'<script type="module" src="/assets/member-auth.js"></script>');
 if(route==='/assets/public-firebase.js')return res.end('export const getPublicFirebase=()=>({auth:{},db:{}});');
 if(route==='/assets/customer-record-store.js')return res.end('export const saveCustomerRecord=async()=>{throw Error("Must not save");};export const loadCustomerRecord=async(_db,id)=>{await new Promise(r=>window.releaseRecord=r);if(location.search.includes("fail="))throw Error("測試讀取失敗");return{id,form:{name:"已儲存測試紀錄"},confirmationStatus:"unconfirmed"};};');
 let file=path.resolve(root,'.'+route);
 if(!file.startsWith(root+path.sep))return res.writeHead(404).end();
 if(!fs.existsSync(file))file=path.resolve(fallbackRoot,'.'+route);
 if(!file.startsWith(fallbackRoot+path.sep)&&!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
 return res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
 const failures=[],errors=[];
 const check=(value,message)=>{if(!value){failures.push(message);console.error('FAIL:',message);}};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:route.request().url().includes('firebase-auth')?authMock:route.request().url().includes('firebase-firestore')?firestoreMock:'export const getApps=()=>[{name:"[DEFAULT]"}];export const getApp=()=>({});export const initializeApp=()=>({});'}));
  await context.route('https://77waxing-line-auth-proxy.max19450.workers.dev/**',route=>route.fulfill({contentType:'application/json',body:'{"ok":true}'}));
  await context.route('https://script.google.com/macros/s/**',async route=>{
   const body=route.request().postDataJSON();
   if(body.action==='record_scan')await route.request().frame().evaluate(()=>new Promise(r=>window.releaseScan=r));
   return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,service:'customer-records-v1',files:[],text:'姓名：辨識測試'})});
  });
  for(const suffix of ['','?shop=1']){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/member'+suffix);await page.waitForFunction(()=>window.__77_MEMBER__?.isMember());
   await page.locator('[data-member-trigger]').click();
   const visible=await page.locator('#member-center-wrap').isVisible();
   check(visible,'Member center must open before profile read completes ('+suffix+')');
   if(visible){
    check(/讀取會員資料/.test(await page.locator('#member-center-wrap').innerText()),'Show profile loading text');
    await page.setViewportSize({width:390,height:844});
    check(await page.locator('.member-center-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Mobile loading state has no overflow');
    await page.screenshot({path:path.join(artifacts,suffix?'store-member-loading.png':'waxing-member-loading.png')});
    await page.locator('[data-member-center-close]').last().click();
   }else await page.screenshot({path:path.join(artifacts,suffix?'store-member-missing.png':'waxing-member-missing.png')});
   await page.evaluate(()=>window.releaseProfile());await page.waitForFunction(()=>window.__77_MEMBER__.profile);
   if(visible)check(!(await page.locator('#member-center-wrap').isVisible()),'Closing during loading must stay closed');
   else await page.locator('[data-member-center-close]').last().click();
   await page.locator('[data-member-trigger]').click();
   if(!suffix){
    await page.waitForFunction(()=>!!window.releaseHistory);
    check(/讀取預約紀錄/.test(await page.locator('[data-member-history]').innerText()),'History loading has feedback');
    await page.evaluate(()=>window.releaseHistory());await page.locator('.member-history-card').waitFor();
   }else await page.locator('[data-member-orders]').waitFor();
   await page.close();
  }
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const record='/admin/customer-record.html?record=paper_00000000-0000-4000-8000-000000000001';
  await page.goto(origin+record);await page.waitForFunction(()=>!!window.releaseRecord);
  check(await page.locator('[data-page-status]').isVisible(),'Existing record must display loading status until loaded');
  check(!(await page.locator('[data-record-page]').isVisible())||!(await page.locator('[data-record-save]').isEnabled()),'Do not show an editable blank form while loading saved record');
  await page.screenshot({path:path.join(artifacts,'saved-record-loading.png')});
  await page.evaluate(()=>window.releaseRecord());await page.locator('[name="name"]').filter({visible:true}).waitFor();
  assert.equal(await page.locator('[name="name"]').inputValue(),'已儲存測試紀錄');
  assert.equal(await page.locator('[name="name"]').isDisabled(),true);
  await page.goto(origin+record+'&fail=1');await page.waitForFunction(()=>!!window.releaseRecord);await page.evaluate(()=>window.releaseRecord());
  await page.getByText('測試讀取失敗',{exact:true}).waitFor();assert.equal(await page.locator('[data-record-page]').isVisible(),false);
  await page.goto(origin+'/admin/customer-record.html?session=00000000-0000-4000-8000-000000000001&file=fixture');
  await page.locator('[data-record-page]').waitFor();await page.waitForFunction(()=>!!window.releaseSettings);
  check(await page.locator('[data-source-summary]').isVisible(),'Show uploaded-file preparation status while settings read is delayed');
  check(await page.locator('[data-source-progress]').isVisible(),'Show indeterminate progress during uploaded-file preparation');
  await page.screenshot({path:path.join(artifacts,'upload-preparing.png')});
  await page.evaluate(()=>window.releaseSettings());await page.waitForFunction(()=>!!window.releaseScan);
  check(/辨識/.test(await page.locator('[data-source-summary-text]').innerText()),'Scan loading status visible');
  await page.evaluate(()=>window.releaseScan());await page.getByText('辨識完成。請核對資料；人工修改、同意及簽名不會被自動覆蓋。',{exact:true}).waitFor();
  assert.equal(await page.locator('[name="name"]').inputValue(),'辨識測試');
  assert.equal(await page.locator('[name="consent"]').isChecked(),false);
  assert.equal(await page.locator('[data-source-progress]').isVisible(),false);
  await page.screenshot({path:path.join(artifacts,'scan-complete.png')});
  assert.deepEqual(errors,[]);
  if(failures.length)throw Error(failures.join('\n'));
  console.log('PASS: immediate member loading on waxing/store, close while pending, history loading, mobile layout, saved-record loading/read-only/error, upload-preparation/scan/completion, untouched consent.');
 }finally{await browser.close();server.close();}
})().catch(e=>{server.close();console.error(e);process.exitCode=1;});
