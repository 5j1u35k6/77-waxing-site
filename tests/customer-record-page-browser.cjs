const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),saved=new Map();let adminAllowed=true,writeCount=0;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://test');
  if(url.pathname==='/mock-store'){
    if(req.method==='POST'){let body='';for await(const part of req)body+=part;const record=JSON.parse(body);if(!saved.has(record.id)){saved.set(record.id,record.data);writeCount++;}res.end('{}');}
    else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(saved.get(url.searchParams.get('id'))||null));}return;
  }
  if(url.pathname==='/mock-admin'){res.end(JSON.stringify(adminAllowed));return;}
  if(url.pathname==='/admin/test-admin'){res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/assets/customer-record-import.css"><button data-paper-import>新增紀錄</button><script type="module" src="/assets/customer-record-import.js"></script>');return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    await context.route('https://www.gstatic.com/firebasejs/**',route=>{
      const url=route.request().url();let body;
      if(url.includes('firebase-app'))body='export const getApps=()=>[{name:"[DEFAULT]"}];export const getApp=()=>({});export const initializeApp=()=>({});';
      else if(url.includes('firebase-auth'))body='const user={uid:"admin-test",isAnonymous:false,getIdToken:async()=>"test-token"};export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=()=>{};';
      else body=`export const getFirestore=()=>({});export const doc=(_db,c,id)=>({collection:c,id});const snap=(data)=>({exists:()=>!!data,data:()=>data});export async function getDoc(ref){if(ref.collection==='admins')return snap(await (await fetch('/mock-admin')).json());return snap({});}export async function getDocFromServer(ref){return snap(await (await fetch('/mock-store?id='+ref.id)).json());}export const serverTimestamp=()=>({seconds:12345});export async function runTransaction(_db,fn){let write;await fn({get:ref=>getDocFromServer(ref),set:(ref,data)=>{write={id:ref.id,data}}});if(write)await fetch('/mock-store',{method:'POST',body:JSON.stringify(write)});}`;
      return route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body});
    });
    await context.route('https://script.google.com/macros/s/**/exec*',route=>{
      const p=route.request().postDataJSON();let result={};
      if(p.action==='record_create')result={sessionId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',uploadKey:'b'.repeat(64),expiresAt:Date.now()+1200000};
      else if(p.action==='record_submit')result={sessionId:p.requestId,uploadKey:p.uploadKey,expiresAt:Date.now()+1200000,uploaded:true,verified:true,file:{id:'source-file',name:p.file.name,mime:p.file.mime,size:100}};
      else if(p.action==='record_list')result={files:[{id:'source-file',name:'scan.txt',mime:'text/plain',size:100}]};
      else if(p.action==='record_scan')result={text:'姓名：辨識測試 手機：0900000001 生日：民國90/7/28\n是否初次除毛：是 已除毛過次數：3\n肌膚狀況：☑乾燥\n本人簽名：不得帶入 同意條款：是'};
      return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,service:'customer-records-v1',...result})});
    });
    const page=await context.newPage();await page.goto(origin+'/admin/test-admin');await page.getByRole('button',{name:'新增紀錄',exact:true}).click();await page.getByRole('button',{name:'手動輸入',exact:true}).click();await page.waitForURL('**/admin/customer-record.html');
    await page.locator('[data-record-page]').waitFor({state:'visible'});assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('.paper-terms li').count(),11);
    for(const key of ['firstWaxing','skinOther','diseaseOther','sensitivitySource','inflammationReason','currentSkinIssue'])assert.equal(await page.locator(`[data-conditional="${key}"]`).isHidden(),true,key);
    const inputBoxes=await Promise.all([page.locator('[name="name"]').boundingBox(),page.locator('[data-birthday-trigger]').boundingBox(),page.locator('[name="height"]').boundingBox(),page.locator('[name="weight"]').boundingBox()]);assert.ok(Math.max(...inputBoxes.map(b=>b.y))-Math.min(...inputBoxes.map(b=>b.y))<2,'basic row aligns');
    await page.locator('[name="firstWaxing"][value="是"]').check();assert.equal(await page.locator('[data-conditional="firstWaxing"]').isVisible(),true);
    const historyBoxes=await Promise.all(['waxingCount','lastWaxingDate','lastWaxingArea'].map(n=>page.locator(`[name="${n}"]`).boundingBox()));assert.ok(Math.max(...historyBoxes.map(b=>b.y))-Math.min(...historyBoxes.map(b=>b.y))<2,'history on same row');
    await page.locator('[name="waxingCount"]').fill('3');await page.locator('[name="firstWaxing"][value="否"]').check();assert.equal(await page.locator('[name="waxingCount"]').isDisabled(),true);
    for(const [group,key] of [['skinConditions','skinOther'],['skinDiseases','diseaseOther']]){await page.locator(`[name="${group}"][value="其他"]`).check();assert.equal(await page.locator(`[name="${key}"]`).isVisible(),true);await page.locator(`[name="${key}"]`).fill('其他測試');await page.locator(`[name="${group}"][value="其他"]`).uncheck();assert.equal(await page.locator(`[name="${key}"]`).isHidden(),true);}
    await page.locator('[name="sensitiveSkin"]').check();assert.equal(await page.locator('[name="sensitivitySource"]').isVisible(),true);await page.locator('[name="sensitiveSkin"]').uncheck();
    for(const [group,key] of [['intimateInflammation','inflammationReason'],['currentSkinIssue','issueSymptoms']]){await page.locator(`[name="${group}"][value="是"]`).check();assert.equal(await page.locator(`[name="${key}"]`).isVisible(),true);await page.locator(`[name="${group}"][value="否"]`).check();assert.equal(await page.locator(`[name="${key}"]`).isHidden(),true);}
    await page.locator('[data-birthday-trigger]').click();assert.equal(await page.locator('.flight-calendar .calgrid').isVisible(),true);await page.getByLabel('生日年份',{exact:true}).selectOption('2001');await page.getByLabel('生日月份',{exact:true}).selectOption('6');await page.getByRole('button',{name:'2001年7月28日',exact:true}).click();assert.equal(await page.locator('[name="birthday"]').inputValue(),'2001-07-28');assert.match(await page.locator('[data-birthday-trigger]').textContent(),/民國 90 年 7 月 28 日/);
    await page.locator('[name="name"]').fill('儲存測試');await page.locator('[name="phone"]').fill('0900000000');
    // First save is explicitly unsigned; no agreement is accepted in this workflow.
    await page.getByRole('button',{name:'正式儲存顧客紀錄',exact:true}).click();await page.getByText('顧客紀錄已儲存，可在顧客資料中檢視。',{exact:true}).waitFor();assert.equal(writeCount,1);const id=new URL(page.url()).searchParams.get('record');assert.equal(saved.get(id).confirmationStatus,'not_confirmed');assert.equal(saved.get(id).form.waxingCount,'');assert.equal(saved.get(id).form.skinOther,'');
    await page.reload();await page.locator('[data-record-page]').waitFor({state:'visible'});assert.equal(await page.locator('[name="name"]').inputValue(),'儲存測試');assert.equal(await page.locator('[name="name"]').isDisabled(),true);assert.equal(writeCount,1);
    // Signature editing is exercised on an isolated mock draft, without accepting consent.
    const sign=await context.newPage();await sign.goto(origin+'/admin/customer-record.html');await sign.locator('[data-record-page]').waitFor({state:'visible'});await sign.locator('[data-signature-open]').click();const canvas=sign.locator('.paper-signature-dialog canvas'),box=await canvas.boundingBox();await sign.mouse.move(box.x+50,box.y+80);await sign.mouse.down();await sign.mouse.move(box.x+130,box.y+150);await sign.mouse.move(box.x+220,box.y+70);await sign.mouse.up();await sign.getByRole('button',{name:'完成',exact:true}).click();assert.equal(await sign.locator('[data-signature-preview]').isVisible(),true);assert.match(await sign.locator('[data-signature-preview]').getAttribute('src'),/^data:image\/png/);assert.equal(await sign.locator('[name="consent"]').isChecked(),false);
    for(const width of [1440,390]){await sign.setViewportSize({width,height:1000});assert.equal(await sign.locator('[data-record-page]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);const natural=sign.locator('.paper-natural span');assert.equal(await natural.evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');}
    await sign.setViewportSize({width:1440,height:1100});await sign.locator('h1').scrollIntoViewIfNeeded();await sign.screenshot({path:path.join(root,'artifacts/customer-record-page-test.png'),fullPage:true});
    const scan=await context.newPage();await scan.goto(origin+'/admin/test-admin');await scan.getByRole('button',{name:'新增紀錄',exact:true}).click();await scan.locator('[data-record-picker]').setInputFiles({name:'scan.txt',mimeType:'text/plain',buffer:Buffer.from('姓名：辨識測試')});await scan.waitForURL('**/admin/customer-record.html?**');await scan.getByText('辨識完成。請核對資料；人工修改、同意及簽名不會被自動覆蓋。',{exact:true}).waitFor();assert.equal(await scan.locator('[name="name"]').inputValue(),'辨識測試');assert.equal(await scan.locator('[name="waxingCount"]').isVisible(),true);assert.equal(await scan.locator('[name="consent"]').isChecked(),false);assert.equal(await scan.locator('[data-signature-preview]').isHidden(),true);assert.deepEqual([...new URL(scan.url()).searchParams.keys()].sort(),['file','session']);
    await scan.locator('[name="name"]').fill('人工修改');await scan.locator('[name="skinConditions"][value="乾燥"]').uncheck();await scan.getByRole('button',{name:'辨識並套用',exact:true}).click();await scan.getByText('辨識完成。請核對資料；人工修改、同意及簽名不會被自動覆蓋。',{exact:true}).waitFor();assert.equal(await scan.locator('[name="name"]').inputValue(),'人工修改');assert.equal(await scan.locator('[name="skinConditions"][value="乾燥"]').isChecked(),false);
    adminAllowed=false;const denied=await context.newPage();await denied.goto(origin+'/admin/customer-record.html');await denied.getByText('此頁僅供管理員使用。',{exact:true}).waitFor();assert.equal(await denied.locator('[data-record-fields]').count(),0);assert.equal(writeCount,1);
    assert.deepEqual(errors,[]);console.log('PASS: standalone navigation; 12 requested UI changes; calendar/conditional fields/signature; real save UI with mocked Firestore, server verification, reload/read-only persistence; no anonymous form or duplicate write.');
  }finally{await browser.close();server.close();}
})().catch(e=>{server.close();console.error(e);process.exitCode=1;});
