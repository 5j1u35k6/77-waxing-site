import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../assets/customer-record-upload-api.js',import.meta.url),'utf8');
const {recordRequest,encodeRecordFile}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
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
  await assert.rejects(recordRequest(endpoint,'record_list'),/確認|連線/);assert.equal(count,1);
  count=0;globalThis.fetch=async()=>{count++;throw new TypeError('network');};
  await assert.rejects(recordRequest(endpoint,'record_list'),/確認|連線/);assert.equal(count,2,'bounded retry');
  count=0;globalThis.fetch=async()=>{count++;return new Response('',{status:503});};
  await assert.rejects(recordRequest(endpoint,'record_scan'),/確認|連線/);assert.equal(count,2,'one bounded retry; server lease prevents duplicate OCR');
  count=0;globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({ok:false,service:'customer-records-v1',code:'ocr_busy',message:'仍在辨識'}));};
  await assert.rejects(recordRequest(endpoint,'record_scan'),/仍在辨識/);assert.equal(count,1,'never repeat a known running conversion');
  const upload=[];globalThis.fetch=async(_url,options)=>{upload.push(options.body);return upload.length===1?new Response('',{status:502}):ok();};
  await recordRequest(endpoint,'record_upload',{file:{requestId:'same-file-request',data:'dGVzdA=='}});
  assert.equal(upload.length,2);assert.equal(upload[0],upload[1]);
  const states=[];globalThis.fetch=async()=>ok();await recordRequest(endpoint,'record_upload',{}, {onState:state=>states.push(state)});
  assert.deepEqual(states,['sending','accepted']);
  const scanBodies=[];globalThis.fetch=async(_url,options)=>{scanBodies.push(options.body);return scanBodies.length===1?new Response('',{status:404}):ok();};
  await recordRequest(endpoint,'record_scan',{sessionId:'same-session',fileId:'same-file'});assert.equal(scanBodies.length,2);assert.equal(scanBodies[0],scanBodies[1],'404 recovery uses the same server-protected file');
  const previousReader=globalThis.FileReader,progress=[];
  globalThis.FileReader=class{readAsDataURL(){this.onprogress({lengthComputable:true,loaded:2,total:4});this.result='data:text/plain;base64,dGVzdA==';this.onload();}};
  try{const encoded=await encodeRecordFile({name:'test.txt',size:4,type:'text/plain'},{onProgress:(loaded,total)=>progress.push([loaded,total])});assert.equal(encoded.data,'dGVzdA==');assert.deepEqual(progress,[[2,4],[4,4]]);}finally{globalThis.FileReader=previousReader;}
  const submitBodies=[],submitUrls=[];globalThis.fetch=async(url,options)=>{submitBodies.push(options.body);submitUrls.push(url);return submitBodies.length<3?new Response('',{status:404}):ok();};
  await recordRequest(endpoint,'record_submit',{idToken:'synthetic',file:{requestId:'same',data:'dGVzdA=='}});
  assert.equal(submitBodies.length,3);assert.equal(new Set(submitBodies).size,1);assert.equal(new Set(submitUrls).size,3,'fresh redirect nonce, unchanged payload');
  const submitted=JSON.parse(submitBodies[0]);assert.match(submitted.requestId,/^[0-9a-f-]{36}$/);assert.match(submitted.uploadKey,/^[0-9a-f]{64}$/);
  console.log('PASS: bounded reconnects, unchanged submission/upload identities, fresh redirect nonce, real read progress, shared timeout, no authorization/business/running-job retries.');
} finally {globalThis.fetch=previousFetch;}
