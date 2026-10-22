export const RECORD_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_RECORD_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec";
export function validRecordEndpoint(value) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash; } catch { return false; }
}
export async function recordRequest(endpoint, action, payload = {}) {
  if (!validRecordEndpoint(endpoint)) throw new Error("上傳服務網址設定有誤。");
  const response = await fetch(endpoint, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify({action, ...payload}), signal:AbortSignal.timeout(120000), cache:"no-store", credentials:"omit", referrerPolicy:"no-referrer" });
  if (!response.ok) throw new Error("上傳服務暫時無法連線，請稍後再試。");
  const result = await response.json();
  if (!result.ok || result.service !== "customer-records-v1") throw new Error(result.message || "上傳服務尚未更新，請聯絡管理員完成部署。");
  return result;
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
