const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
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
    const context=await browser.newContext({viewport:{width:1280,height:900}}),calls=[],errors=[];let listFails=false,scanAttempts=0;
    context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    await context.route('https://www.gstatic.com/firebasejs/**',route=>{
      const url=route.request().url();let body;
      if(url.includes('firebase-app'))body='export const getApps=()=>[{name:"[DEFAULT]"}];export const getApp=()=>({});export const initializeApp=()=>({});';
      else if(url.includes('firebase-auth'))body='const user={uid:"admin-test",isAnonymous:false,getIdToken:async()=>"synthetic"};export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=()=>{};';
      else body='export const getFirestore=()=>({});export const doc=(_db,c,id)=>({collection:c,id});export async function getDoc(ref){return {exists:()=>true,data:()=>({})};}export const getDocFromServer=getDoc;export const runTransaction=()=>{throw Error("test must not save")};export const serverTimestamp=()=>({});';
      return route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body});
    });
    const file={id:'source-file',name:'slow.txt',mime:'text/plain',size:20};
    await context.route('https://script.google.com/macros/s/**/exec',async route=>{
      const p=route.request().postDataJSON();calls.push(p.action);let result={ok:true,service:'customer-records-v1'};
      if(p.action==='record_create'){await wait(1000);Object.assign(result,{sessionId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',uploadKey:'b'.repeat(64),expiresAt:Date.now()+1200000});}
      if(p.action==='record_upload'){await wait(500);Object.assign(result,p.idToken?{uploaded:true,file}:{uploaded:true});}
      if(p.action==='record_list'){await wait(800);Object.assign(result,listFails?{ok:false,message:'清單測試失敗'}:{files:[file]});}
      if(p.action==='record_scan'){scanAttempts++;await wait(500);Object.assign(result,scanAttempts===1?{ok:false,code:'ocr_failed',message:'原檔已上傳，但文字辨識暫時失敗；請按「重新辨識」，不必重傳原檔。'}:{text:'姓名：辨識測試\n手機：0900000000\n生日：民國90/7/28'});}
      return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
    });
    const page=await context.newPage();await page.goto(origin+'/admin/test-admin');await page.getByRole('button',{name:'新增紀錄',exact:true}).click();
    await page.locator('[data-record-picker]').setInputFiles({name:'slow.txt',mimeType:'text/plain',buffer:Buffer.from('姓名：辨識測試')});
    await page.locator('[data-upload-queue] strong').waitFor();assert.equal(await page.locator('[data-upload-queue] strong').textContent(),'slow.txt');
    assert.ok(!calls.includes('record_upload'),'filename/progress is visible while the slow connection is still pending');
    assert.equal(await page.getByRole('button',{name:'直接上傳',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'辨識並套用',exact:true}).waitFor();await page.getByRole('button',{name:'辨識並套用',exact:true}).waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('.record-scan').disabled);
    assert.equal(calls.filter(x=>x==='record_list').length,0,'accepted direct upload does not wait for another list request');
    assert.equal(await page.locator('[data-upload-queue] progress').getAttribute('value'),'100');
    listFails=true;await page.getByRole('button',{name:'辨識並套用',exact:true}).click();await page.waitForURL('**/admin/customer-record.html?**');
    await page.locator('[data-source-retry]').waitFor({state:'visible'});assert.match(await page.locator('[data-source-summary-text]').textContent(),/不必重傳原檔/);
    await page.getByRole('button',{name:'重新辨識',exact:true}).click();assert.equal(await page.getByRole('button',{name:'重新辨識',exact:true}).isVisible(),false);
    await page.getByText('辨識完成。請核對資料；人工修改、同意及簽名不會被自動覆蓋。',{exact:true}).first().waitFor();
    await wait(1000);assert.match(await page.locator('[data-source-summary-text]').textContent(),/^辨識完成/,'late listing error never replaces OCR status');
    assert.equal(await page.locator('[name="name"]').inputValue(),'辨識測試');assert.equal(await page.locator('[name="consent"]').isChecked(),false);
    listFails=false;await wait(5500);await page.getByRole('button',{name:'辨識並套用',exact:true}).waitFor();
    await page.locator('[name="name"]').fill('人工修改');await page.getByRole('button',{name:'辨識並套用',exact:true}).click();
    assert.equal(scanAttempts,2,'same file reuses successful result, no duplicate OCR request');assert.equal(await page.locator('[name="name"]').inputValue(),'人工修改');
    await page.setViewportSize({width:390,height:844});await page.locator('[data-source-panel] h2').scrollIntoViewIfNeeded();const box=await page.locator('[data-source-summary]').boundingBox();assert.ok(box.y>=0&&box.y<100,'OCR status remains visible while scrolling');
    // Large synthetic image: original bytes stay intact; OCR companion is bounded.
    const image=await page.evaluate(async()=>{
      const api=await import('/assets/customer-record-upload-api.js?v=test');const canvas=document.createElement('canvas');canvas.width=4000;canvas.height=3000;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,4000,3000);c.fillStyle='black';c.font='80px sans-serif';c.fillText('UPLOAD TEST ONLY',100,200);const b=await new Promise(r=>canvas.toBlob(r,'image/jpeg',1));const raw=new Uint8Array(await b.arrayBuffer());const padded=new Uint8Array(1800000);padded.set(raw);const file=new File([padded],'large.jpg',{type:'image/jpeg'});const encoded=await api.encodeRecordFile(file);return {original:atob(encoded.data).length,ocr:encoded.ocr&&atob(encoded.ocr.data).length};
    });assert.equal(image.original,1800000);assert.ok(image.ocr&&image.ocr<1800000);
    assert.deepEqual(errors,[]);console.log('PASS: immediate filename/progress during slow setup; no extra direct-upload listing; responsive scan/retry; independent list errors; no duplicate OCR; manual edits/consent preserved; sticky mobile status; original image retained with bounded OCR companion.');
  }finally{await browser.close();server.close();}
})().catch(error=>{server.close();console.error(error);process.exitCode=1;});
