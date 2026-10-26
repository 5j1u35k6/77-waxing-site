const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),content=fs.readFileSync(path.join(root,'assets/service-care-content.js'),'utf8');
assert.equal(content,fs.readFileSync(path.join(root,'apps-script/ServiceCare.gs'),'utf8'),'email and browser content must match');
const context=vm.createContext({});vm.runInContext(content,context);const care=context.WaxingServiceCare;
for(const [category,item,expected] of [
  [{key:'women'},{name:'私密處VIO全除'},['wax']],
  [{key:'men'},{name:'腹部'},['wax']],
  [{key:'skin'},{name:'修修臉粉刺毛孔大掃除'},['face']],
  [{key:'skin'},{name:'全方位臉部撥筋'},['face','massage']],
  [{key:'skin'},{name:'臉部熱蠟'},['wax']],
  [{key:'skin'},{name:'果酸美背'},['general']],
  [{key:'bust'},{name:'基礎美胸'},['bust']],
  [{key:'new'},{name:'尚未對應服務'},['general']]
])assert.deepEqual(Array.from(care.resolve(category,item)),expected);
for(const [serviceName,expected] of [
  ['女仕熱蠟｜私密處VIO全除',['wax']],['男仕熱蠟｜腹部',['wax']],
  ['臉部保養｜3D提亮更新',['face']],['臉部保養｜原液穩膚保養',['face']],
  ['臉部放鬆｜全方位臉部鬆筋',['face','massage']],
  ['身體放鬆｜基礎胸部放鬆',['bust']],['身體放鬆｜全方位胸放鬆',['bust']],
  ['身體放鬆｜腹部緊實課程',['general']],['身體放鬆｜進階胸腹課程',['bust','general']]
])assert.deepEqual(Array.from(care.forBooking({serviceName}),v=>v.id),expected,serviceName);
assert.deepEqual(Array.from(care.forBooking({serviceName:'肌膚管理｜全方位臉部撥筋',note:'[加購項目] 臉部熱蠟'}),v=>v.id),['face','massage','wax']);
for(const guide of Object.values(care.guides))for(const stage of ['before','during','after'])assert.ok(guide[stage].length);
const sent=[];vm.runInContext(fs.readFileSync(path.join(root,'apps-script/Code.gs'),'utf8'),context);
context.send_=(to,subject,html)=>sent.push({to,subject,html});
for(const status of ['pending_confirmation','pending_payment','confirmed']){
  sent.length=0;context.sendForStatus_({status,depositRequired:status==='confirmed'?false:true,serviceName:'男士熱蠟｜腹部',customerEmail:'example@example.invalid',customerName:'測試',preferredDate:'2026-10-30',preferredTime:'20:00',durationMinutes:90},{storeEmail:'store@example.invalid'});
  const mail=sent.find(v=>v.to==='example@example.invalid');assert.match(mail.html,/施作前注意事項/);assert.match(mail.html,/0.5 公分/);assert.doesNotMatch(mail.html,/隆乳/);assert.match(mail.html,/20:00–21:30/);
  assert.doesNotMatch(mail.subject+mail.html,/訂金/);
  if(status==='pending_payment'){assert.match(mail.subject,/請完成定金付款/);assert.match(mail.html,/待付定金/);assert.match(mail.html,/請依下方資訊完成定金付款/);}
  if(status==='confirmed')assert.match(mail.html,/不需付定金/);

}
sent.length=0;context.sendForStatus_({status:'cancelled',rejectionReasonCode:'conflict',customerEmail:'example@example.invalid'},{});assert.doesNotMatch(sent[0].html,/施作前注意事項/);
const bust=context.bookingCareBefore_({serviceName:'美胸保養｜基礎美胸'});assert.match(bust,/隆乳/);assert.doesNotMatch(bust,/0.5 公分/);
const safe=context.bookingCareBefore_({serviceName:'<script>測試</script>'});assert.doesNotMatch(safe,/<script>/);
console.log('PASS: correct service mapping, unknown/body fallback, combined addons, complete stages, matching email content in all three booking statuses, no cancellation/shop behavior changes. No emails sent.');
