(()=>{
  let scheduled=false;
  const ROUTES=[
    ['#dashboard','總覽'],
    ['#bookings','預約管理'],
    ['#calendar','預約行事曆'],
    ['#customers','顧客資料'],
    ['#services','服務功能'],
    ['#slots','時段功能'],
    ['#pricing','價格功能'],
    ['#settings','網站設定'],
  ];
  const LABELS=new Map(ROUTES);

  function routeOf(anchor){
    const href=anchor?.getAttribute('href')||'';
    if(!href)return '';
    try{return new URL(href,location.href).hash||'';}catch{return href.startsWith('#')?href:'';}
  }

  function normalizeSidebar(sidebar){
    const byRoute=new Map();
    [...sidebar.querySelectorAll('a')].forEach(anchor=>{
      const route=routeOf(anchor);
      if(!LABELS.has(route))return;
      if(byRoute.has(route)){
        anchor.remove();
        return;
      }
      byRoute.set(route,anchor);
      const label=LABELS.get(route);
      if((anchor.textContent||'').trim()!==label)anchor.textContent=label;
    });

    const expected=ROUTES.map(([route])=>route).filter(route=>byRoute.has(route));
    const current=[...sidebar.querySelectorAll('a')].map(routeOf).filter(route=>LABELS.has(route));
    if(current.join('|')!==expected.join('|')){
      const marker=sidebar.querySelector('[data-admin-site-link]')||sidebar.querySelector('[data-admin-logout]');
      if(marker)expected.forEach(route=>sidebar.insertBefore(byRoute.get(route),marker));
    }

    if(!sidebar.querySelector('[data-admin-site-link]')){
      const logout=sidebar.querySelector('[data-admin-logout]');
      if(logout){
        const a=document.createElement('a');
        a.href='/77-waxing-site/';
        a.textContent='← 回到網站';
        a.dataset.adminSiteLink='1';
        a.className='admin-site-link';
        sidebar.insertBefore(a,logout);
      }
    }
  }

  function run(){
    scheduled=false;
    const root=document.querySelector('#admin-preview');
    if(!root)return;
    const sidebar=root.querySelector('.sidebar');
    if(sidebar)normalizeSidebar(sidebar);
    document.querySelectorAll('body.admin-page > .firebase-state.ok,body.admin-page > .firebase-state.info,#app > .firebase-state.ok,#app > .firebase-state.info').forEach(n=>n.remove());
    root.querySelectorAll('.firebase-state.ok,.firebase-state.info').forEach(n=>n.remove());
    root.querySelectorAll('.admin-topline .tag').forEach(n=>{if(n.textContent.includes('FIRESTORE'))n.textContent='ADMIN';});
    root.querySelectorAll('.firebase-live').forEach(n=>{if(n.textContent!=='● 即時同步')n.textContent='● 即時同步';});
    const login=root.querySelector('.admin-login-card');
    if(login){
      const p=login.querySelector('.muted');
      if(p)p.textContent='請使用管理員帳號登入。';
    }
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(run);}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  run();
})();
