(()=>{
  const params=new URLSearchParams(location.search);
  const wantedCategory=(params.get('category')||'').trim();
  const wantedItem=(params.get('item')||'').trim();
  if(!wantedCategory||!wantedItem)return;

  let done=false;
  let attempts=0;
  const MAX_ATTEMPTS=80;

  const apply=()=>{
    if(done||attempts++>MAX_ATTEMPTS)return;
    const booking=document.querySelector('#booking[data-booking-v3-mounted="1"]');
    if(!booking){setTimeout(apply,60);return;}

    const categoryButton=[...booking.querySelectorAll('[data-booking-category]')]
      .find((button)=>button.dataset.bookingCategory===wantedCategory);
    if(!categoryButton){setTimeout(apply,60);return;}

    if(!categoryButton.classList.contains('on')){
      categoryButton.click();
      setTimeout(apply,30);
      return;
    }

    const itemButton=[...booking.querySelectorAll('[data-booking-item]')]
      .find((button)=>button.querySelector('b')?.textContent.trim()===wantedItem);
    if(!itemButton){setTimeout(apply,60);return;}

    if(!itemButton.classList.contains('on'))itemButton.click();

    const nextButton=booking.querySelector('[data-step="1"] [data-next]');
    if(nextButton)nextButton.disabled=false;

    const note=booking.querySelector('[data-booking-prefill-note]');
    if(note){
      note.hidden=false;
      note.textContent=`已從價目表帶入：${categoryButton.textContent.trim()}｜${wantedItem}`;
    }

    done=true;
  };

  const app=document.querySelector('#app');
  if(app)new MutationObserver(()=>queueMicrotask(apply)).observe(app,{childList:true,subtree:true,attributes:true});
  setTimeout(apply,0);
})();
