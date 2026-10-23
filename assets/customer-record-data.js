import { recordOptions, recordTerms } from './customer-record-fields.js?v=20261023-paper';

export const RECORD_KIND='waxing_customer_record';
export const RECORD_VERSION=3;
export const recordConsentStatement='本人在此聲明此份公開表格完全為我本人並以我最佳的健康狀態和認知狀況所填寫且同意接受熱蠟除毛服務。';
export const scalarRecordFields=['consultationDate','customerNumber','name','birthday','height','weight','phone','line','occupation','address','desiredArea','firstWaxing','waxingCount','lastWaxingDate','lastWaxingArea','skinOther','diseaseOther','sensitivitySource','intimateInflammation','inflammationReason','currentSkinIssue','issueArea','issueSymptoms','signatureDate','email','service','note'];
export function normalizeRecordPhone(value){const digits=String(value||'').replace(/\D/g,'');return digits.startsWith('886')&&digits.length===12?'0'+digits.slice(3):digits;}
export function cleanRecord(input={}){
  const data={};
  for(const key of scalarRecordFields)data[key]=String(input[key]||'').trim().slice(0,key==='note'?1000:200);
  for(const [key,options] of Object.entries(recordOptions))data[key]=options.filter(v=>Array.isArray(input[key])&&input[key].includes(v));
  data.sensitiveSkin=input.sensitiveSkin===true;data.consent=input.consent===true;
  if(data.firstWaxing!=='是'){data.waxingCount='';data.lastWaxingDate='';data.lastWaxingArea='';}
  if(!data.skinConditions.includes('其他'))data.skinOther='';
  if(!data.skinDiseases.includes('其他'))data.diseaseOther='';
  if(!data.sensitiveSkin)data.sensitivitySource='';
  if(data.intimateInflammation!=='是')data.inflammationReason='';
  if(data.currentSkinIssue!=='是'){data.issueArea='';data.issueSymptoms='';}
  return data;
}
export function validateRecord(data,signaturePng=''){
  data=cleanRecord(data);
  if(!data.name)return '請填寫姓名。';
  if(data.name.length>80)return '姓名請勿超過 80 個字。';
  if(!/^\d{8,15}$/.test(normalizeRecordPhone(data.phone)))return '請填寫有效的手機號碼（8–15 碼）。';
  for(const key of ['consultationDate','birthday','lastWaxingDate','signatureDate']){
    const value=data[key];if(!value)continue;
    const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/),d=match?new Date(value+'T00:00:00Z'):null;
    if(!match||!d||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value||Number(match[1])<1900)return '請檢查日期是否正確。';
    if(key==='birthday' && value>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date()))return '生日不可晚於今天。';
  }
  for(const [key,max] of [['height',300],['weight',500],['waxingCount',1000]])if(data[key]!==''&&(!Number.isFinite(Number(data[key]))||Number(data[key])<0||Number(data[key])>max||(key==='waxingCount'&&!Number.isInteger(Number(data[key])))))return '請檢查身高、體重及除毛次數。';
  if(data.skinConditions.includes('其他')&&!data.skinOther)return '請填寫肌膚狀況的其他說明。';
  if(data.skinDiseases.includes('其他')&&!data.diseaseOther)return '請填寫皮膚疾病的其他說明。';
  if(data.sensitiveSkin&&!data.sensitivitySource)return '請填寫過敏及敏感來源。';
  if(data.consent&&(!signaturePng||!data.signatureDate))return '已勾選同意，請由本人完成簽名及日期；或先取消同意，儲存未完成本人確認的紀錄。';
  if(signaturePng && (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signaturePng)||signaturePng.length>240000))return '簽名圖片無效或過大，請重新簽名。';
  return '';
}
export function recordPayload(data,signaturePng){
  const form=cleanRecord(data);const error=validateRecord(form,signaturePng);if(error)throw new Error(error);
  return {kind:RECORD_KIND,schemaVersion:RECORD_VERSION,termsVersion:'paper-2026-10-23',terms:[...recordTerms],consentStatement:recordConsentStatement,form,signaturePng,name:form.name,phone:form.phone,phoneNormalized:normalizeRecordPhone(form.phone),birthday:form.birthday,line:form.line,email:form.email,consultationDate:form.consultationDate,confirmationStatus:form.consent&&signaturePng&&form.signatureDate?'customer_confirmed':'not_confirmed'};
}
