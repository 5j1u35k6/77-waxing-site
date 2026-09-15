(()=>{
  const genderText=value=>({female:'女性',male:'男性',private:'其他／不透露'}[value]||'未填寫');
  const root=()=>document.querySelector('#booking');

  const decorateContactLayout=booking=>{
    const step=booking?.querySelector('[data-step="3"]');
    const fields=step?.querySelector('.fields');
    if(!step||!fields)return;

    const heading=step.querySelector('h2');
    if(heading&&heading.textContent.trim()!=='聯絡資料')heading.textContent='聯絡資料';
    fields.classList.add('booking-contact-fields');

    const tag=(name,className)=>{
      const control=fields.querySelector(`[name="${name}"]`);
      const label=control?.closest('label');
      if(!label)return;
      label.classList.add('booking-contact-field',className);
    };
    tag('name','booking-field-name');
    tag('phone','booking-field-phone');
    tag('gender','booking-field-gender');
    tag('email','booking-field-email');
    tag('first','booking-field-first');
    tag('line','booking-field-line');
  };

  const mount=()=>{
    const booking=root();
    if(!booking)return;
    const nameInput=booking.querySelector('[name="name"]');
    if(nameInput&&!booking.querySelector('[name="gender"]')){
      const nameLabel=nameInput.closest('label');
      if(nameLabel){
        const label=document.createElement('label');
        label.dataset.genderField='1';
        label.className='booking-contact-field booking-field-gender';
        label.innerHTML='性別<select name="gender"><option value="">請選擇</option><option value="female">女性</option><option value="male">男性</option><option value="private">其他／不透露</option></select>';
        nameLabel.insertAdjacentElement('afterend',label);
      }
    }
    decorateContactLayout(booking);
  };

  const addSummary=()=>{
    const booking=root();
    const summary=booking?.querySelector('.summary');
    const select=booking?.querySelector('[name="gender"]');
    if(!summary||!select)return;
    let row=summary.querySelector('[data-gender-summary]');
    if(!row){
      row=document.createElement('div');
      row.dataset.genderSummary='1';
      summary.appendChild(row);
    }
    row.innerHTML=`<small>性別</small><b>${genderText(select.value)}</b>`;
  };

  const syncGenderIntoNote=()=>{
    const booking=root();
    const select=booking?.querySelector('[name="gender"]');
    const note=booking?.querySelector('[name="note"]');
    if(!select||!note)return;
    const clean=String(note.value||'').replace(/^\[性別\]\s*[^\n]*\n?/,'').trimStart();
    note.value=select.value?`[性別] ${genderText(select.value)}${clean?`\n${clean}`:''}`:clean;
  };

  document.addEventListener('click',event=>{
    const booking=root();
    if(!booking)return;
    const button=event.target.closest?.('[data-next],[data-submit]');
    if(!button||!booking.contains(button))return;
    if(button.matches('[data-next]')&&button.closest('[data-step="3"]'))setTimeout(addSummary,0);
    if(button.matches('[data-submit]'))syncGenderIntoNote();
  },true);

  const app=document.querySelector('#app');
  if(app)new MutationObserver(()=>queueMicrotask(mount)).observe(app,{childList:true,subtree:true});
  setTimeout(mount,0);
})();