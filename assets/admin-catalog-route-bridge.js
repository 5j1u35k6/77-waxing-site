(()=>{
  const VERSION='20260909-2005';
  const wantedViews=new Set(['services','pricing']);
  let timer=0;
  let observerTimer=0;
  let attempts=0;
  let modulePromise=null;

  const currentView=()=>((location.hash||'#dashboard').slice(1)||'dashboard');
  const workspace=()=>document.querySelector('body.admin-page #admin-preview .admin-v2-workspace');
  const dynamicReady=(view,node=workspace())=>!!(node&&node.dataset.catalogOwned===view&&node.querySelector(`[data-dynamic-catalog-view="${view}"]`));

  function loadingMarkup(view){
    return `<div class="admin-view-head"><div><span class="tag">${view==='services'?'SERVICES':'PRICING'}</span><h3>${view==='services'?'服務管理':'價格管理'}</h3></div></div><p class="muted">正在載入新版管理工具…</p><p class="muted" style="font-size:.78rem">Catalog ${VERSION}</p>`;
  }

  function failureMarkup(view,error){
    const code=String(error?.name||'LOAD_ERROR').replace(/[<>]/g,'');
    return `<div class="admin-view-head"><div><span class="tag">${view==='services'?'SERVICES':'PRICING'}</span><h3>${view==='services'?'服務管理':'價格管理'}</h3></div></div><div class="firebase-state warning"><b>新版服務管理未成功載入</b><p>請重新整理後再試；若仍出現此畫面，請回報錯誤碼：${code} · Catalog ${VERSION}</p></div>`;
  }

  function removeLegacyView(view){
    const node=workspace();
    if(!node||dynamicReady(view,node))return node;
    const legacy=node.querySelector('.service-admin-list,.pricing-admin-list,[data-service-toggle],[data-price-input]');
    if(legacy){
      node.hidden=false;
      node.dataset.catalogOwned='guard-loading';
      node.innerHTML=loadingMarkup(view);
    }
    return node;
  }

  function loadCatalogModule(){
    if(modulePromise)return modulePromise;
    const url=new URL(`../assets/admin-service-catalog.js?v=${VERSION}-guard`,document.baseURI).href;
    modulePromise=import(url).catch((error)=>{
      modulePromise=null;
      throw error;
    });
    return modulePromise;
  }

  function schedule(delay=0){
    clearTimeout(timer);
    timer=setTimeout(enforce,delay);
  }

  async function enforce(){
    const view=currentView();
    if(!wantedViews.has(view)){attempts=0;return;}
    const node=removeLegacyView(view);
    if(dynamicReady(view,node)){
      attempts=0;
      node.dataset.catalogRuntime=VERSION;
      return;
    }

    try{
      await loadCatalogModule();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.dispatchEvent(new CustomEvent('77waxing:admin-catalog-route',{detail:{view,source:'guard'}}));
    }catch(error){
      console.error('77waxing dynamic catalog load failed',error);
      const target=workspace();
      if(target){target.hidden=false;target.dataset.catalogOwned='guard-error';target.innerHTML=failureMarkup(view,error);}
      return;
    }

    if(dynamicReady(view)){
      attempts=0;
      workspace().dataset.catalogRuntime=VERSION;
      return;
    }

    attempts+=1;
    if(attempts<50){
      schedule(120);
    }else{
      const target=workspace();
      if(target){target.hidden=false;target.dataset.catalogOwned='guard-timeout';target.innerHTML=failureMarkup(view,{name:'CATALOG_TIMEOUT'});}
    }
  }

  window.addEventListener('77waxing:admin-catalog-route',()=>schedule(0));
  window.addEventListener('hashchange',()=>{attempts=0;schedule(0);});
  window.addEventListener('popstate',()=>{attempts=0;schedule(0);});
  window.addEventListener('pageshow',()=>schedule(0));

  document.addEventListener('click',(event)=>{
    const link=event.target.closest?.('#admin-preview .sidebar a');
    if(!link)return;
    const label=(link.textContent||'').trim();
    if(label==='服務管理'||label==='價格管理'){attempts=0;schedule(20);}
  },true);

  new MutationObserver(()=>{
    const view=currentView();
    if(!wantedViews.has(view))return;
    clearTimeout(observerTimer);
    observerTimer=setTimeout(()=>{
      if(!dynamicReady(view))schedule(0);
    },30);
  }).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});

  document.documentElement.dataset.adminCatalogGuard=VERSION;
  schedule(0);
})();
