import { recordRequest, encodeRecordFile, validRecordEndpoint } from "./customer-record-upload-api.js?v=20261023-upload3";
import { showUploadQueue } from "./customer-record-progress.js?v=20261023-upload3";
const args=new URLSearchParams(location.hash.slice(1));history.replaceState(null,"",location.pathname);
const endpoint=args.get("endpoint"),sessionId=args.get("session"),uploadKey=args.get("key");
const input=document.querySelector('input'),button=document.querySelector('button'),status=document.querySelector('[role="status"]');
let queueHost=document.querySelector('[data-upload-queue]');
if(!queueHost){queueHost=document.createElement('ul');queueHost.className='record-files';queueHost.dataset.uploadQueue='';status.after(queueHost);}
input.onchange=()=>{const files=Array.from(input.files||[]);showUploadQueue(queueHost,files);status.textContent=files.length?'已選取 '+files.length+' 個檔案，請按「上傳」。':'';};
if(!validRecordEndpoint(endpoint)||!/^[\da-f-]{36}$/.test(sessionId||"")||!/^[\da-f]{64}$/.test(uploadKey||"")){status.textContent="上傳連結不完整，請重新掃描管理裝置上的 QR Code。";button.disabled=true;}
else button.onclick=async()=>{
  const files=Array.from(input.files||[]);
  if(!files.length){status.textContent="請先選取檔案。";return;}
  if(files.length>8){status.textContent="一次最多選取 8 個檔案。";return;}
  button.disabled=true;input.disabled=true;let completed=0;
  const queue=showUploadQueue(queueHost,files);
  try{
    for(let index=0;index<files.length;index++){
      status.textContent='正在處理 '+files[index].name+'（'+(index+1)+'/'+files.length+'）…';queue.update(index,'reading');
      const file=await encodeRecordFile(files[index],{onProgress:(loaded,total)=>queue.update(index,'reading','',loaded,total),onState:state=>queue.update(index,state)});
      await recordRequest(endpoint,'record_upload',{sessionId,uploadKey,file},{onState:state=>queue.update(index,state)});completed++;
    }
    status.textContent="上傳完成，請回到原本裝置檢視並辨識檔案。";input.value="";
  }catch(error){queue.update(completed,'failed',error.message);status.textContent='已上傳 '+completed+' 個。'+error.message+' 尚未成功的檔案可重新選取後再試。';}
  finally{button.disabled=false;input.disabled=false;}
};
