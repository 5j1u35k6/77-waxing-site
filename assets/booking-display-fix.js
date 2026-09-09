(()=>{
  function apply(){
    document.querySelectorAll('#booking [data-booking-block-note]').forEach(el=>{
      const section=el.closest('.notice');
      if(section)section.remove();
    });

    document.querySelectorAll('#booking .dayhead em').forEach(el=>el.remove());

    document.querySelectorAll('#booking .booking-item em').forEach(el=>{
      const text=(el.textContent||'').trim();
      if(text.startsWith('時段保留'))el.remove();
    });

    document.querySelectorAll('#booking [data-step="1"] > p.muted').forEach(el=>{
      if((el.textContent||'').includes('先選左側服務分類'))el.remove();
    });

    document.querySelectorAll('#booking [data-step="2"] > h2').forEach(el=>{
      if(el.textContent.includes('基準日期'))el.textContent='選擇日期與時段';
    });

    document.querySelectorAll('#booking [data-step="2"] > p.muted').forEach(el=>{
      if(el.textContent.includes('7 天')&&el.textContent!=='先從月曆選日期，再從下方 7 天中選擇實際預約日與時段。'){
        el.textContent='先從月曆選日期，再從下方 7 天中選擇實際預約日與時段。';
      }
    });
  }

  const app=document.querySelector('#app')||document.body;
  let scheduled=false;
  const scheduleApply=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      apply();
    });
  };

  new MutationObserver(scheduleApply).observe(app,{childList:true,subtree:true});
  apply();
})();