export const RECORD_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_RECORD_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
export function validRecordEndpoint(value) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash; } catch { return false; }
}
export async function recordRequest(endpoint, action, payload = {}, {onState=()=>{}} = {}) {
  if (!validRecordEndpoint(endpoint)) throw new Error("上傳服務網址設定有誤。");
  const data = {...payload};
  // Retry the same authenticated creation, never create a second staging folder.
  if (action === "record_create") {
    data.requestId ||= crypto.randomUUID();
    data.uploadKey ||= Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2,"0")).join("");
  }
  const body = JSON.stringify({action, ...data});
  // OCR is now protected by a server-side per-file lease and completed-result reuse.
  const retryable = ["record_create","record_upload","record_list","record_download","record_close","record_scan"].includes(action);
  const signal = AbortSignal.timeout(120000);
  for (let attempt=0; attempt<2; attempt++) {
    onState(attempt ? 'retrying' : 'sending');
    let response;
    try {
      response = await fetch(endpoint, {method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body,signal,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"});
    } catch (error) {
      if (retryable && !attempt && !signal.aborted && error instanceof TypeError) { await new Promise(resolve=>setTimeout(resolve,350)); continue; }
      throw new Error(signal.aborted ? "上傳服務回應逾時，請稍後再試。" : "上傳服務暫時無法連線，請稍後再試。");
    }
    if (!response.ok) {
      if (retryable && !attempt && [404,408,429,500,502,503,504].includes(response.status)) { await new Promise(resolve=>setTimeout(resolve,350)); continue; }
      throw new Error("上傳服務暫時無法連線，請稍後再試。");
    }
    let result;
    try { result = await response.json(); }
    catch (error) {
      if (retryable && !attempt && !signal.aborted) { await new Promise(resolve=>setTimeout(resolve,350)); continue; }
      throw new Error("上傳服務回應格式有誤，請稍後再試。");
    }
    // Authorization, validation, expiry and other business errors are never retried.
    if (!result.ok || result.service !== "customer-records-v1") {
      const error=new Error(result.message || "上傳服務回應異常，請稍後再試；原檔不會因此被刪除。");
      error.code=result.code || 'service_error';throw error;
    }
    onState('accepted');
    return result;
  }
}
export async function encodeRecordFile(file, {onProgress=()=>{},onState=()=>{}} = {}) {
  if (!file.size || file.size > RECORD_MAX_BYTES) throw new Error(`${file.name}：檔案需介於 1 byte 與 5 MB。`);
  const data=await new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("檔案讀取失敗。"));
    reader.onprogress=event=>{if(event.lengthComputable)onProgress(event.loaded,event.total);};
    reader.onload = () => {onProgress(file.size,file.size);resolve(String(reader.result).split(",")[1]);};
    reader.readAsDataURL(file);
  });
  const result={name:file.name,mime:file.type || 'application/octet-stream',data,requestId:crypto.randomUUID()};
  // Preserve the exact original; provide a smaller, local-only copy for Drive OCR.
  if(file.size>1500000 && /^(image\/(jpeg|png))$/.test(file.type) && typeof createImageBitmap==='function') {
    onState('optimizing');let image;
    try {
      image=await createImageBitmap(file);
      if(image.width*image.height>45000000)throw new Error('image_dimensions');
      const scale=Math.min(1,2800/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [.9,.82,.74]) {
        const encoded=canvas.toDataURL('image/jpeg',quality).split(',')[1];
        if(encoded && encoded.length<2400000 && encoded.length<data.length){result.ocr={mime:'image/jpeg',data:encoded};break;}
      }
    } catch {onState('original');} finally {image?.close();}
  }
  return result;
}
