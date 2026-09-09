(()=>{
  const PREFILL_KEY='77waxing-booking-prefill';
  const MAX_AGE=10*60*1000;
  const normalize=(value)=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();

  function readStorage(storage){
    try{
      const raw=storage.getItem(PREFILL_KEY);
      if(!raw)return {category:'',item:''};
      const parsed=JSON.parse(raw);
      const age=Date.now()-Number(parsed?.ts||0);
      if(!parsed?.category||!parsed?.item||!Number.isFinite(age)||age<0||age>MAX_AGE){
        storage.removeItem(PREFILL_KEY);
        return {category:'',item:''};
      }
      return {category:normalize(parsed.category),item:normalize(parsed.item)};
    }catch{
      return {category:'',item:''};
    }
  }

  function readWanted(){
    const search=new URLSearchParams(location.search);
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const session=readStorage(sessionStorage);
    const local=readStorage(localStorage);
    return {
      category:normalize(search.get('category')||hash.get('category')||session.category||local.category),
      item:normalize(search.get('item')||hash.get('item')||session.item||local.item)
    };
  }

  function clearStored(){
    try{sessionStorage.removeItem(PREFILL_KEY)}catch{}
    try{localStorage.removeItem(PREFILL_KEY)}catch{}
  }

  let done=false;
  let attempts=0;
  let timer=0;
  const retry=(delay=60)=>{
    if(done||attempts>=120||timer)return;
    timer=window.setTimeout(()=>{
      timer=0;
      attempts+=1;
      applyPrefill();
    },delay);
  };

  function applyPrefill(){
    if(done)return;
    const wanted=readWanted();
    if(!wanted.category||!wanted.item){
      retry(100);
      return;
    }

    const booking=document.querySelector('#booking[data-booking-v3-mounted="1"]');
    if(!booking){
      retry();
      return;
    }

    const categoryButton=[...booking.querySelectorAll('[data-booking-category]')]
      .find(button=>normalize(button.dataset.bookingCategory)===wanted.category);
    if(!categoryButton||typeof categoryButton.onclick!=='function'){
      retry();
      return;
    }

    if(!categoryButton.classList.contains('on')){
      categoryButton.click();
      retry(40);
      return;
    }

    const itemButton=[...booking.querySelectorAll('[data-booking-item]')]
      .find(button=>normalize(button.querySelector('b')?.textContent)===wanted.item);
    if(!itemButton||typeof itemButton.onclick!=='function'){
      retry();
      return;
    }

    if(!itemButton.classList.contains('on')){
      itemButton.click();
      retry(40);
      return;
    }

    const nextButton=booking.querySelector('[data-step="1"] [data-next]');
    if(!nextButton||nextButton.disabled){
      itemButton.click();
      retry(40);
      return;
    }

    const note=booking.querySelector('[data-booking-prefill-note]');
    if(note){
      note.hidden=false;
      note.textContent=`已從價目表帶入：${normalize(categoryButton.textContent)}｜${wanted.item}`;
    }
    booking.dataset.bookingPrefillSuccess='1';
    booking.dataset.bookingPrefillCategory=wanted.category;
    booking.dataset.bookingPrefillItem=wanted.item;
    clearStored();
    done=true;
    if(timer){clearTimeout(timer);timer=0}
  }

  const app=document.querySelector('#app')||document.body;
  const observer=new MutationObserver(()=>retry(0));
  observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-booking-v3-mounted']});
  addEventListener('hashchange',()=>{done=false;attempts=0;retry(0)});
  retry(0);
})();
