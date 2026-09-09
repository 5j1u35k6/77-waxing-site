(()=>{
  const ADDONS={
    women:{label:'女性熱蠟',items:[['小鬍子 / 小腹線 / 腋下','$199'],['腋下美白軟膜','$199'],['私密處美白軟膜','$199']]},
    men:{label:'男士熱蠟',items:[['小鬍子 / 小腹線 / 腋下','$350'],['腋下美白軟膜','$299'],['私密處美白軟膜','$299']]},
    skin:{label:'肌膚管理',items:[['頸部緊緻保養','$699'],['臉部拋光','$499'],['頭刮肩頸加強','$399'],['耳穴放鬆','$599'],['臉部熱蠟','視範圍']]},
    bust:{label:'美胸保養',items:[]}
  };

  const booking=()=>document.querySelector('#booking');
  const currentCategoryKey=()=>booking()?.querySelector('[data-booking-category].on')?.dataset.bookingCategory||'women';

  function stripStepOneAddons(){
    booking()?.querySelectorAll('[data-step="1"] .booking-item-group').forEach((group)=>{
      const title=group.querySelector('h3')?.textContent?.trim()||'';
      if(/加購/.test(title))group.remove();
    });
  }

  function ensureAddonPanel(){
    const root=booking();
    const step=root?.querySelector('[data-step="3"]');
    if(!step)return;
    const key=currentCategoryKey();
    const config=ADDONS[key]||ADDONS.women;
    let panel=step.querySelector('[data-booking-addons]');
    if(!panel){
      panel=document.createElement('section');
      panel.className='booking-addon-panel';
      panel.dataset.bookingAddons='1';
      const note=step.querySelector('label.full');
      if(note)step.insertBefore(panel,note);
      else step.querySelector('.actions')?.before(panel);
    }
    if(panel.dataset.category===key)return;
    panel.dataset.category=key;
    if(!config.items.length){
      panel.innerHTML=`<div class="booking-addon-head"><h3>加購項目</h3><p>${config.label}目前沒有加購項目。</p></div>`;
      return;
    }
    panel.innerHTML=`<div class="booking-addon-head"><h3>加購項目</h3><p>依照你選擇的${config.label}顯示，可複選。</p></div><div class="booking-addon-options">${config.items.map(([name,price])=>`<label class="booking-addon-option"><input type="checkbox" data-booking-addon-option value="${name}"><span><b>${name}</b><small>${price}</small></span></label>`).join('')}</div>`;
  }

  function selectedAddons(){
    const root=booking();
    return [...(root?.querySelectorAll('[data-booking-addon-option]:checked')||[])].map((input)=>input.value);
  }

  function syncSummary(){
    const root=booking();
    const summary=root?.querySelector('.summary');
    if(!summary)return;
    summary.querySelector('[data-addon-summary]')?.remove();
    const addons=selectedAddons();
    if(!addons.length)return;
    const row=document.createElement('div');
    row.dataset.addonSummary='1';
    row.innerHTML=`<small>加購項目</small><b>${addons.join('、')}</b>`;
    const serviceRow=[...summary.children].find((node)=>node.querySelector('small')?.textContent.trim()==='服務項目');
    if(serviceRow)serviceRow.after(row);else summary.prepend(row);
  }

  function syncNoteBeforeSubmit(){
    const root=booking();
    const note=root?.querySelector('[name="note"]');
    if(!note)return;
    const clean=(note.value||'').split('\n').filter((line)=>!line.trim().startsWith('[加購項目]')).join('\n').trim();
    const addons=selectedAddons();
    note.value=addons.length?`${clean}${clean?'\n':''}[加購項目] ${addons.join('、')}`:clean;
  }

  function syncAll(){
    stripStepOneAddons();
    ensureAddonPanel();
    if(booking()?.querySelector('[data-step="4"].on'))syncSummary();
  }

  document.addEventListener('click',(event)=>{
    if(event.target.closest('#booking [data-submit]'))syncNoteBeforeSubmit();
  },true);

  document.addEventListener('click',(event)=>{
    if(!event.target.closest('#booking [data-next],#booking [data-prev],#booking [data-booking-category]'))return;
    setTimeout(syncAll,0);
  });

  document.addEventListener('change',(event)=>{
    if(event.target.matches?.('#booking [data-booking-addon-option]'))setTimeout(syncSummary,0);
  });

  const root=booking()||document.querySelector('#app')||document.body;
  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      syncAll();
    });
  };
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  syncAll();
})();