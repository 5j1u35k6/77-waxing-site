export const RECORD_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_RECORD_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
export function validRecordEndpoint(value) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash; } catch { return false; }
}
export async function recordRequest(endpoint, action, payload = {}) {
  if (!validRecordEndpoint(endpoint)) throw new Error("上傳服務網址設定有誤。");
  const data = {...payload};
  // Retry the same authenticated creation, never create a second staging folder.
  if (action === "record_create") {
    data.requestId ||= crypto.randomUUID();
    data.uploadKey ||= Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2,"0")).join("");
  }
  const body = JSON.stringify({action, ...data});
  const retryable = ["record_create","record_upload","record_list","record_download","record_close"].includes(action);
  const signal = AbortSignal.timeout(120000);
  for (let attempt=0; attempt<2; attempt++) {
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
    if (!result.ok || result.service !== "customer-records-v1") throw new Error(result.message || "上傳服務尚未更新，請聯絡管理員完成部署。");
    return result;
  }
}
export async function encodeRecordFile(file) {
  if (!file.size || file.size > RECORD_MAX_BYTES) throw new Error(`${file.name}：檔案需介於 1 byte 與 5 MB。`);
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("檔案讀取失敗。"));
    reader.onload = () => resolve({name:file.name, mime:file.type || "application/octet-stream", data:String(reader.result).split(",")[1], requestId:crypto.randomUUID()});
    reader.readAsDataURL(file);
  });
}

