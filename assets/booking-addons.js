(()=>{
  const booking=()=>document.querySelector('#booking');
  const currentCategoryKey=()=>booking()?.querySelector('[data-booking-category].on')?.dataset.bookingCategory||'';
  let lastBookingView='';

  function currentConfig(){
    const key=currentCategoryKey();
    const catalog=Array.isArray(window.__77_SERVICE_CATALOG__)?window.__77_SERVICE_CATALOG__:[];
    const category=catalog.find(entry=>entry.key===key);
    if(!category)return {key,label:'服務',items:[]};
    const items=(category.groups||[])
      .filter(group=>group.kind==='addon')
      .flatMap(group=>group.items||[])
      .filter(item=>item.enabled!==false)
      .map(item=>({name:item.name,price:item.priceLabel||'',id:item.id}));
    return {key,label:category.name,items};
  }

  function currentBookingView(){
    const root=booking();
    if(!root)return '';
    const activeStep=root.querySelector('.step.on[data-step]');
    if(activeStep)return `step-${activeStep.dataset.step}`;
    if(root.querySelector('.success.on'))return 'success';
    return '';
  }

  function syncStepScroll(){
    const view=currentBookingView();
    if(!view)return;
    if(lastBookingView&&view!==lastBookingView)requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
    lastBookingView=view;
  }

  function stripStepOneAddons(){
    booking()?.querySelectorAll('[data-step="1"] .booking-item-group').forEach(group=>{
      const title=group.querySelector('h3')?.textContent?.trim()||'';
      if(/加購/.test(title)||group.dataset.bookingKind==='addon')group.remove();
    });
  }

  function ensureAddonPanel(){
    const root=booking();
    const step=root?.querySelector('[data-step="3"]');
    if(!step)return;
    const config=currentConfig();
    let panel=step.querySelector('[data-booking-addons]');
    if(!panel){
      panel=document.createElement('section');
      panel.className='booking-addon-panel';
      panel.dataset.bookingAddons='1';
      const note=step.querySelector('label.full');
      if(note)step.insertBefore(panel,note);else step.querySelector('.actions')?.before(panel);
    }
    const signature=`${config.key}|${config.items.map(item=>`${item.id}:${item.price}`).join(',')}`;
    if(panel.dataset.signature===signature)return;
    const previouslySelected=new Set([...panel.querySelectorAll('[data-booking-addon-option]:checked')].map(input=>input.value));
    panel.dataset.signature=signature;
    panel.dataset.category=config.key;
    if(!config.items.length){
      panel.innerHTML=`<div class="booking-addon-head"><h3>加購項目</h3><p>${config.label}目前沒有加購項目。</p></div>`;
      return;
    }
    panel.innerHTML=`<div class="booking-addon-head"><h3>加購項目</h3><p>按照你揀嘅服務，77waxing 推薦仲可以加購以下項目㗎～</p></div><div class="booking-addon-options">${config.items.map(item=>`<label class="booking-addon-option"><input type="checkbox" data-booking-addon-option value="${String(item.name).replace(/"/g,'&quot;')}" ${previouslySelected.has(item.name)?'checked':''}><span><b>${item.name}</b><small>${item.price}</small></span></label>`).join('')}</div>`;
  }

  function selectedAddons(){
    const root=booking();
    return [...(root?.querySelectorAll('[data-booking-addon-option]:checked')||[])].map(input=>input.value);
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
    const serviceRow=[...summary.children].find(node=>node.querySelector('small')?.textContent.trim()==='服務項目');
    if(serviceRow)serviceRow.after(row);else summary.prepend(row);
  }

  function syncNoteBeforeSubmit(){
    const root=booking();
    const note=root?.querySelector('[name="note"]');
    if(!note)return;
    const clean=(note.value||'').split('\n').filter(line=>!line.trim().startsWith('[加購項目]')).join('\n').trim();
    const addons=selectedAddons();
    note.value=addons.length?`${clean}${clean?'\n':''}[加購項目] ${addons.join('、')}`:clean;
  }

  function syncAll(){
    stripStepOneAddons();
    ensureAddonPanel();
    if(booking()?.querySelector('[data-step="4"].on'))syncSummary();
    syncStepScroll();
  }

  document.addEventListener('click',event=>{if(event.target.closest('#booking [data-submit]'))syncNoteBeforeSubmit()},true);
  document.addEventListener('click',event=>{
    if(!event.target.closest('#booking [data-next],#booking [data-prev],#booking [data-submit],#booking [data-booking-category]'))return;
    setTimeout(syncAll,0);
  });
  document.addEventListener('change',event=>{if(event.target.matches?.('#booking [data-booking-addon-option]'))setTimeout(syncSummary,0)});
  addEventListener('77waxing:catalog-ready',()=>setTimeout(syncAll,0));
  addEventListener('77waxing:booking-category',()=>setTimeout(syncAll,0));

  const root=booking()||document.querySelector('#app')||document.body;
  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;syncAll()});
  };
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  syncAll();
})();