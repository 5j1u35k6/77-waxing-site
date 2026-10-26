const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.AUDIT_SOURCE_ROOT || path.resolve(__dirname, '..');
let failures = 0;
function test(name, fn) { try { fn(); console.log('PASS', name); } catch (e) { failures++; console.error('FAIL', name, e.message); } }
function runtime() {
  const props = new Map(), mails = [];
  let locked = false;
  const c = vm.createContext({console:{log(){},info(){},error(){}},Date,Math,JSON,Set,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
    LockService:{getScriptLock:()=>({tryLock(){if(locked)return false;locked=true;return true},releaseLock(){locked=false}})},
    Utilities:{getUuid:()=>Math.random().toString(36)},
    Session:{getEffectiveUser:()=>({getEmail:()=> '77waxing.mail@gmail.com'})},
    GmailApp:{sendEmail:(to,subject,text,options)=>mails.push({to,subject,text,html:options.htmlBody})}
  });
  vm.runInContext(fs.readFileSync(path.join(root,'apps-script/Code.gs'),'utf8'),c);
  c.json_ = x=>x; c.bookingCareBefore_=()=>'<p>施作前注意事項</p>';
  return {c,props,mails};
}
const booking = {status:'pending_confirmation',customerEmail:'customer@example.test',customerName:'測試',preferredDate:'2026-10-30',preferredTime:'20:00',durationMinutes:90};
test('identity POST actions reach identity router',()=>{
  const {c}=runtime(); c.routeIdentityLinkPost_=p=>p.action==='identity_status'?{ok:true,identity:true}:null;
  c.routeCustomerRecordsPost_=()=>null;
  assert.equal(c.doPost({postData:{contents:JSON.stringify({action:'identity_status',idToken:'test'})}}).identity,true);
});
test('linked member keeps birthday and LINE / Google metadata',()=>{
  const {c}=runtime(); vm.runInContext(fs.readFileSync(path.join(root,'apps-script/IdentityLink.gs'),'utf8'),c);
  const source={birthday:'2001-07-28',lineName:'LINE 測試',lineId:'legacy-id',googleEmail:'g@example.test',googleAvatarUrl:'https://example.test/avatar',lastBookingAt:'2026-10-30',displayName:'source',linkedProviders:['line']};
  let saved,deleted=false;
  c.identityAdminGetDoc_=(_collection,id)=>id==='source'?source:{displayName:'target',linkedProviders:['google']};
  c.identityAdminPatchDoc_=(_collection,_id,data)=>{saved=data};
  c.identityAdminDeleteDoc_=()=>{assert.equal(saved.birthday,source.birthday);deleted=true};
  c.identityAdminQueryDocs_=()=>[];
  c.migrateMemberOwnership_('source','target');
  for(const key of ['birthday','lineName','lineId','googleEmail','googleAvatarUrl','lastBookingAt']) assert.equal(saved[key],source[key],key);
  assert.equal(saved.displayName,undefined,'existing canonical name must remain');
  assert.deepEqual(Array.from(saved.linkedProviders),['google','line']); assert.equal(deleted,true);
});
test('confirmed paid deposit email does not claim no deposit',()=>{
  const {c,mails}=runtime(); c.sendForStatus_({...booking,status:'confirmed',depositRequired:true,paymentStatus:'paid',depositAmount:500},{},'paid-test');
  assert.match(mails[0].text,/已收到.*定金/); assert.doesNotMatch(mails[0].text,/不需付定金/);
});
test('confirmed no-deposit email stays explicit',()=>{
  const {c,mails}=runtime(); c.sendForStatus_({...booking,status:'confirmed',depositRequired:false},{},'no-deposit-test');
  assert.match(mails[0].text,/不需付定金/);
});
test('shop shipped and completed notices use shop brand / canonical link',()=>{
  const {c,mails}=runtime(); for(const status of ['shipped','completed']) c.sendShopOrderForStatus_({status,email:'customer@example.test',orderNo:'TEST',items:[]},{},`shop:${status}`);
  assert.ok(mails.every(m=>m.subject.startsWith('77 Select｜')));
  assert.match(mails[1].html,/https:\/\/5j1u35k6.github.io\/77select\//);
  assert.doesNotMatch(mails[1].text,/回到 77waxing 產品/);
});
test('simultaneous email dispatch does not send the same recipient twice',()=>{
  const {c,mails}=runtime(); c.fetchDocs_=()=>[booking,{}]; let reentered=false;
  const real=c.GmailApp.sendEmail;
  c.GmailApp.sendEmail=(...args)=>{real(...args);if(!reentered){reentered=true;c.doPost({postData:{contents:JSON.stringify({bookingId:'concurrent',idToken:'test'})}})}};
  c.handleBookingPost_({bookingId:'concurrent',idToken:'test'});
  assert.equal(mails.filter(m=>m.to===booking.customerEmail).length,1);assert.equal(mails.length,2);
});
test('partial delivery retry sends only the failed recipient',()=>{
  const {c,mails}=runtime(); c.fetchDocs_=()=>[booking,{}]; const real=c.GmailApp.sendEmail; let fail=true;
  c.GmailApp.sendEmail=(...args)=>{if(args[0]!=='customer@example.test'&&fail){fail=false;throw Error('temporary mail failure')}real(...args)};
  assert.throws(()=>c.handleBookingPost_({bookingId:'partial',idToken:'test'}),/temporary mail failure/);
  c.handleBookingPost_({bookingId:'partial',idToken:'test'});
  assert.equal(mails.filter(m=>m.to===booking.customerEmail).length,1);assert.equal(mails.length,2);
});
if(failures) process.exitCode=1;
