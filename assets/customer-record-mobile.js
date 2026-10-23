import { recordRequest, encodeRecordFile, validRecordEndpoint } from "./customer-record-upload-api.js?v=20261023-auto5";
import { showUploadQueue } from "./customer-record-progress.js?v=20261023-auto5";
const args=new URLSearchParams(location.hash.slice(1));history.replaceState(null,"",location.pathname);
const endpoint=args.get("endpoint"),sessionId=args.get("session"),uploadKey=args.get("key");
const input=document.querySelector('input'),button=document.querySelector('button'),status=document.querySelector('[role="status"]');
let queueHost=document.querySelector('[data-upload-queue]'),batch=null,busy=false;
if(!queueHost){queueHost=document.createElement('ul');queueHost.className='record-files';queueHost.dataset.uploadQueue='';status.after(queueHost);}
const valid=validRecordEndpoint(endpoint)&&/^[\da-f-]{36}$/.test(sessionId||"")&&/^[\da-f]{64}$/.test(uploadKey||"");
if(!valid){status.textContent="上傳連結不完整，請重新掃描管理裝置上的 QR Code。";button.disabled=true;input.disabled=true;}
input.onchange=()=>{
  const files=Array.from(input.files||[]);if(!files.length||!valid)return;
  if(files.length>8){status.textContent='一次最多選取 8 個檔案。';return;}
  if(batch&&batch.completed<batch.jobs.length&&!confirm('尚有未確認的檔案，改選後無法繼續傳送這批檔案。確定改選？')){input.value='';return;}
  batch={jobs:files.map(file=>({file,encoded:null,accepted:false})),completed:0,queue:showUploadQueue(queueHost,files)};
  upload();
};
async function upload(){
  if(busy||!valid)return;
  if(!batch){status.textContent='請先選取檔案，選取後會自動上傳。';return;}
  const current=batch;busy=true;button.disabled=true;input.disabled=true;button.textContent='正在上傳…';
  try{
    for(let index=0;index<current.jobs.length;index++){
      const job=current.jobs[index];if(job.accepted)continue;
      status.textContent='正在處理 '+job.file.name+'（'+(index+1)+'/'+current.jobs.length+'）…';
      if(!job.encoded){current.queue.update(index,'reading');job.encoded=await encodeRecordFile(job.file,{onProgress:(loaded,total)=>current.queue.update(index,'reading','',loaded,total),onState:state=>current.queue.update(index,state)});}
      const result=await recordRequest(endpoint,'record_upload',{sessionId,uploadKey,file:job.encoded},{onState:state=>{if(state!=='accepted')current.queue.update(index,state);}});
      if(!result.uploaded||!result.verified)throw new Error('尚未取得原檔儲存確認，請按「繼續上傳」。');
      current.queue.update(index,'accepted');job.accepted=true;job.file=null;job.encoded=null;current.completed++;
    }
    status.textContent='原檔已確認保存。原管理裝置將自動辨識並帶入表格，請回原裝置核對。';input.value='';button.textContent='上傳完成';button.disabled=true;
  }catch(error){current.queue.update(current.completed,'failed',error.message);status.textContent='已確認保存 '+current.completed+' 個。'+error.message+' 未完成檔案保留在此頁，請按「繼續上傳」；關閉或重新整理會清除尚未確認的檔案。';button.textContent='繼續上傳';button.disabled=false;}
  finally{busy=false;input.disabled=false;}
}
button.onclick=upload;
window.addEventListener('beforeunload',event=>{if(batch&&batch.completed<batch.jobs.length){event.preventDefault();event.returnValue='';}});
