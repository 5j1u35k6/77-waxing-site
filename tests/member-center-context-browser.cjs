// Run with Playwright installed; identity/database operations are local mocks.
const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), sourceRoot = process.env.MEMBER_TEST_ROOT || root;
const authMock = [
  'export const browserLocalPersistence={};',
  'export const setPersistence=async()=>{};',
  'export const getRedirectResult=async()=>null;',
  'export const getIdTokenResult=async()=>({claims:{}});',
  'export class OAuthProvider { addScope(){} }',
  'export const signInWithRedirect=async()=>{};',
  'export const onAuthStateChanged=(auth,callback)=>{',
  '  window.changeMember=async uid=>{',
  '    auth.currentUser=uid?{uid,isAnonymous:false,displayName:"會員 "+uid,email:uid+"@example.invalid",providerData:[],getIdToken:async()=>"fixture"}:null;',
  '    await callback(auth.currentUser);',
  '  };',
  '  setTimeout(()=>window.changeMember("A"),0);',
  '};',
  'export const signOut=async()=>window.changeMember(null);',
].join('\n');
const firestoreMock = [
  'export const collection=(_db,name)=>name;',
  'export const doc=(_db,name,id)=>({name,id});',
  'export const query=(...args)=>args;',
  'export const where=(...args)=>args;',
  'export const serverTimestamp=()=>1;',
  'export const setDoc=async()=>{throw Error("Unexpected profile write");};',
  'export const getDoc=async ref=>({exists:()=>true,data:()=>({displayName:"<img src=x onerror=alert(1)>",email:ref.id+"@example.invalid",phone:"0900000000",birthday:"2001-07-28",gender:"male"})});',
  'export const getDocs=async query=>{',
  '  (window.bookingQueries ||= []).push(query);',
  '  if(window.deferHistory) await new Promise(resolve=>window.finishHistory=resolve);',
  '  return {docs:[{id:"appointment",data:()=>({ownerUid:query[1][2],serviceName:"測試熱蠟施作",preferredDate:"2026-10-30",preferredTime:"20:00",durationMinutes:90,status:"confirmed"})}]};',
  '};',
].join('\n');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture'), route=url.pathname.replace(/^\/77-waxing-site/,'');
  if(route.endsWith('.js') || route.endsWith('.css')){
    res.setHeader('Content-Type',route.endsWith('.js')?'text/javascript':'text/css');
    if(route==='/assets/public-firebase.js') return res.end('window.fixtureAuth={};export const getPublicFirebase=()=>({auth:window.fixtureAuth,db:{}});');
    const baseRoot=path.resolve(route.endsWith('member-auth.js')?sourceRoot:root);
    const file=path.resolve(baseRoot,'.'+route);
    if(!file.startsWith(baseRoot+path.sep)||!fs.existsSync(file)) return res.writeHead(404).end();
    return res.end(fs.readFileSync(file));
  }
  const shop=url.searchParams.get('nav')!=='waxing';
  const base=url.pathname.startsWith('/77select')?'<base href="/77-waxing-site/shop/">':'';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<meta name="viewport" content="width=device-width">'+base+'<style>*,*::before,*::after{box-sizing:border-box}</style>'+
    (shop?'<nav class="shop-nav"><button data-tab="orders">我的訂單</button><button id="cart-open">購物車 10</button></nav><section id="orders-view" hidden>商店訂單</section>':'<header class="header"><nav></nav></header>')+
    '<script>document.querySelector(\'[data-tab="orders"]\')?.addEventListener("click",()=>{document.querySelector("#orders-view").hidden=false;});</script>'+
    '<script type="module" src="/assets/member-auth.js"></script>');
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try {
    const context=await browser.newContext(),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:route.request().url().includes('firebase-auth')?authMock:firestoreMock}));
    await context.route('https://77waxing-line-auth-proxy.max19450.workers.dev/**',route=>route.fulfill({contentType:'application/json',body:'{"ok":true}'}));
    const origin='http://127.0.0.1:'+server.address().port;
    async function visit(route){await page.goto(origin+route);await page.waitForFunction(()=>window.__77_MEMBER__?.profile);}
    for(const route of ['/77select/','/77select/index.html','/77-waxing-site/shop/','/77-waxing-site/shop/index.html','/']){
      await visit(route);
      await page.locator('[data-member-trigger]').click();
      const center=page.locator('#member-center-wrap');
      await center.locator('[data-member-orders]').waitFor();
      assert.match(await center.innerText(),/77select MEMBER/);
      assert.doesNotMatch(await center.innerText(),/預約|施作|熱蠟|生理性別/);
      assert.equal(await center.locator('img').count(),0,'profile data must be escaped');
      assert.equal(await page.evaluate(()=>window.bookingQueries?.length||0),0,'shop must not query bookings');
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:900});
        assert.ok(await center.locator('.member-center-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no narrow-screen overflow');
      }
      await center.locator('[data-member-orders]').click();
      assert.equal(await center.isVisible(),false);
      assert.equal(await page.locator('#orders-view').isVisible(),true);
      assert.equal(await page.locator('#cart-open').innerText(),'購物車 10');
      await page.locator('[data-member-trigger]').click();
      await page.evaluate(()=>window.changeMember(null));
      assert.equal(await center.isVisible(),false);
      assert.equal(await center.locator('[data-member-profile-summary]').innerText(),'');
      await page.locator('[data-member-trigger]').click();
      assert.doesNotMatch(await page.locator('#member-auth-wrap').innerText(),/預約|施作/);
    }
    await visit('/77-waxing-site/booking/?nav=waxing');
    await page.locator('[data-member-trigger]').click();
    await page.locator('.member-history-card').waitFor();
    const waxingText=await page.locator('#member-center-wrap').innerText();
    assert.match(waxingText,/77waxing MEMBER/);
    assert.match(waxingText,/測試熱蠟施作/);
    assert.deepEqual(await page.evaluate(()=>window.bookingQueries),[['bookings',['ownerUid','==','A']]]);
    // A delayed appointment response must not reappear after account switching.
    await page.locator('[data-member-center-close]').last().click();
    await page.evaluate(()=>{window.deferHistory=true;});
    await page.locator('[data-member-trigger]').click();
    await page.waitForFunction(()=>!!window.finishHistory);
    await page.evaluate(async()=>{await window.changeMember('B');window.finishHistory();});
    await page.waitForFunction(()=>document.querySelector('[data-member-history]').childElementCount===0);
    assert.equal(await page.locator('#member-center-wrap').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: five store routes never query bookings; orders navigation, cart, escaping, mobile layout, logout and stale history isolation; waxing owner-scoped history retained.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
