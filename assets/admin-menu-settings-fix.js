(()=>{
  const DESIRED_TAIL=["服務功能","時段功能","價格功能","網站設定"];
  let queued=false;

  function normalizeSidebar(){
    const sidebar=document.querySelector('body.admin-page #admin-preview .sidebar');
    if(!sidebar)return;
    const links=[...sidebar.querySelectorAll('a')];
    const customerIndex=links.findIndex(link=>(link.textContent||'').trim()==='顧客資料');
    if(customerIndex<0)return;
    const tail=links.slice(customerIndex+1);
    if(tail.length<4)return;

    tail.slice(0,4).forEach((link,index)=>{
      if((link.textContent||'').trim()!==DESIRED_TAIL[index])link.textContent=DESIRED_TAIL[index];
      link.hidden=false;
    });
    tail.slice(4).forEach(link=>{link.hidden=true;});
  }

  function ensureEarlyStartOptions(){
    const select=document.querySelector('body.admin-page select[name="bookingStartTime"]');
    if(!select)return;
    const current=select.value;
    const required=['08:00','08:30','09:00','09:30'];
    required.forEach(value=>{
      if([...select.options].some(option=>option.value===value))return;
      const option=document.createElement('option');
      option.value=value;
      option.textContent=value;
      select.appendChild(option);
    });
    const options=[...select.options].sort((a,b)=>a.value.localeCompare(b.value));
    options.forEach(option=>select.appendChild(option));
    if([...select.options].some(option=>option.value===current))select.value=current;
  }

  function apply(){
    queued=false;
    normalizeSidebar();
    ensureEarlyStartOptions();
  }
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(schedule,0));
  addEventListener('popstate',()=>setTimeout(schedule,0));
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.sidebar a'))setTimeout(schedule,0);
  },true);
  schedule();
})();
