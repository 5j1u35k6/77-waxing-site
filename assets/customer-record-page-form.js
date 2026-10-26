import { recordOptions, recordTerms } from './customer-record-fields.js?v=20261026-audit1';
import { mountBirthdayCalendar } from './customer-record-calendar.js?v=20261026-audit1';
import { cleanRecord, scalarRecordFields } from './customer-record-data.js?v=20261026-audit1';

const input=(label,name,type='text',extra='')=>`<label class="record-field">${label}<input name="${name}" type="${type}" ${type==='text'&&!extra.includes('maxlength')?'maxlength="200"':''} ${extra}>${type==='date'?`<small class="paper-hint" data-roc-for="${name}"></small>`:''}</label>`;
const conditional=(condition,content,css='')=>`<div class="paper-conditional ${css}" data-conditional="${condition}" hidden>${content}</div>`;
const checks=(title,name)=>`<fieldset class="paper-choices"><legend>${title}</legend><div>${recordOptions[name].map(value=>`<label class="${value==='天然類'?'paper-natural':''}"><input type="checkbox" name="${name}" value="${value}"><span>${value}${value==='天然類'?'（例：鹽巴）':''}</span></label>`).join('')}</div></fieldset>`;
const binary=(title,name)=>`<fieldset class="paper-binary"><legend>${title}</legend><div>${['否','是'].map(value=>`<label><input type="radio" name="${name}" value="${value}">${value}</label>`).join('')}<button type="button" class="paper-clear-choice" data-clear-choice="${name}" aria-label="清除${title}">清除</button></div></fieldset>`;

