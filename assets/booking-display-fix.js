(()=>{
  function applyMenuPrefill(){
    const booking=document.querySelector('#booking[data-booking-v3-mounted="1"]');
    if(!booking||booking.dataset.menuPrefillApplied==='1')return;
    const params=new URLSearchParams(location.search);
    const wantedCategory=(params.get('category')||'').trim();
    const wantedItem=(params.get('item')||'').trim();
    if(!wantedCategory||!wantedItem)return;

    const categoryButton=[...booking.querySelectorAll('[data-booking-category]')]
      .find(button=>button.dataset.bookingCategory===wantedCategory);
    if(!categoryButton)return;
    if(!categoryButton.classList.contains('on')){
      categoryButton.click();
      return;
    }

    const itemButton=[...booking.querySelectorAll('[data-booking-item]')]
      .find(button=>button.querySelector('b')?.textContent.trim()===wantedItem);
    if(!itemButton)return;
    if(!itemButton.classList.contains('on')){
      itemButton.click();
      return;
    }

    const nextButton=booking.querySelector('[data-step="1"] [data-next]');
    if(nextButton)nextButton.disabled=false;
    const note=booking.querySelector('[data-booking-prefill-note]');
    if(note){
      note.hidden=false;
      note.textContent=`已從價目表帶入：${categoryButton.textContent.trim()}｜${wantedItem}`;
    }
    booking.dataset.menuPrefillApplied='1';
  }

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
    document.querySelectorAll('#booking .booking-item small').forEach(el=>{
      el.textContent=el.textContent.replace('施作時間｜','施作時間｜');
    });
    document.querySelectorAll('#booking [data-step="1"] > p.muted').forEach(el=>{
      if((el.textContent||'').includes('先選左側服務分類'))el.remove();
    });
    document.querySelectorAll('#booking [data-step="2"] > h2').forEach(el=>{
      if(el.textContent.includes('基準日期'))el.textContent='選擇日期與時段';
    });
    document.querySelectorAll('#booking [data-step="2"] > p.muted').forEach(el=>{
      if(el.textContent.includes('7 天'))el.textContent='先從月曆選日期，再從下方 7 天中選擇實際預約日與時段。';
    });
    applyMenuPrefill();
  }
  const app=document.querySelector('#app')||document.body;
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(app,{childList:true,subtree:true,attributes:true});
  apply();
})();
