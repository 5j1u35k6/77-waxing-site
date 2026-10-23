// Shared paper-form schema. Never infer consent, a signature, or unchecked boxes.
export const recordOptions = {
  hairRemovalMethods:['無習慣','刮刀','脫毛膏','拔毛夾','熱蠟','雷射'],
  exfoliationMethods:['無習慣','酸類','凝膠類','柔珠顆粒','天然類'],
  skinConditions:['蠟黃','細緻','粗糙','乾燥','鬆弛','老化','橘皮嚴重','角質肥厚','皮膚薄','其他'],
  skinDiseases:['過敏','濕疹','蕁麻疹','魚鱗癬','乾癬','毛囊角化症','毛囊炎','脂漏性皮膚炎','異位性皮膚炎','其他']
};
export const recordTerms = [
  '除毛前後十天請避免去角質及使用A酸、果酸類的刺激性相關產品，保持乾淨、清爽即可。',
  '如果皮膚有發炎、曬傷、紅腫過敏或傷口等，禁止除毛課程。',
  '除毛後24小時內禁止擦拭含有酒精或美白成分的刺激性保養品及香水，並避免高溫或過度刺激及摩擦除毛部位。',
  '除毛後3-5小時請勿碰水，當日洗澡以溫水為佳。',
  '除毛後5-7天內請勿游泳、泡湯、泡澡、按摩與三溫暖等高溫環境活動。',
  '除毛後7-10天後，可進行去角質，並定期一個禮拜1-2次，以利細毛生長，避免內生毛現象產生。',
  '私密處除毛後3天皮膚較脆弱，請避免穿著過於緊身的褲子、沐浴時過度清洗、搓揉或經常性的碰觸除毛部位。',
  '除毛後當天請盡量裸睡，及避免性行為。',
  '除毛後皮膚可能會出現些微紅點，仍屬正常現象，紅點消退會因個人體質有所不同，如有不適請聯絡您的除毛師。',
  '每天沐浴後可擦拭除毛專用的舒緩產品改善，可讓紅點消退更快。',
  '除毛過程中若有任何不適，請立即反應。'
];
export function recordDate(value) {
  const match=String(value||'').match(/(\d{1,4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/);
  if(!match)return '';
  const year=Number(match[1])+(/民國/.test(value)||match[1].length<4?1911:0),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  return year>=1900 && date<=new Date() && date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
}
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const labels=['顧客姓名','客戶姓名','姓名','手機號碼','行動電話','手機','電話','生日','出生日期','出生年月日','電子信箱','信箱','email','e-mail','服務項目','預約服務','服務','諮詢日期','客戶編號','身高','體重','LINE ID','LINE','職業','地址','目前想除毛部位','是否初次除毛','已除毛過次數','最近除毛日期','最近除毛部位','上次除毛部位','部位','平常除毛方式','去角質方式','肌膚狀況','肌膚狀況其他','皮膚疾病','皮膚疾病其他','敏感肌膚','過敏及敏感來源','是否曾有過陰部發癢症狀','原因','目前有無皮膚過敏或發炎問題','問題部位','症狀','備註','本人簽名','同意條款','簽署日期'];
export function recordFields(text) {
  const source=String(text||'').replace(/\r/g,'').replace(new RegExp('(?:^|[\\s|｜;；,，])('+labels.map(escaped).join('|')+')\\s*(?:[（(]複選[）)])?\\s*[:：]','gi'),'\n$1：');
  const find=pattern=>source.match(pattern)?.[1]?.trim()||'';
  const labelled=(names)=>find(new RegExp('(?:^|\\n)\\s*(?:'+names.map(escaped).join('|')+')\\s*[:：]\\s*([^\\n]*)','i'));
  const choiceRow=label=>labelled([label])||find(new RegExp('(?:^|\\n)\\s*'+escaped(label)+'(?:\\s*[（(]複選[）)])?\\s+([^\\n]+)'));
  const result={
    name:labelled(['顧客姓名','客戶姓名','姓名']).slice(0,80),
    phone:(labelled(['手機號碼','行動電話','手機','電話']).match(/^(\+?\d[\d ()-]{5,25}\d)$/)?.[1]||'').replace(/[ ()-]/g,''),
    birthday:recordDate(labelled(['生日','出生日期','出生年月日'])),
    email:find(/(?:電子信箱|信箱|e-?mail)\s*[:：]?\s*([^\s<>]+@[^\s<>]+\.[^\s<>]+)/i),
    service:labelled(['服務項目','預約服務','服務']).slice(0,120),note:labelled(['備註']).slice(0,1000)
  };
  const scalar={consultationDate:['諮詢日期'],customerNumber:['客戶編號'],height:['身高'],weight:['體重'],line:['LINE ID','LINE'],occupation:['職業'],address:['地址'],desiredArea:['目前想除毛部位'],waxingCount:['已除毛過次數'],lastWaxingDate:['最近除毛日期'],lastWaxingArea:['最近除毛部位','上次除毛部位'],skinOther:['肌膚狀況其他'],diseaseOther:['皮膚疾病其他'],sensitivitySource:['過敏及敏感來源'],inflammationReason:['原因'],issueArea:['問題部位'],issueSymptoms:['症狀']};
  for(const [key,names] of Object.entries(scalar)){
    let value=labelled(names);
    if(/Date$/.test(key))value=recordDate(value);
    else if(['height','weight','waxingCount'].includes(key)){
      const number=value.match(/^\s*(\d+(?:\.\d+)?)\s*(?:cm|kg|公分|公斤|次)?\s*$/i);
      value=number?number[1]:'';
      const max=key==='height'?300:key==='weight'?500:1000;
      if(Number(value)>max || (key==='waxingCount' && !Number.isInteger(Number(value))))value='';
    }
    if(value && !/^[_＿\s]+$/.test(value))result[key]=value.slice(0,200);
  }
  // The paper repeats "部位". Only use it when its preceding section is explicit.
  if(!result.lastWaxingArea){const area=find(/最近除毛日期[:：][^\n]*\n\s*部位[:：]\s*([^\n]+)/);if(area)result.lastWaxingArea=area.slice(0,200);}
  if(!result.issueArea){const area=find(/目前有無皮膚過敏或發炎問題[:：][^\n]*\n\s*部位[:：]\s*([^\n]+)/);if(area)result.issueArea=area.slice(0,200);}
  const groups={hairRemovalMethods:'平常除毛方式',exfoliationMethods:'去角質方式',skinConditions:'肌膚狀況',skinDiseases:'皮膚疾病'};
  for(const [key,label] of Object.entries(groups)){
    const row=choiceRow(label);
    const marked=recordOptions[key].filter(option=>new RegExp('(?:☑|✓|✔|■|\\[[xX✓]\\])\\s*'+escaped(option)+'(?=$|[\\s、,，/;；□☑✓✔■])').test(row));
    if(marked.length)result[key]=marked;
  }
  const binary={firstWaxing:'是否初次除毛',intimateInflammation:'是否曾有過陰部發癢症狀',currentSkinIssue:'目前有無皮膚過敏或發炎問題'};
  for(const [key,label] of Object.entries(binary)){
    const row=choiceRow(label);
    if(/^(是|否)$/.test(row))result[key]=row;
    else {
      const checked=Array.from(row.matchAll(/(?:☑|✓|✔|■|\[[xX✓]\])\s*(是|否)(?=$|[\s、,，□☑✓✔■])/g));
      if(checked.length===1)result[key]=checked[0][1];
    }
  }
  if(/^(是|有|☑|✓|✔|■|\[[xX]\])$/.test(labelled(['敏感肌膚'])))result.sensitiveSkin=true;
  if(/(?:☑|✓|✔|■|\[[xX]\])\s*本人為敏感、脆弱、易過敏膚質/.test(source))result.sensitiveSkin=true;
  // consent, signatureName, signatureDate and handwriting are intentionally absent.
  return result;
}