export function mountRecordForm(host,{onDirty=()=>{},onSave=()=>{}}={}){
  host.innerHTML=`<header class="record-page-head"><div><p class="paper-eyebrow">77WAXING · CUSTOMER RECORD</p><h1>熱蠟除毛 <span>顧客資料表</span></h1></div><a href="./#customers" data-record-back>返回顧客資料</a></header>
    <p class="paper-draft-notice" data-record-notice>請核對資料後按「正式儲存顧客紀錄」。未儲存內容不會自動留存。</p>
    <form class="record-paper" data-record-fields autocomplete="off"><fieldset class="paper-main-fields" data-editable>
      <div class="paper-intro"><p>請在第一次諮詢時確實填寫此表，<br>您提供的資訊將有助於我們滿足您的需求，<br>並確保您有個愉快且滿意的除毛體驗。</p><div>${input('諮詢日期','consultationDate','date')}${input('客戶編號','customerNumber')}</div></div>
      <section class="paper-section"><h2>基本資料</h2><div class="paper-grid paper-basic-grid">
        <div class="paper-basic-wide">${input('姓名','name','text','required maxlength="80"')}</div>
        <div class="paper-basic-wide birthday-control" data-birthday-control><label class="record-field"><span>生日</span><input name="birthday" type="hidden"><button class="paper-date-trigger" type="button" data-birthday-trigger aria-expanded="false" aria-controls="birthday-calendar">選擇生日　▦</button></label>
          <div id="birthday-calendar" class="flight-calendar" data-birthday-calendar role="group" aria-label="生日日期選擇器" hidden><div class="calbar"><button type="button" data-calendar-prev aria-label="上一個月">←</button><b data-calendar-label></b><button type="button" data-calendar-next aria-label="下一個月">→</button></div><div class="paper-calendar-selects"><label>年份<select data-calendar-year aria-label="生日年份"></select></label><label>月份<select data-calendar-month aria-label="生日月份"></select></label></div><div class="calweek">${'日一二三四五六'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="calgrid"></div><button type="button" class="paper-clear-choice" data-calendar-clear>清除日期</button></div>
        </div>${input('身高（cm）','height','number','min="0" max="300" step="0.1"')}${input('體重（kg）','weight','number','min="0" max="500" step="0.1"')}
        <div class="paper-basic-wide">${input('手機','phone','tel','required maxlength="30"')}</div><div class="paper-basic-wide">${input('LINE','line')}</div><div class="paper-basic-wide">${input('職業','occupation')}</div><div class="paper-full">${input('地址','address')}</div>
      </div><p class="paper-hint">LINE 欄位記錄紙本資料，不會變更會員的 LINE 綁定。</p></section>
      <section class="paper-section"><h2>肌膚狀況</h2>${input('目前想除毛部位','desiredArea')}
        <div class="paper-history">${binary('是否初次除毛','firstWaxing')}${conditional('firstWaxing',input('已除毛過次數','waxingCount','number','min="0" max="1000" step="1"')+input('最近除毛日期','lastWaxingDate','date')+input('部位','lastWaxingArea'),'paper-history-more')}</div>
        ${checks('平常除毛方式','hairRemovalMethods')}${checks('去角質方式','exfoliationMethods')}
        ${checks('肌膚狀況（複選）','skinConditions')}${conditional('skinOther',input('其他說明','skinOther','text','aria-label="肌膚狀況的其他說明"'))}
        ${checks('皮膚疾病（複選）','skinDiseases')}${conditional('diseaseOther',input('其他說明','diseaseOther','text','aria-label="皮膚疾病的其他說明"'))}
        <label class="paper-sensitive"><input type="checkbox" name="sensitiveSkin">本人為敏感、脆弱、易過敏膚質, 過敏及敏感來源</label>${conditional('sensitivitySource',input('來源說明','sensitivitySource'))}
        <div class="paper-conditional-row">${binary('是否曾有過陰部發癢症狀','intimateInflammation')}${conditional('inflammationReason',input('原因','inflammationReason'))}</div>
        <div class="paper-conditional-row">${binary('目前有無皮膚過敏或發炎問題','currentSkinIssue')}${conditional('currentSkinIssue',`<div class="paper-two">${input('部位','issueArea')}${input('症狀','issueSymptoms')}</div>`)}</div>
      </section>
      <section class="paper-terms"><h2>熱蠟除毛服務聲明及避免事項</h2><ol>${recordTerms.map(term=>`<li>${term}</li>`).join('')}</ol></section>
      <section class="paper-consent"><p>本人在此聲明此份公開表格完全為我本人並以我最佳的健康狀態和認知狀況所填寫且同意接受熱蠟除毛服務。</p><label class="paper-agreement"><input type="checkbox" name="consent">本人同意以上所列條款</label><p class="paper-hint">同意、本人簽名及日期須由本人確認，掃描不會自動填入。未完成這三項時，儲存後會註明「未完成本人確認」。</p><div class="paper-two"><div class="record-field"><span>本人簽名</span><button type="button" class="paper-signature-field" data-signature-open aria-label="本人簽名，點選開啟簽名板"><span data-signature-placeholder>點選開啟簽名板</span><img data-signature-preview alt="本人手寫簽名" hidden></button><button type="button" class="paper-clear-choice" data-signature-remove hidden>清除簽名</button></div>${input('日期','signatureDate','date')}</div></section>
      <details class="paper-supplement"><summary>補充資料</summary><div class="paper-two">${input('信箱','email','email','maxlength="160"')}${input('服務項目','service')}</div><label class="record-field">備註<textarea name="note" maxlength="1000" rows="3"></textarea></label></details>
      </fieldset><details><summary>檢視辨識原文</summary><pre data-record-text>尚未掃描檔案。</pre></details>
      <p class="paper-hint">掃描的手寫文字與勾選狀態可能不完整，請對照原始檔逐項核對。</p>
      <p class="paper-save-message" role="status" aria-live="polite" data-save-message></p><footer class="paper-actions"><a href="./customer-record.html" data-new-record hidden>新增另一份紀錄</a><button type="submit" class="record-button" data-record-save>正式儲存顧客紀錄</button></footer>
    </form>`;
  const form=host.querySelector('form'),touched=new Set();let signaturePng='',readOnly=false;
  const field=name=>form.elements.namedItem(name);
  const dirty=name=>{if(name)touched.add(name);onDirty();};
  const birthday=mountBirthdayCalendar(host.querySelector('[data-birthday-control]'),()=>dirty('birthday'));
  const refresh=()=>{
    const visible={firstWaxing:field('firstWaxing').value==='是',skinOther:Array.from(form.querySelectorAll('[name="skinConditions"]:checked')).some(e=>e.value==='其他'),diseaseOther:Array.from(form.querySelectorAll('[name="skinDiseases"]:checked')).some(e=>e.value==='其他'),sensitivitySource:field('sensitiveSkin').checked,inflammationReason:field('intimateInflammation').value==='是',currentSkinIssue:field('currentSkinIssue').value==='是'};
    for(const box of host.querySelectorAll('[data-conditional]')){box.hidden=!visible[box.dataset.conditional];for(const el of box.querySelectorAll('input'))el.disabled=readOnly||box.hidden;}
    for(const hint of form.querySelectorAll('[data-roc-for]')){const value=field(hint.dataset.rocFor).value,parts=value.split('-');hint.textContent=value?`民國 ${Number(parts[0])-1911} 年 ${Number(parts[1])} 月 ${Number(parts[2])} 日`:'';}
    birthday.sync();
  };
  for(const event of ['input','change'])form.addEventListener(event,e=>{if(e.target.name){dirty(e.target.name);refresh();}});
  for(const button of form.querySelectorAll('[data-clear-choice]'))button.onclick=()=>{const name=button.dataset.clearChoice;for(const el of form.querySelectorAll(`input[name="${name}"]`))el.checked=false;dirty(name);refresh();};
  const signatureDialog=document.createElement('dialog');signatureDialog.className='paper-signature-dialog';signatureDialog.setAttribute('aria-labelledby','signature-title');
  signatureDialog.innerHTML='<h2 id="signature-title">本人簽名</h2><p>請在下方放大簽名板簽名，完成後會顯示於顧客資料表。</p><canvas width="1000" height="300" aria-label="放大手寫簽名區"></canvas><p role="status" data-signature-message></p><div class="signature-actions"><button type="button" data-signature-clear>清除</button><button type="button" data-signature-cancel>取消</button><button type="button" class="record-button" data-signature-done>完成</button></div>';
  document.body.appendChild(signatureDialog);
  const canvas=signatureDialog.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.lineWidth=3;ctx.strokeStyle='#42352c';ctx.fillStyle='#42352c';ctx.lineCap='round';ctx.lineJoin='round';let drawing=false,hasInk=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
  const clearPad=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;};
  const renderSignature=()=>{const image=host.querySelector('[data-signature-preview]');image.hidden=!signaturePng;if(signaturePng)image.src=signaturePng;else image.removeAttribute('src');host.querySelector('[data-signature-placeholder]').hidden=!!signaturePng;host.querySelector('[data-signature-remove]').hidden=!signaturePng||readOnly;};
  canvas.onpointerdown=e=>{e.preventDefault();drawing=true;hasInk=true;canvas.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.arc(x,y,1.5,0,2*Math.PI);ctx.fill();ctx.beginPath();ctx.moveTo(x,y);};
  canvas.onpointermove=e=>{if(drawing){ctx.lineTo(...point(e));ctx.stroke();}};canvas.onpointerup=canvas.onpointercancel=()=>{drawing=false;};
  host.querySelector('[data-signature-open]').onclick=()=>{if(readOnly)return;clearPad();signatureDialog.querySelector('[data-signature-message]').textContent='';signatureDialog.showModal();if(signaturePng){const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,canvas.width,canvas.height);hasInk=true;};image.src=signaturePng;}};
  signatureDialog.querySelector('[data-signature-clear]').onclick=clearPad;signatureDialog.querySelector('[data-signature-cancel]').onclick=()=>signatureDialog.close();
  signatureDialog.querySelector('[data-signature-done]').onclick=()=>{if(!hasInk){signatureDialog.querySelector('[data-signature-message]').textContent='請先簽名，或點取消。';return;}const value=canvas.toDataURL('image/png');if(value.length>240000){signatureDialog.querySelector('[data-signature-message]').textContent='簽名內容過大，請清除後重新簽名。';return;}signaturePng=value;dirty('signaturePng');renderSignature();signatureDialog.close();};
  host.querySelector('[data-signature-remove]').onclick=()=>{signaturePng='';dirty('signaturePng');renderSignature();};
  form.onsubmit=e=>{e.preventDefault();if(!readOnly&&form.reportValidity())onSave();};
  refresh();
  return {element:host,form,refresh,get signature(){return signaturePng;},data(){const values={};for(const name of scalarRecordFields)values[name]=field(name)?.value||'';for(const name of Object.keys(recordOptions))values[name]=Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(e=>e.value);values.sensitiveSkin=field('sensitiveSkin').checked;values.consent=field('consent').checked;return cleanRecord(values);},
    apply(values,text=''){
      if(readOnly)return;
      host.querySelector('[data-record-text]').textContent=text||'未辨識到文字。';
      for(const [name,value] of Object.entries(values)){
        if(!value||touched.has(name)||['consent','signatureName','signatureDate','signaturePng'].includes(name))continue;
        const elements=Array.from(form.elements).filter(e=>e.name===name);if(!elements.length)continue;
        if(['checkbox','radio'].includes(elements[0].type)){if(elements.some(e=>e.checked))continue;for(const el of elements)el.checked=Array.isArray(value)?value.includes(el.value):typeof value==='boolean'?value:el.value===value;}
        else if(!elements[0].value)elements[0].value=value;
      }
      if(values.email||values.service||values.note)host.querySelector('.paper-supplement').open=true;refresh();onDirty();
    },
    load(record){for(const name of scalarRecordFields)if(field(name))field(name).value=record.form?.[name]||'';for(const name of Object.keys(recordOptions))for(const el of form.querySelectorAll(`[name="${name}"]`))el.checked=(record.form?.[name]||[]).includes(el.value);field('sensitiveSkin').checked=record.form?.sensitiveSkin===true;field('consent').checked=record.form?.consent===true;signaturePng=/^data:image\/png;base64,/.test(record.signaturePng||'')?record.signaturePng:'';if(Array.isArray(record.terms)){const list=host.querySelector('.paper-terms ol');list.replaceChildren();for(const term of record.terms){const item=document.createElement('li');item.textContent=String(term);list.appendChild(item);}}if(typeof record.consentStatement==='string')host.querySelector('.paper-consent>p').textContent=record.consentStatement;readOnly=true;host.querySelector('[data-editable]').disabled=true;host.querySelector('[data-record-save]').hidden=true;host.querySelector('[data-new-record]').hidden=false;host.querySelector('[data-record-notice]').textContent=`已正式儲存 · ${record.confirmationStatus==='customer_confirmed'?'本人確認欄位齊全':'未完成本人確認'} · 紀錄編號 ${record.id}。此歷史紀錄為唯讀，不會覆寫。`;renderSignature();refresh();},
    setBusy(value){host.querySelector('[data-record-save]').disabled=value;host.querySelector('[data-record-save]').textContent=value?'儲存中…':'正式儲存顧客紀錄';host.querySelector('[data-editable]').disabled=value||readOnly;refresh();}
  };
}
