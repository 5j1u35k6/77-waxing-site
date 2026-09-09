(()=>{
  const VERSION='20260909-2020';
  const TIMEOUT_MS=10000;
  const wantedViews=new Set(['services','pricing']);
  let timer=0;
  let observerTimer=0;
  let startedAt=0;
  let modulePromise=null;
  let failed=false;

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

  function showLoading(view){
    const node=workspace();
    if(!node||dynamicReady(view,node))return node;
    const legacy=node.querySelector('.service-admin-list,.pricing-admin-list,[data-service-toggle],[data-price-input]');
    const placeholder=node.dataset.catalogOwned==='pending'||node.dataset.catalogOwned==='guard-loading'||/正在載入管理工具/.test(node.textContent||'');
    if(legacy||placeholder){
      node.hidden=false;
      node.dataset.catalogOwned='guard-loading';
      if(!node.querySelector(`[data-catalog-loader-version="${VERSION}"]`)){
        node.innerHTML=`<div data-catalog-loader-version="${VERSION}">${loadingMarkup(view)}</div>`;
      }
    }
    return node;
  }

  function showFailure(view,error){
    failed=true;
    clearTimeout(timer);
    const target=workspace();
    if(target){
      target.hidden=false;
      target.dataset.catalogOwned='guard-error';
      target.innerHTML=failureMarkup(view,error);
    }
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
    if(!wantedViews.has(view)){
      startedAt=0;
      failed=false;
      return;
    }
    if(failed)return;

    const node=showLoading(view);
    if(dynamicReady(view,node)){
      startedAt=0;
      node.dataset.catalogRuntime=VERSION;
      return;
    }

    if(!startedAt)startedAt=Date.now();
    if(Date.now()-startedAt>=TIMEOUT_MS){
      showFailure(view,{name:'CATALOG_TIMEOUT'});
      return;
    }

    try{
      await loadCatalogModule();
    }catch(error){
      console.error('77waxing dynamic catalog load failed',error);
      showFailure(view,error);
      return;
    }

    if(dynamicReady(view)){
      startedAt=0;
      workspace().dataset.catalogRuntime=VERSION;
      return;
    }

    schedule(150);
  }

  function restart(){
    startedAt=0;
    failed=false;
    schedule(0);
  }

  window.addEventListener('77waxing:admin-catalog-route',restart);
  window.addEventListener('hashchange',restart);
  window.addEventListener('popstate',restart);
  window.addEventListener('pageshow',restart);

  document.addEventListener('click',(event)=>{
    const link=event.target.closest?.('#admin-preview .sidebar a');
    if(!link)return;
    const label=(link.textContent||'').trim();
    if(label==='服務管理'||label==='價格管理')setTimeout(restart,20);
  },true);

  new MutationObserver(()=>{
    const view=currentView();
    if(!wantedViews.has(view)||failed||dynamicReady(view))return;
    clearTimeout(observerTimer);
    observerTimer=setTimeout(()=>schedule(0),80);
  }).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});

  document.documentElement.dataset.adminCatalogGuard=VERSION;
  schedule(0);
})();
