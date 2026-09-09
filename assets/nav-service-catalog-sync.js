(()=>{
  const B='/77-waxing-site';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const apply=catalog=>{
    if(!Array.isArray(catalog)||!catalog.length)return;
    const services=catalog.filter(service=>service?.enabled!==false);
    const flyout=document.querySelector('.header nav .service-flyout');
    if(flyout){
      flyout.innerHTML=services.map(service=>`<a href="${B}/services/${encodeURIComponent(service.slug)}/"><span>${esc(service.name)}</span><small>${esc(service.en||'SERVICE')}</small></a>`).join('');
      flyout.dataset.dynamicCatalog='1';
    }
    const dropdown=document.querySelector('.header nav .service-dropdown');
    if(dropdown){
      dropdown.innerHTML=services.map(service=>`<a href="${B}/services/${encodeURIComponent(service.slug)}/"><strong>${esc(service.name)}</strong><small>${esc(service.en||'SERVICE')}</small></a>`).join('');
      dropdown.dataset.dynamicCatalog='1';
    }
  };
  addEventListener('77waxing:catalog-ready',event=>apply(event.detail));
  if(Array.isArray(window.__77_SERVICE_CATALOG__))apply(window.__77_SERVICE_CATALOG__);
})();