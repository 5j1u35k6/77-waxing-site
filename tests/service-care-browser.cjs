const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const store=fs.readFileSync(path.join(root,'assets/service-catalog-store.js'),'utf8');
const catalogCtx=vm.createContext({});vm.runInContext(store.slice(store.indexOf('const serviceItem ='),store.indexOf('function ',store.indexOf('export const DEFAULT_CATALOG'))).replace('export const DEFAULT_CATALOG','globalThis.catalog'),catalogCtx);
const catalog=JSON.parse(JSON.stringify(catalogCtx.catalog));
let writes=[];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://test');let route=url.pathname.replace(/^\/77-waxing-site/,'');
  if(route==='/booking/'){
    res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/booking.css"><link rel="stylesheet" href="/assets/booking-core.css"><main id="app"><div id="booking" data-firebase-mounted="1"></div></main><script type="module" src="/assets/booking-core.js"></script><script src="/assets/booking-addons.js"></script>');return;
  }
  if(route==='/services/skin-care/'){
    res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/pages.css"><link rel="stylesheet" href="/assets/catalog.css"><main id="app"></main><script type="module" src="/assets/catalog-dynamic.js"></script>');return;
  }
  if(route==='/assets/service-catalog-store.js'){
    res.setHeader('Content-Type','text/javascript');res.end(`export const loadCatalog=async()=>${JSON.stringify(catalog)};export const publicCatalog=x=>x;export const watchCatalog=async()=>{};`);return;
  }
  if(route==='/assets/public-firebase.js'){
    res.setHeader('Content-Type','text/javascript');res.end('export const getPublicFirebase=()=>({app:{},auth:{currentUser:{uid:"mock-member"}},db:{}})');return;
  }
  const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
    await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:route.request().url().includes('firebase-auth')?'export const signInAnonymously=async()=>({user:{uid:"mock-member"}});':`export const collection=(_db,name)=>({collection:name});export const doc=(arg,id)=>({id:id||'mock-booking',collection:arg.collection});export const getDocsFromServer=async()=>({docs:[],forEach:()=>{}});export const query=(...args)=>args;export const where=(...args)=>args;export const serverTimestamp=()=>({seconds:123});export const runTransaction=async(_db,fn)=>fn({get:async()=>({exists:()=>false}),set:(ref,data)=>{window.testWrites??=[];window.testWrites.push({ref,data});}});`}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/booking/');await page.locator('[data-booking-item="women-private"]').click();
    assert.equal(await page.locator('dialog[open]').count(),1);assert.match(await page.locator('dialog').innerText(),/0.5 公分/);assert.equal(await page.locator('dialog details').first().getAttribute('open'),'');assert.equal(await page.locator('dialog details').nth(1).getAttribute('open'),null);
    await page.getByRole('button',{name:'關閉提醒，繼續預約'}).click();await page.locator('[data-step="1"] [data-next]').click();await page.locator('[data-slot-time="10:00"]').first().click();await page.locator('[data-step="2"] [data-next]').click();
    for(const [name,value] of [['name','功能測試'],['phone','0900000000'],['email','test@example.invalid'],['birthday','2001-07-28']])await page.locator(`[name="${name}"]`).fill(value);
    await page.locator('[name="gender"]').selectOption('male');await page.locator('[name="ok"]').check();await page.locator('[data-step="3"] [data-next]').click();assert.match(await page.locator('[data-care-confirmation]').innerText(),/0.5 公分/);await page.locator('[data-submit]').click();await page.locator('.success.on').waitFor();assert.match(await page.locator('.success .care-reminder').innerText(),/0.5 公分/);assert.equal(await page.evaluate(()=>window.testWrites.filter(row=>row.ref.collection==='bookings').length),1);
    await page.goto('about:blank');await page.goto(origin+'/booking/#category=bust&item='+encodeURIComponent('基礎美胸'));await page.locator('dialog[open]').waitFor();assert.match(await page.locator('dialog').innerText(),/隆乳/);assert.doesNotMatch(await page.locator('dialog').innerText(),/0.5 公分/);assert.match(await page.locator('[data-booking-prefill-note]').textContent(),/基礎美胸/);await page.locator('.care-close').click();await page.locator('[data-booking-category="men"]').click();assert.equal(await page.locator('[data-booking-care] .care-reminder').count(),0);await page.locator('[data-booking-item="men-private"]').click();assert.match(await page.locator('dialog').innerText(),/熱蠟除毛/);
    await page.goto(origin+'/77-waxing-site/services/skin-care/');await page.locator('[data-service-item-id="skin-massage-basic"] .service-care-trigger').click();assert.equal(await page.locator('dialog .care-guide').count(),2);assert.match(await page.locator('dialog').innerText(),/請勿空腹或過飽/);
    for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);assert.ok((await page.locator('dialog').boundingBox()).width<=width);}
    await page.setViewportSize({width:1200,height:1000});await page.screenshot({path:path.join(root,'artifacts/service-care-preview.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('[data-service-item-id="skin-massage-basic"] .service-care-trigger').evaluate(el=>el===document.activeElement),true);
    assert.deepEqual(errors,[]);console.log('PASS: service-card modal; before/during/after; immediate item selection + price prefill; category clearing; confirmation and successful booking reminders; 1440/390px and Escape/focus restoration. Firebase mocked; no real bookings or email.');
  }finally{await browser.close();server.close();}
})().catch(e=>{server.close();console.error(e);process.exitCode=1;});
