(()=>{
  const PREFILL_KEY='77waxing-booking-prefill';

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

  function readStoredPrefill(){
    try{
      const raw=sessionStorage.getItem(PREFILL_KEY);
      if(!raw)return {category:'',item:''};
      const parsed=JSON.parse(raw);
      const age=Date.now()-Number(parsed?.ts||0);
      if(!parsed?.category||!parsed?.item||!Number.isFinite(age)||age>10*60*1000){
        sessionStorage.removeItem(PREFILL_KEY);
        return {category:'',item:''};
      }
      return {category:String(parsed.category).trim(),item:String(parsed.item).trim()};
    }catch{
      return {category:'',item:''};
    }
  }

  function readPrefill(){
    const search=new URLSearchParams(location.search);
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const stored=readStoredPrefill();
    return {
      category:(search.get('category')||hash.get('category')||stored.category||'').trim(),
      item:(search.get('item')||hash.get('item')||stored.item||'').trim()
    };
  }

  function clearStoredPrefill(){
    try{sessionStorage.removeItem(PREFILL_KEY)}catch{}
  }

  let prefillDone=false;
  let prefillAttempts=0;
  let prefillTimer=0;
  function schedulePrefill(delay=70){
    if(prefillDone||prefillAttempts>=45||prefillTimer)return;
    prefillTimer=window.setTimeout(()=>{
      prefillTimer=0;
      prefillAttempts+=1;
      applyPrefill();
    },delay);
  }

  function applyPrefill(){
    if(prefillDone)return;
    const wanted=readPrefill();
    if(!wanted.category||!wanted.item){
      prefillDone=true;
      return;
    }

    const booking=document.querySelector('#booking[data-booking-v3-mounted="1"]');
    if(!booking){
      schedulePrefill();
      return;
    }

    const categoryButton=[...booking.querySelectorAll('[data-booking-category]')]
      .find(button=>button.dataset.bookingCategory===wanted.category);
    if(!categoryButton){
      schedulePrefill();
      return;
    }

    if(!categoryButton.classList.contains('on')){
      categoryButton.click();
      schedulePrefill(30);
      return;
    }

    const itemButton=[...booking.querySelectorAll('[data-booking-item]')]
      .find(button=>(button.querySelector('b')?.textContent||'').trim()===wanted.item);
    if(!itemButton){
      schedulePrefill();
      return;
    }

    if(!itemButton.classList.contains('on')){
      itemButton.click();
      schedulePrefill(30);
      return;
    }

    const nextButton=booking.querySelector('[data-step="1"] [data-next]');
    if(nextButton)nextButton.disabled=false;
    const note=booking.querySelector('[data-booking-prefill-note]');
    if(note){
      const categoryName=(categoryButton.textContent||'').trim();
      note.hidden=false;
      note.textContent=`已從價目表帶入：${categoryName}｜${wanted.item}`;
    }
    clearStoredPrefill();
    prefillDone=true;
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
  schedulePrefill(0);
})();