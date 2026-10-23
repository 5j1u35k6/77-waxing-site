const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://test');
  if(url.pathname==='/admin/test-admin'){res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/assets/customer-record-import.css"><button data-paper-import>新增紀錄</button><script type="module" src="/assets/customer-record-import.js"></script>');return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}}),requests=[],sessions=new Map(),errors=[];
    let failName='first.txt',failTransport=true,scanFails=false,verify=false;context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    await context.route('https://www.gstatic.com/firebasejs/**',route=>{
      const url=route.request().url();let body;
      if(url.includes('firebase-app'))body='export const getApps=()=>[{name:"[DEFAULT]"}];export const getApp=()=>({});export const initializeApp=()=>({});';
      else if(url.includes('firebase-auth'))body='const user={uid:"admin-test",isAnonymous:false,getIdToken:async()=>"synthetic"};export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=()=>{};';
      else body='export const getFirestore=()=>({});export const doc=(_db,c,id)=>({collection:c,id});export async function getDoc(ref){return {exists:()=>true,data:()=>({})};}export const getDocFromServer=getDoc;export const runTransaction=()=>{throw Error("test must not save")};export const serverTimestamp=()=>({});';
      return route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body});
    });
    await context.route('https://script.google.com/macros/s/**/exec*',async route=>{
      const p=route.request().postDataJSON();requests.push(p);let result={ok:true,service:'customer-records-v1'};
      const id=p.action==='record_submit'?p.requestId:p.sessionId;
      if(p.action==='record_create'){const id=randomUUID();sessions.set(id,[]);Object.assign(result,{sessionId:id,uploadKey:'b'.repeat(64),expiresAt:Date.now()+1200000});}
      if(['record_submit','record_upload'].includes(p.action)){
        await wait(150);if(!sessions.has(id))sessions.set(id,[]);const files=sessions.get(id);
        let file=files.find(f=>f.requestId===p.file.requestId);if(!file){file={id:'file-'+randomUUID(),name:p.file.name,mime:p.file.mime,size:10,requestId:p.file.requestId};files.push(file);}
        if(failTransport&&p.file.name===failName)return route.fulfill({status:404,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:'temporary redirect failure'});
        Object.assign(result,{uploaded:true,verified:verify,bytes:10});if(p.idToken)result.file=file;
        if(p.action==='record_submit')Object.assign(result,{sessionId:id,uploadKey:p.uploadKey,expiresAt:Date.now()+1200000});
      }
      if(p.action==='record_list')result.files=sessions.get(id)||[];
      if(p.action==='record_scan')Object.assign(result,scanFails?{ok:false,code:'ocr_failed',message:'原檔已保存，辨識失敗可再試'}:{text:'姓名：自動帶入測試\n手機：0900000000\n生日：民國90/7/28'});
      return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
    });
    const open=async()=>{const page=await context.newPage();await page.goto(origin+'/admin/test-admin');await page.getByRole('button',{name:'新增紀錄',exact:true}).click();return page;};
    const file=name=>({name,mimeType:'text/plain',buffer:Buffer.from('姓名：自動帶入測試')});
    // The server stored the first request, but every initial reply is lost. UI must not claim success.
    const direct=await open();await direct.locator('[data-record-picker]').setInputFiles(file('first.txt'));
    await direct.locator('[data-upload-queue] strong').waitFor();await direct.getByRole('button',{name:'繼續上傳',exact:true}).waitFor();
    assert.match(direct.url(),/test-admin$/);assert.equal(await direct.locator('[data-upload-queue] progress').getAttribute('value'),null);
    assert.equal(requests.filter(p=>p.action==='record_create').length,0,'no separate staging request');
    assert.equal(requests.filter(p=>p.action==='record_submit').length,3,'bounded automatic attempts');
    failTransport=false;await direct.getByRole('button',{name:'繼續上傳',exact:true}).click();
    // Unverified replies are never considered complete, even if the service says ok.
    await direct.getByRole('button',{name:'繼續上傳',exact:true}).waitFor();assert.match(direct.url(),/test-admin$/);
    verify=true;await direct.getByRole('button',{name:'繼續上傳',exact:true}).click();await direct.waitForURL('**/admin/customer-record.html?**');
    await direct.locator('[data-source-summary-text]').filter({hasText:'辨識完成'}).waitFor();
    const submitted=requests.filter(p=>p.action==='record_submit');assert.equal(new Set(submitted.map(p=>p.file.requestId)).size,1);assert.equal(new Set(submitted.map(p=>p.requestId)).size,1);
    assert.equal(new Set(submitted.map(p=>p.uploadKey)).size,1);assert.equal(sessions.get(submitted[0].requestId).length,1,'lost replies never duplicate the original');
    assert.equal(await direct.locator('[name="name"]').inputValue(),'自動帶入測試');assert.equal(await direct.locator('[name="consent"]').isChecked(),false);
    assert.equal(await direct.locator('[data-signature-preview]').isHidden(),true);
    // A partly completed batch resumes only its unconfirmed file.
    failName='second.txt';failTransport=true;const start=requests.length,batch=await open();
    await batch.locator('[data-record-picker]').setInputFiles([file('done.txt'),file('second.txt')]);await batch.getByRole('button',{name:'繼續上傳',exact:true}).waitFor();
    failTransport=false;await batch.getByRole('button',{name:'繼續上傳',exact:true}).click();await batch.waitForURL('**/admin/customer-record.html?**');
    assert.equal(requests.slice(start).filter(p=>p.action==='record_submit'&&p.file.name==='done.txt').length,1);
    // Other-device selection uploads automatically; the original admin opens the form automatically.
    const owner=await open();await owner.getByRole('button',{name:'透過其他裝置上傳',exact:true}).click();await owner.locator('[data-record-qr] svg').waitFor();
    const create=requests.findLast(p=>p.action==='record_create'),createdSession=[...sessions.keys()].at(-1);
    const phone=await context.newPage(),endpoint='https://script.google.com/macros/s/test/exec';
    await phone.goto(origin+'/admin/record-upload.html#'+new URLSearchParams({session:createdSession,key:'b'.repeat(64),endpoint}));
    const phoneBefore=requests.length;await phone.locator('input').setInputFiles(file('phone.txt'));
    await phone.getByRole('status').filter({hasText:'原檔已確認保存'}).waitFor();
    assert.equal(requests.slice(phoneBefore).filter(p=>p.action==='record_upload').length,1,'no extra upload click');
    await owner.waitForURL('**/admin/customer-record.html?**');await owner.locator('[data-source-summary-text]').filter({hasText:'辨識完成'}).waitFor();
    assert.equal(await owner.locator('[name="name"]').inputValue(),'自動帶入測試');assert.equal(await owner.locator('[name="consent"]').isChecked(),false);
    // OCR failure never sends the original again; recovery is a scan-only action.
    scanFails=true;const failed=await open();await failed.locator('[data-record-picker]').setInputFiles(file('ocr.txt'));await failed.waitForURL('**/admin/customer-record.html?**');await failed.getByRole('button',{name:'重新辨識',exact:true}).waitFor();
    const uploadsBeforeRetry=requests.filter(p=>['record_submit','record_upload'].includes(p.action)).length;
    scanFails=false;await failed.getByRole('button',{name:'重新辨識',exact:true}).click();await failed.locator('[data-source-summary-text]').filter({hasText:'辨識完成'}).waitFor();
    assert.equal(requests.filter(p=>['record_submit','record_upload'].includes(p.action)).length,uploadsBeforeRetry);
    assert.deepEqual(errors,[]);console.log('PASS: direct and QR auto-navigation/recognition/fill; combined verified save; lost-ack retry retains identities/files; incomplete batch resumes only remaining file; no false success/duplicate original; OCR-only recovery; consent/signature untouched.');
  }finally{await browser.close();server.close();}
})().catch(error=>{server.close();console.error(error);process.exitCode=1;});
