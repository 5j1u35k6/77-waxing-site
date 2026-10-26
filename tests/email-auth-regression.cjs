const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=process.env.AUDIT_SOURCE_ROOT||path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/email-dispatch.js'),'utf8').replace(/^import .*;\n/gm,'');
const observers=[],callbacks=[],pending=[],timers=[];
let requests=0;
const context=vm.createContext({console,location:{pathname:'/77-waxing-site/booking/'},getPublicFirebase:()=>({app:{}}),getAuth:()=>({currentUser:null}),getFirestore:()=>({}),getApps:()=>[],
  onAuthStateChanged:(_auth,fn)=>callbacks.push(fn),getDoc:()=>new Promise(resolve=>pending.push(resolve)),doc:()=>({}),
  document:{querySelector:()=>null,body:{}},MutationObserver:class{constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this)}observe(){}disconnect(){this.disconnected=true}},
  window:{addEventListener(){}},setTimeout:fn=>timers.push(fn),queueMicrotask,fetch:async()=>{requests++},sessionStorage:{setItem(){},getItem(){return null}}
});
vm.runInContext(source,context);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const a={uid:'A',getIdToken:async()=> 'test-A'},b={uid:'B',getIdToken:async()=> 'test-B'};
  callbacks[0](a); pending.shift()({exists:()=>false}); await tick();
  assert.equal(observers.length,1);
  callbacks[0](null); await tick();
  assert.equal(observers[0].disconnected,true,'logout disconnects old observer');
  assert.equal(vm.runInContext('currentUser',context),null,'logout clears dispatch user');
  callbacks[0](a); const old=pending.shift();
  callbacks[0](b); pending.shift()({exists:()=>false}); await tick();
  old({exists:()=>false}); await tick();
  assert.equal(observers.length,2,'stale A permission response cannot attach an observer');
  assert.equal(vm.runInContext('currentUser.uid',context),'B');
  assert.equal(await context.dispatchBooking(a,{},'old-booking'),false);
  assert.equal(requests,0,'old account cannot dispatch after switch');
  console.log('PASS email observer logout, delayed auth race, and stale dispatch');
})().catch(error=>{console.error(error);process.exitCode=1});
