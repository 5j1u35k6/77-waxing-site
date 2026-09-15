(()=>{
  const app=document.querySelector('#admin-app');
  if(!app)return;

  let scheduled=false;
  function polishSidebar(){
    scheduled=false;
    const side=app.querySelector('.admin-side');
    const logout=app.querySelector('#logout');
    if(!side||!logout)return;

    let tools=side.querySelector('[data-admin-side-tools]');
    if(!tools){
      tools=document.createElement('div');
      tools.className='admin-side-tools';
      tools.dataset.adminSideTools='1';

      const siteLink=document.createElement('a');
      siteLink.className='admin-site-link';
      siteLink.href='./';
      siteLink.textContent='← 回到網站';
      tools.appendChild(siteLink);
      side.appendChild(tools);
    }

    if(logout.parentElement!==tools)tools.appendChild(logout);
    logout.classList.add('admin-side-logout');
    logout.textContent='登出';
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(polishSidebar);
  }

  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  schedule();
})();
