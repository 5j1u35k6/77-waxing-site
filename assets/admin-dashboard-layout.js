(()=>{
  let scheduled=false;

  const view=()=>((location.hash||'#dashboard').slice(1)||'dashboard');
  const dash=()=>document.querySelector('body.admin-page #admin-preview .dash');

  function ensureConceptHeading(host){
    let heading=host.querySelector('[data-admin-concept-heading]');
    if(!heading){
      heading=document.createElement('div');
      heading.className='admin-concept-heading';
      heading.dataset.adminConceptHeading='1';
      heading.innerHTML='<span class="tag">OVERVIEW</span><h3>概論</h3><p class="muted">快速掌握目前預約狀態。</p>';
    }
    return heading;
  }

  function apply(){
    scheduled=false;
    const host=dash();
    if(!host)return;

    const top=host.querySelector('.admin-topline');
    const metrics=host.querySelector('.metrics');
    const dashboard=host.querySelector('[data-dashboard-v3]');
    const heading=ensureConceptHeading(host);
    const isDashboard=view()==='dashboard';

    if(top&&host.firstElementChild!==top)host.insertBefore(top,host.firstElementChild);

    if(top){
      if(top.nextElementSibling!==heading)top.insertAdjacentElement('afterend',heading);
    }else if(host.firstElementChild!==heading){
      host.insertBefore(heading,host.firstElementChild);
    }

    if(metrics&&heading.nextElementSibling!==metrics)heading.insertAdjacentElement('afterend',metrics);
    if(dashboard&&metrics&&metrics.nextElementSibling!==dashboard)metrics.insertAdjacentElement('afterend',dashboard);
    else if(dashboard&&!metrics&&heading.nextElementSibling!==dashboard)heading.insertAdjacentElement('afterend',dashboard);

    heading.hidden=!isDashboard;
    if(top)top.classList.add('admin-topline-primary');
    if(metrics)metrics.classList.add('admin-concept-metrics');
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(apply);
  }

  const root=document.querySelector('#app')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
  addEventListener('hashchange',schedule);
  addEventListener('popstate',schedule);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.sidebar a,[data-overview-calendar],[data-overview-customers],[data-overview-bookings]'))setTimeout(schedule,0);
  });
  schedule();
})();