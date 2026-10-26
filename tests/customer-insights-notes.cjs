const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^import\s[\s\S]*?;\r?\n/gm,'').replace(/\bexport /g,'');
const snap=data=>({exists:()=>data!=null,data:()=>data});
const context=vm.createContext({console,crypto:webcrypto,TextEncoder,Date,Intl,Map,Set});
vm.runInContext(read('assets/customer-record-data.js')+read('assets/customer-record-list.js')+read('assets/customer-analytics.js'),context);
const bookings=[
 {customerPhone:'0900000000',preferredDate:'2026-09-01',status:'completed',customerBirthday:'2001-10-27',customerGender:'male',serviceName:'臉部撥筋'},
 {customerPhone:'+886900000000',preferredDate:'2026-10-26',status:'confirmed',customerBirthday:'2001-10-27',customerGender:'生理男',serviceName:'臉部撥筋',ownerUid:'A'},
 {customerPhone:'0911111111',preferredDate:'2026-10-26',status:'completed',serviceName:'熱蠟'},
 {customerPhone:'0911111111',preferredDate:'2026-10-26',status:'cancelled'},
 {customerPhone:'0922222222',preferredDate:'2026-11-01',status:'confirmed'},
 {customerPhone:'0999999999',preferredDate:'2026-99-99',status:'confirmed'},
];
const data=context.analyzeCustomers(bookings,[{phone:'0933333333',birthday:'2026-99-99'}],new Map([['A',{lineUserId:'U-test'}]]),{days:30,today:'2026-10-26'});
assert.equal(data.customers,2);assert.equal(data.appointments,2);assert.equal(data.completed,1);assert.equal(data.cancelled,1);assert.equal(data.upcoming,1);
assert.equal(data.multiple,1);assert.equal(data.first,1);assert.equal(data.totalKnown,4);assert.equal(data.paperOnly,1);
assert.equal(data.ages['20–29 歲'],1);assert.equal(data.ages['未填寫／日期無效'],1);assert.equal(data.genders['生理男'],1);assert.equal(data.withLine,1);
assert.equal(data.services.find(row=>row[0]==='臉部鬆筋')[1],1);
assert.equal(context.analyzeCustomers([],[{phone:'0933333333'}],new Map(),{days:0,today:'2026-10-26'}).customers,0);
console.log('PASS: truthful booking cohorts, normalized phones, manual-only customers, date boundaries, cancelled/future exclusion, missing demographics and service wording');

(async()=>{
 const rows=new Map([['customers/paper_existing',{kind:'waxing_customer_record',name:'紙本資料'}]]);let writes=0;
 const merge=(target,patch)=>{for(const [key,value] of Object.entries(patch)){if(value&&typeof value==='object'&&!Array.isArray(value)&&!('seconds'in value)){target[key]||={};merge(target[key],value);}else target[key]=value;}return target;};
 const notes=vm.createContext({console,crypto:webcrypto,TextEncoder,Date,Intl,
  doc:(_db,col,id)=>({key:col+'/'+id}),getDocFromServer:async ref=>snap(rows.get(ref.key)),serverTimestamp:()=>({seconds:123,toDate:()=>new Date('2026-10-26T04:00:00Z')}),
  runTransaction:async(_db,fn)=>fn({get:async ref=>snap(rows.get(ref.key)),set:(ref,patch)=>{writes++;rows.set(ref.key,merge(rows.get(ref.key)||{},patch));}})
 });
 vm.runInContext(read('assets/customer-notes.js'),notes);
 const customer={key:'0900000000',name:'測試',phone:'0900000000'},user={uid:'admin-A',displayName:'店家甲'};
 let saved=await notes.saveCustomerNote({},user,customer,'','首次備註');
 const first=saved.noteRevision;
 assert.equal(saved.storeNote,'首次備註');assert.equal(Object.keys(saved.storeNoteHistory).length,1);
 saved=await notes.saveCustomerNote({},user,customer,first,'更新備註');
 assert.equal(Object.keys(saved.storeNoteHistory).length,2);
 assert.equal(Object.values(saved.storeNoteHistory)[1].before,'首次備註');
 assert.equal(Object.values(saved.storeNoteHistory)[1].editorUid,'admin-A');
 await assert.rejects(notes.saveCustomerNote({},user,customer,first,'過期視窗的內容'),/其他管理員/);
 const before=writes;
 await notes.saveCustomerNote({},user,customer,first,'更新備註');assert.equal(writes,before,'retry of a verified saved value adds no revision');
 saved=await notes.saveCustomerNote({},user,customer,saved.noteRevision,'');
 assert.equal(Object.keys(saved.storeNoteHistory).length,3,'clearing also keeps history');
 await assert.rejects(notes.saveCustomerNote({},{uid:'anon',isAnonymous:true},customer,'','x'),/管理員/);
 await assert.rejects(notes.saveCustomerNote({},user,customer,'','x'.repeat(2001)),/2,000/);
 assert.equal(rows.get('customers/paper_existing').name,'紙本資料');
 assert.equal(await notes.customerProfileId(customer.key),await notes.customerProfileId(customer.key),'registration UID does not change customer identity');
 console.log('PASS: private note persistence, server readback, append-only revisions, author/time, conflict protection, retry idempotency, clearing history and paper preservation');
})().catch(error=>{console.error(error);process.exitCode=1});
