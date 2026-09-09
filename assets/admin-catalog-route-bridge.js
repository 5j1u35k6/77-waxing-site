(()=>{
  const wantedViews=new Set(['services','pricing']);
  let timer=0;
  let observerTimer=0;

  const currentView=()=>((location.hash||'#dashboard').slice(1)||'dashboard');
  const workspace=()=>document.querySelector('body.admin-page #admin-preview .admin-v2-workspace');

  function requestCatalogRender(delay=0){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!wantedViews.has(currentView()))return;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },delay);
  }

  window.addEventListener('77waxing:admin-catalog-route',()=>requestCatalogRender(0));

  document.addEventListener('click',(event)=>{
    const link=event.target.closest?.('#admin-preview .sidebar a');
    if(!link)return;
    const label=(link.textContent||'').trim();
    if(label==='服務管理'||label==='價格管理')requestCatalogRender(30);
  },true);

  new MutationObserver(()=>{
    if(!wantedViews.has(currentView()))return;
    clearTimeout(observerTimer);
    observerTimer=setTimeout(()=>{
      const node=workspace();
      if(!node)return requestCatalogRender(20);
      const view=currentView();
      if(node.dataset.catalogOwned!==view||!node.querySelector(`[data-dynamic-catalog-view="${view}"]`))requestCatalogRender(10);
    },20);
  }).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});

  addEventListener('pageshow',()=>requestCatalogRender(0));
  requestCatalogRender(0);
})();
