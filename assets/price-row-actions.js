(()=>{
  const B='/77-waxing-site';
  const FALLBACK_SLUGS={women:'women-waxing',men:'men-waxing',skin:'skin-care',bust:'bust-care'};

  const itemHash=name=>`#item=${encodeURIComponent(name)}`;
  const bookingHref=(category,item)=>{
    const payload=`category=${encodeURIComponent(category)}&item=${encodeURIComponent(item)}`;
    return `${B}/booking/#${payload}`;
  };

  function closeRows(except=null){
    document.querySelectorAll('.price-row.price-row-actionable.open').forEach(row=>{
      if(row===except)return;
      row.classList.remove('open');
      row.setAttribute('aria-expanded','false');
    });
  }

  function enhancePriceRows(){
    document.querySelectorAll('.price-row:not([data-price-actions-ready])').forEach(row=>{
      const section=row.closest('[data-price-section]');
      const group=row.closest('.price-group');
      const groupTitle=group?.querySelector(':scope > h3')?.textContent?.trim()||'';
      const isAddon=group?.dataset.priceKind==='addon'||/加購/.test(groupTitle);
      const category=section?.dataset.priceSection;
      const slug=section?.dataset.serviceSlug||FALLBACK_SLUGS[category];
      const name=row.querySelector(':scope > b')?.textContent?.trim();
      if(!category||!slug||!name)return;

      row.dataset.priceActionsReady='1';
      row.dataset.priceCategory=category;
      row.dataset.priceItem=name;
      row.dataset.priceAddon=isAddon?'1':'0';
      row.classList.add('price-row-actionable');
      row.tabIndex=0;
      row.setAttribute('role','button');
      row.setAttribute('aria-expanded','false');
      row.setAttribute('aria-label',`${name}，點擊查看操作`);

      const actions=document.createElement('div');
      actions.className='price-row-actions';
      const href=bookingHref(category,name);
      actions.innerHTML=isAddon
        ? `<a class="price-row-action more" href="${B}/services/${slug}/${itemHash(name)}">看更多</a><span class="price-row-action addon-reminder">預約時請記得選加購項目</span>`
        : `<a class="price-row-action more" href="${B}/services/${slug}/${itemHash(name)}">看更多</a><button type="button" class="price-row-action booking">進行預約</button>`;
      row.appendChild(actions);
      actions.querySelector('.more')?.addEventListener('click',()=>{delete document.documentElement.dataset.serviceItemFocus});
      actions.querySelector('.booking')?.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        location.assign(href);
      });

      const toggle=()=>{
        const willOpen=!row.classList.contains('open');
        closeRows(row);
        row.classList.toggle('open',willOpen);
        row.setAttribute('aria-expanded',String(willOpen));
      };
      row.addEventListener('click',event=>{if(!event.target.closest('.price-row-actions'))toggle()});
      row.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        if(event.target.closest('.price-row-actions'))return;
        event.preventDefault();toggle();
      });
    });
  }

  function focusServiceItem(){
    if(!location.hash.startsWith('#item='))return;
    let wanted='';
    try{wanted=decodeURIComponent(location.hash.slice(6))}catch{return}
    if(!wanted)return;
    const servicePage=document.querySelector('[data-catalog-page="service"]');
    if(!servicePage)return;
    const cards=[...servicePage.querySelectorAll('.service-item-card')];
    const target=cards.find(card=>card.querySelector('h3')?.textContent.trim()===wanted);
    if(!target)return;
    const focusKey=`${location.pathname}|${wanted}`;
    if(document.documentElement.dataset.serviceItemFocus===focusKey)return;
    document.documentElement.dataset.serviceItemFocus=focusKey;
    cards.forEach(card=>card.classList.remove('service-item-target'));
    target.classList.add('service-item-target');
    requestAnimationFrame(()=>requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'center'})));
  }

  function apply(){enhancePriceRows();focusServiceItem()}
  document.addEventListener('click',event=>{if(!event.target.closest('.price-row'))closeRows()});
  addEventListener('hashchange',()=>{delete document.documentElement.dataset.serviceItemFocus;setTimeout(apply,0)});
  addEventListener('popstate',()=>{delete document.documentElement.dataset.serviceItemFocus;setTimeout(apply,0)});
  const root=document.querySelector('#app')||document.body;
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(root,{childList:true,subtree:true});
  apply();
})();