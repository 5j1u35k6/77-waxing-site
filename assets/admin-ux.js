(()=>{
  let scheduled=false;
  function run(){
    scheduled=false;
    const root=document.querySelector('#admin-preview');
    if(!root)return;
    const sidebar=root.querySelector('.sidebar');
    if(sidebar){
      const labels=['總覽','預約管理','預約行事曆','顧客資料','服務管理','價格管理','網站設定'];
      [...sidebar.querySelectorAll('a')].slice(0,labels.length).forEach((a,i)=>{if(a.textContent.trim()!==labels[i])a.textContent=labels[i];});
      if(!sidebar.querySelector('[data-admin-site-link]')){
        const logout=sidebar.querySelector('[data-admin-logout]');
        if(logout){const a=document.createElement('a');a.href='/77-waxing-site/';a.textContent='← 回到網站';a.dataset.adminSiteLink='1';a.className='admin-site-link';sidebar.insertBefore(a,logout);}
      }
    }
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
