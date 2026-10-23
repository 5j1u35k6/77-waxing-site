import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../assets/customer-record-upload-api.js',import.meta.url),'utf8');
const {recordRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const endpoint='https://script.google.com/macros/s/test/exec',previousFetch=globalThis.fetch;
const ok=()=>new Response(JSON.stringify({ok:true,service:'customer-records-v1'}),{status:200,headers:{'Content-Type':'application/json'}});
try {
  const calls=[];globalThis.fetch=async(_url,options)=>{calls.push(options);return calls.length===1?new Response('',{status:404}):ok();};
  await recordRequest(endpoint,'record_create',{idToken:'synthetic'});
  assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);
  const create=JSON.parse(calls[0].body);assert.match(create.requestId,/^[\da-f-]{36}$/);assert.match(create.uploadKey,/^[\da-f]{64}$/);
  assert.equal(calls[0].signal,calls[1].signal,'one overall timeout, not a new timeout on each attempt');
  let count=0;globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({ok:false,service:'customer-records-v1',message:'拒絕存取'}));};
  await assert.rejects(recordRequest(endpoint,'record_list'),/拒絕存取/);assert.equal(count,1);
  count=0;globalThis.fetch=async()=>{count++;return new Response('',{status:403});};
  await assert.rejects(recordRequest(endpoint,'record_list'),/連線/);assert.equal(count,1);
  count=0;globalThis.fetch=async()=>{count++;throw new TypeError('network');};
  await assert.rejects(recordRequest(endpoint,'record_list'),/連線/);assert.equal(count,2,'bounded retry');
  count=0;globalThis.fetch=async()=>{count++;return new Response('',{status:503});};
  await assert.rejects(recordRequest(endpoint,'record_scan'),/連線/);assert.equal(count,1,'do not repeat expensive OCR automatically');
  const upload=[];globalThis.fetch=async(_url,options)=>{upload.push(options.body);return upload.length===1?new Response('',{status:502}):ok();};
  await recordRequest(endpoint,'record_upload',{file:{requestId:'same-file-request',data:'dGVzdA=='}});
  assert.equal(upload.length,2);assert.equal(upload[0],upload[1]);
  console.log('PASS: one bounded transport retry, same secure creation/upload identifiers, shared timeout, no retry of authorization/business errors or OCR.');
} finally {globalThis.fetch=previousFetch;}

