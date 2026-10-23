const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),snap=data=>({exists:()=>data!=null,data:()=>data});
function part(file,start,end){const s=read(file),a=s.indexOf(start),b=end?s.indexOf(end,a+start.length):s.length;assert.ok(a>=0&&b>a,file+': function boundaries');return s.slice(a,b);}
function context(code,values={}){const c=vm.createContext({console,Promise,Map,Set,JSON,Date,setTimeout,clearTimeout,...values});vm.runInContext(code,c);return c;}
(async()=>{
  let catalogCalls=0,failCatalog=false;const auth={currentUser:{uid:'member'},authStateReady:async()=>{}};
  let source=read('assets/service-catalog-store.js').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
  const catalog=context(source,{window:{},location:{pathname:'/booking/'},firebaseConfigured:true,getPublicFirebase:()=>({app:{},auth,db:{}}),doc:()=>({}),getDoc:async()=>{catalogCalls++;await pause(15);if(failCatalog)throw Error('offline');return snap({categories:[{key:'test',name:'正式服務',groups:[]}]});}});
  const result=await Promise.all([catalog.loadCatalog(),catalog.loadCatalog(),catalog.loadCatalog()]);
  assert.equal(catalogCalls,1);result[0][0].name='changed';assert.equal(result[1][0].name,'正式服務');
  await catalog.loadCatalog();assert.equal(catalogCalls,2);
  failCatalog=true;await assert.rejects(catalog.loadCatalog(),/offline/);failCatalog=false;await catalog.loadCatalog();assert.equal(catalogCalls,4);

  let active=0,peak=0,forced=0;const delayed=async value=>{active++;peak=Math.max(peak,active);await pause(25);active--;return value;};
  const user={uid:'member',getIdToken:async()=> 'valid-token'};const profileWrites=[];
  const member=context(part('assets/member-auth.js','async function loadProfile(','async function ensureProfile('),{
    user,isMember:u=>!!u,db:{},PROFILE_COLLECTION:'memberProfiles',IDENTITY_STATUS_URL:'https://example.invalid/',
    getIdTokenResult:async(_u,force)=>{if(force)forced++;return delayed({claims:{}});},
    fetch:async()=>delayed({ok:true,json:async()=>({ok:true,lineUserId:'line-subject'})}),
    doc:(_db,collection,id)=>({collection,id}),getDoc:async()=>delayed(snap({displayName:'測試',phone:'0900000000',birthday:'2001-07-28',lineId:'line-subject'})),
    setDoc:async(_r,data)=>profileWrites.push(data),serverTimestamp:()=>1,AbortSignal,
    fallbackProfile:u=>({uid:u.uid,lineId:u.__77MemberClaims?.lineUserId||''}),
  });
  const profile=await member.loadProfile(user);assert.equal(peak,3);assert.equal(forced,0);assert.equal(profile.lineId,'line-subject');assert.equal(profile.birthday,'2001-07-28');assert.equal(profileWrites.length,0);
  member.getDoc=async()=>snap(null);const createdProfile=await member.loadProfile({uid:'new-member',getIdToken:async()=> 'valid-token'});assert.equal(createdProfile.lineId,'line-subject');assert.equal(profileWrites.length,1);
  let finishProfile;const stale=context("let currentUser={uid:'A'},currentProfile=null,profilePromise=null;"+part('assets/member-auth.js','async function ensureProfile(','async function saveProfile(')+";this.switchUser=()=>{currentUser={uid:'B'};};this.profile=()=>currentProfile;",{isMember:()=>true,loadProfile:()=>new Promise(resolve=>{finishProfile=resolve;}),window:{dispatchEvent:()=>{throw Error('stale member event');}},CustomEvent:class{}});
  const staleRead=stale.ensureProfile();stale.switchUser();finishProfile({uid:'A'});assert.equal(await staleRead,null);assert.equal(stale.profile(),null);

  const variants=read('shop/admin-order-variants.js');
  const code=part('shop/admin-order-variants.js','function normalizeVariants(','async function audit(')+part('shop/admin-order-variants.js','async function confirmVariantOrder(','function polishOrderUi(');
  let pending=0,parallel=0;const updates=[];let order={status:'pending',items:['p1','p2','p3'].map(productId=>({productId,variantId:'v',quantity:2,region:'TW'})),shippingFee:60};
  const products=Object.fromEntries(['p1','p2','p3'].map(id=>[id,{active:true,name:id,stock:10,variants:[{id:'v',stock:10,priceTWD:100,bulkMinQty:2,bulkPriceTWD:80}]}]));
  const inventory=context(code,{int:n=>Math.max(0,Math.round(Number(n)||0)),doc:(_db,col,id)=>({col,id}),serverTimestamp:()=>1,
    runTransaction:async(_db,fn)=>fn({
      get:async ref=>{if(ref.col==='shopOrders')return snap(order);pending++;parallel=Math.max(parallel,pending);await pause(15);pending--;return snap(products[ref.id]);},
      update:(ref,data)=>{assert.equal(pending,0,'all reads before writes');updates.push({ref,data});},
    }),
  });
  await inventory.confirmVariantOrder({},'o');assert.equal(parallel,3);assert.equal(updates.length,4);
  const confirmed=updates.find(x=>x.ref.col==='shopOrders').data;assert.equal(confirmed.total,540);assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.inventoryCommitted,true);
  for(const update of updates.filter(x=>x.ref.col==='shopProducts'))assert.equal(update.data.stock,8);
  updates.length=0;products.p1.variants[0].stock=0;await assert.rejects(inventory.confirmVariantOrder({},'o'),/庫存不足/);assert.equal(updates.length,0);
  products.p1.variants[0].stock=10;order={...order,status:'confirmed',inventoryCommitted:true};await inventory.cancelVariantOrder({},'o','測試取消');assert.equal(updates.find(x=>x.ref.col==='shopOrders').data.status,'cancelled');
  assert.equal(updates.filter(x=>x.ref.col==='shopProducts')[0].data.stock,12);
  await assert.rejects(inventory.cancelVariantOrder({},'o',''),/原因/);

  const cartCode=part('shop/regional-store.js','async function refreshCartProducts(','async function loadProducts(');
  const requested=[];const cartContext=context("let cart=[{productId:'p1'},{productId:'p1'},{productId:'p2'}];let products=[{id:'p1',price:1},{id:'unrelated',price:9}];"+cartCode+";this.getProducts=()=>products;",{
    db:{},doc:(_d,_c,id)=>({id}),getDocFromServer:async ref=>{requested.push(ref.id);return {id:ref.id,...snap(ref.id==='p1'?{active:true,price:100}:null)};},
  });
  await cartContext.refreshCartProducts();assert.equal(requested.join(','),'p1,p2');assert.equal(cartContext.getProducts().find(p=>p.id==='p1').price,100);assert.equal(cartContext.getProducts().some(p=>p.id==='p2'),false);assert.equal(cartContext.getProducts().some(p=>p.id==='unrelated'),true);

  let batches=0;const ok=fields=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({fields})});
  let responses=[ok({status:{stringValue:'pending_confirmation'}}),{getResponseCode:()=>404,getContentText:()=>''}];
  const mail=context(part('apps-script/Code.gs','function fetchDocs_(','function footerHtml_('),{FIRESTORE_BASE:'https://example.invalid',UrlFetchApp:{fetchAll:entries=>{batches++;assert.equal(entries.length,2);assert.equal(entries[0].headers.Authorization,'Bearer valid-token');return responses;}}});
  const docs=mail.fetchDocs_([{path:'bookings/test'},{path:'settings/general',allowMissing:true}],'valid-token');assert.equal(docs[0].status,'pending_confirmation');assert.equal(docs[1],null);assert.equal(batches,1);
  responses=[{getResponseCode:()=>403,getContentText:()=> 'denied'},ok({})];assert.throws(()=>mail.fetchDocs_([{path:'bookings/test'},{path:'settings/general'}],'valid-token'),/firestore_403/);

  const booking=read('assets/booking-core.js');
  const blocks=context(part('assets/booking-core.js','const blockTimes =','const PHONE_COUNTRIES'),{pad:n=>String(n).padStart(2,'0')});
  const occupied=new Set(vm.runInContext("blockTimes('20:00',90)",blocks));
  const conflict=(time,duration)=>vm.runInContext("blockTimes("+JSON.stringify(time)+","+duration+")",blocks).some(t=>occupied.has(t));
  assert.equal([...occupied].join(','),'20:00,20:30,21:00');
  assert.equal(conflict('18:30',90),false);assert.equal(conflict('19:00',60),false);assert.equal(conflict('19:30',30),false);
  assert.equal(conflict('19:30',90),true);assert.equal(conflict('21:30',90),false);
  assert.match(booking,/Promise.all\(lockRefs.map\(lockRef => transaction.get\(lockRef\)\)\)/);
  assert.match(read('assets/customer-record-page.js'),/Promise.all\(\[listing,/);
  assert.doesNotMatch(read('assets/runtime-settings.js').slice(read('assets/runtime-settings.js').indexOf('async function ensureSignedIn')),/waitForExistingSignIn\(/);
  assert.match(variants,/await Promise.all\(\[\s*audit/);
  console.log('PASS: concurrent catalog coalescing/retry and mutation isolation; parallel member reads without forced refresh, LINE/phone/birthday preserved; fresh cart-only reads; atomic concurrent stock reads/discounts/cancellation/insufficient-stock; batched email authorization/missing settings; record scan and booking locks.');
})().catch(error=>{console.error(error);process.exitCode=1;});

