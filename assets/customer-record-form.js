import { recordOptions, recordTerms } from './customer-record-fields.js?v=20261023-paper';

const input=(label,name,type='text',extra='')=>`<label class="record-field">${label}<input name="${name}" type="${type}" ${type==='text'?'maxlength="200"':''} ${extra}>${type==='date'?`<small class="paper-hint" data-roc-for="${name}"></small>`:''}</label>`;
const checks=(title,name)=>`<fieldset class="paper-choices"><legend>${title}</legend><div>${recordOptions[name].map(value=>`<label><input type="checkbox" name="${name}" value="${value}">${value}${value==='天然類'?'（例：鹽巴）':''}</label>`).join('')}</div></fieldset>`;
const binary=(title,name)=>`<fieldset class="paper-binary"><legend>${title}</legend>${['否','是'].map(value=>`<label><input type="radio" name="${name}" value="${value}">${value}</label>`).join('')}<button type="button" class="paper-clear-choice" data-clear-choice="${name}" aria-label="清除${title}">清除</button></fieldset>`;

export function createRecordForm() {
  const editor=document.createElement('dialog');editor.className='record-modal record-paper-modal';editor.setAttribute('aria-labelledby','record-paper-title');
  editor.innerHTML=`<header class="record-head"><h2 id="record-paper-title">熱蠟除毛 <span>顧客資料表</span></h2><button type="button" data-paper-close aria-label="關閉顧客資料表">×</button></header>
    <p class="paper-draft-notice" role="status">本次視窗草稿，尚未儲存為正式顧客紀錄。關閉「新增紀錄」視窗後將清除；請先核對資料。</p>
    <form class="record-paper" data-record-fields autocomplete="off">
      <div class="paper-intro"><p>請在第一次諮詢時確實填寫此表，<br>您提供的資訊將有助於我們滿足您的需求，<br>並確保您有個愉快且滿意的除毛體驗。</p><div>${input('諮詢日期','consultationDate','date')}${input('客戶編號','customerNumber')}</div></div>
      <section class="paper-section"><h3>基本資料</h3><div class="paper-grid">
        ${input('姓名','name')}${input('生日','birthday','date')}<fieldset class="paper-measures"><legend>身高／體重</legend>${input('身高（cm）','height','number','min="0" max="300" step="0.1"')}${input('體重（kg）','weight','number','min="0" max="500" step="0.1"')}</fieldset>
        ${input('手機','phone','tel','maxlength="30"')}${input('LINE','line')}${input('職業','occupation')}<div class="paper-full">${input('地址','address')}</div>
      </div><p class="paper-hint">LINE 欄位記錄紙本資料，不會變更會員的 LINE 綁定。</p></section>
      <section class="paper-section"><h3>肌膚狀況</h3>${input('目前想除毛部位','desiredArea')}
        <div class="paper-history">${binary('是否初次除毛','firstWaxing')}${input('已除毛過次數','waxingCount','number','min="0" max="1000" step="1"')}${input('最近除毛日期','lastWaxingDate','date')}${input('部位','lastWaxingArea')}</div>
        ${checks('平常除毛方式','hairRemovalMethods')}${checks('去角質方式','exfoliationMethods')}${checks('肌膚狀況（複選）','skinConditions')}${input('肌膚狀況其他','skinOther')}
        ${checks('皮膚疾病（複選）','skinDiseases')}${input('皮膚疾病其他','diseaseOther')}
        <label class="paper-sensitive"><input type="checkbox" name="sensitiveSkin">本人為敏感、脆弱、易過敏膚質</label>${input('過敏及敏感來源','sensitivitySource')}
        ${binary('是否曾有過陰部發癢症狀','intimateInflammation')}${input('原因','inflammationReason')}
        ${binary('目前有無皮膚過敏或發炎問題','currentSkinIssue')}<div class="paper-two">${input('問題部位','issueArea')}${input('症狀','issueSymptoms')}</div>
      </section>
      <section class="paper-terms"><h3>熱蠟除毛服務聲明及避免事項</h3><ol>${recordTerms.map(term=>`<li>${term}</li>`).join('')}</ol></section>
      <section class="paper-consent"><p>本人在此聲明此份公開表格完全為我本人並以我最佳的健康狀態和認知狀況所填寫且同意接受熱蠟除毛服務。</p><label class="paper-agreement"><input type="checkbox" name="consent">本人同意以上所列條款</label><p class="paper-hint">以下勾選、簽名與日期須由本人確認，掃描不會自動填入。此處尚未送出或儲存。</p><div class="paper-two">${input('本人簽名（正楷姓名）','signatureName')}${input('日期','signatureDate','date')}</div><label class="record-field">手寫簽名（可選，亦可填寫上方正楷姓名）<canvas width="1000" height="220" data-paper-signature aria-label="手寫簽名區"></canvas></label><button class="record-button" type="button" data-clear-signature>清除手寫簽名</button></section>
      <details class="paper-supplement"><summary>補充資料</summary><div class="paper-two">${input('信箱','email','email','maxlength="160"')}${input('服務項目','service')}</div><label class="record-field">備註<textarea name="note" maxlength="1000" rows="3"></textarea></label></details>
      <details><summary>查看辨識原文</summary><pre data-record-text>尚未掃描檔案。</pre></details>
      <p class="paper-hint">掃描的手寫文字與勾選狀態可能不完整，請對照原始檔逐項核對。沒有辨識到的內容請手動補齊。</p>
      <footer class="paper-actions"><button type="button" class="record-button" data-paper-back>返回上傳選項</button></footer>
    </form>`;
  const form=editor.querySelector('form');const touched=new Set();
  const renderDates=()=>{for(const hint of form.querySelectorAll('[data-roc-for]')){const value=form.elements.namedItem(hint.dataset.rocFor).value;const parts=value.split('-');hint.textContent=value?`民國 ${Number(parts[0])-1911} 年 ${Number(parts[1])} 月 ${Number(parts[2])} 日`:'';}};
  form.addEventListener('input',renderDates);
  for(const event of ['input','change'])form.addEventListener(event,e=>{if(e.target.name)touched.add(e.target.name);});
  form.onsubmit=e=>e.preventDefault();
  for(const button of editor.querySelectorAll('[data-paper-close],[data-paper-back]'))button.onclick=()=>editor.close();
  for(const button of editor.querySelectorAll('[data-clear-choice]'))button.onclick=()=>{const name=button.dataset.clearChoice;touched.add(name);for(const element of form.querySelectorAll(`input[name="${name}"]`))element.checked=false;};
  const canvas=editor.querySelector('canvas'),context=canvas.getContext('2d');
  context.strokeStyle='#42352c';context.lineWidth=3;context.lineCap='round';context.lineJoin='round';let drawing=false;
  const point=e=>{const rect=canvas.getBoundingClientRect();return [(e.clientX-rect.left)*canvas.width/rect.width,(e.clientY-rect.top)*canvas.height/rect.height];};
  canvas.onpointerdown=e=>{e.preventDefault();drawing=true;canvas.setPointerCapture(e.pointerId);context.beginPath();context.moveTo(...point(e));};
  canvas.onpointermove=e=>{if(drawing){context.lineTo(...point(e));context.stroke();}};
  canvas.onpointerup=canvas.onpointercancel=()=>{drawing=false;};
  editor.querySelector('[data-clear-signature]').onclick=()=>context.clearRect(0,0,canvas.width,canvas.height);
  document.body.appendChild(editor);
  return {element:editor,open(){if(!editor.open){editor.showModal();editor.scrollTop=0;}},remove(){editor.close();editor.remove();},apply(values,text){
    editor.querySelector('[data-record-text]').textContent=text||'未辨識到文字。';
    for(const [name,value] of Object.entries(values)){
      if(!value || touched.has(name) || ['consent','signatureName','signatureDate'].includes(name))continue;
      const elements=Array.from(form.elements).filter(e=>e.name===name);if(!elements.length)continue;
      if(elements[0].type==='checkbox' || elements[0].type==='radio'){
        if(elements.some(e=>e.checked))continue;
        for(const input of elements)input.checked=Array.isArray(value)?value.includes(input.value):typeof value==='boolean'?value:input.value===value;
      }else if(!elements[0].value)elements[0].value=value;
    }
    if(values.email||values.service||values.note)editor.querySelector('.paper-supplement').open=true;
    renderDates();
  }};
}
