(()=>{
  const REMOVE_TEXTS=[
    '總覽版型固定存在；有資料時填入趨勢，尚無資料時保留同一個位置顯示 0 與空白狀態。',
    '資料直接來自 Firestore。待確認會顯示保留中；確認後重疊時段從顧客端隱藏；取消／完成／未到店會釋放鎖定。'
  ];
  const REPLACE_TEXTS=new Map([
    ['這裡只控制服務是否開放線上預約；關閉後顧客端不再顯示該細項。','控制服務是否開放線上預約；關閉後顧客端不再顯示該細項。'],
    ['修改後會同步提供給價目頁與預約選項使用。可保留「$1599 / 899」這類雙價格格式。','修改後會同步提供給價目頁與預約選項使用。']
  ]);

  let scheduled=false;
  let bootAttempts=0;

  const normalized=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const isDashboard=()=>((location.hash||'#dashboard').slice(1)||'dashboard')==='dashboard';

  function cleanCopy(){
    document.querySelectorAll('#admin-preview p,#admin-preview small,#admin-preview span').forEach(node=>{
      const text=normalized(node);
      if(!text)return;
      const remove=REMOVE_TEXTS.find(target=>text===target||text.includes(target));
      if(remove){
        const parent=node.parentElement;
        node.remove();
        if(parent&&parent.children.length===0&&!normalized(parent))parent.remove();
        return;
      }
      for(const [from,to] of REPLACE_TEXTS){
        if(text===from){node.textContent=to;break;}
      }
    });
  }

  function dashboardReady(){
    const dash=document.querySelector('body.admin-page #admin-preview .dash');
    const panel=dash?.querySelector('[data-dashboard-v3]');
    const metrics=dash?.querySelector('.metrics');
    return !!(dash&&panel&&!panel.hidden&&metrics&&!metrics.hidden);
  }

  function ensureInitialDashboard(){
    if(!isDashboard()||dashboardReady())return;
    const dash=document.querySelector('body.admin-page #admin-preview .dash');
    if(!dash)return;
    const link=[...document.querySelectorAll('#admin-preview .sidebar a')].find(a=>(a.textContent||'').trim()==='總覽');
    if(link){
      link.click();
      window.dispatchEvent(new Event('hashchange'));
    }
    if(++bootAttempts<30)setTimeout(schedule,120);
  }

  function apply(){
    scheduled=false;
    cleanCopy();
    ensureInitialDashboard();
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true,characterData:true});
  addEventListener('hashchange',()=>{bootAttempts=0;schedule();});
  addEventListener('popstate',()=>{bootAttempts=0;schedule();});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#admin-preview .sidebar a'))setTimeout(schedule,0);
  });
  schedule();
})();
