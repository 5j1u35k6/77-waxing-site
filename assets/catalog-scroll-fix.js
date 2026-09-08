(()=>{
  let raf=0;
  let lockRaf=0;
  let unlockTimer=0;
  let lockedId='';

  function elements(){
    const nav=document.querySelector('.price-jump');
    const sections=[...document.querySelectorAll('[data-price-section]')];
    const buttons=nav?[...nav.querySelectorAll('[data-price-jump]')]:[];
    return {nav,sections,buttons};
  }

  function setActive(id){
    const {nav,buttons}=elements();
    if(!nav||!id)return;
    buttons.forEach(button=>button.classList.toggle('on',button.dataset.priceJump===id));
    const active=buttons.find(button=>button.dataset.priceJump===id);
    if(active&&innerWidth<=850){
      const left=active.offsetLeft-(nav.clientWidth-active.offsetWidth)/2;
      nav.scrollTo({left:Math.max(0,left),behavior:'smooth'});
    }
  }

  function syncPriceJump(){
    const {nav,sections}=elements();
    if(!nav||!sections.length)return;
    if(lockedId){setActive(lockedId);return;}
    const stickyShell=document.querySelector('.price-jump-shell');
    const header=document.querySelector('.header');
    const headerHeight=header?.getBoundingClientRect().height||64;
    const stickyHeight=stickyShell?.getBoundingClientRect().height||56;
    const threshold=headerHeight+stickyHeight+20;
    let active=sections[0];
    for(const section of sections){
      if(section.getBoundingClientRect().top<=threshold)active=section;
      else break;
    }
    if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-8){
      active=sections[sections.length-1];
    }
    setActive(active.id);
  }

  function requestSync(){cancelAnimationFrame(raf);raf=requestAnimationFrame(syncPriceJump)}

  function maintainLock(){
    cancelAnimationFrame(lockRaf);
    const tick=()=>{
      if(!lockedId)return;
      setActive(lockedId);
      lockRaf=requestAnimationFrame(tick);
    };
    lockRaf=requestAnimationFrame(tick);
  }

  function releaseLock(delay=0){
    clearTimeout(unlockTimer);
    unlockTimer=setTimeout(()=>{
      lockedId='';
      cancelAnimationFrame(lockRaf);
      requestSync();
    },delay);
  }

  function jumpTo(button,behavior='smooth'){
    const id=button.dataset.priceJump;
    const target=document.getElementById(id);
    if(!target)return;
    const header=document.querySelector('.header');
    const shell=document.querySelector('.price-jump-shell');
    const offset=(header?.getBoundingClientRect().height||64)+(shell?.getBoundingClientRect().height||56)+14;
    const top=window.scrollY+target.getBoundingClientRect().top-offset;
    lockedId=id;
    setActive(id);
    maintainLock();
    history.replaceState(null,'',`${location.pathname}#${id}`);
    window.scrollTo({top:Math.max(0,top),behavior});
    releaseLock(behavior==='smooth'?900:80);
  }

  function bind(){
    const {nav}=elements();
    if(!nav||nav.dataset.scrollFixBound)return;
    nav.dataset.scrollFixBound='1';
    nav.querySelectorAll('[data-price-jump]').forEach(button=>{
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        jumpTo(button,'smooth');
      },true);
    });
    const hashId=(location.hash||'').slice(1);
    const initial=hashId?nav.querySelector(`[data-price-jump="${CSS.escape(hashId)}"]`):null;
    if(initial&&!nav.dataset.initialHashFixed){
      nav.dataset.initialHashFixed='1';
      requestAnimationFrame(()=>jumpTo(initial,'auto'));
    }else requestSync();
  }

  addEventListener('scroll',requestSync,{passive:true});
  addEventListener('resize',requestSync);
  if('onscrollend' in window)addEventListener('scrollend',()=>{if(lockedId)releaseLock(60)},{passive:true});
  new MutationObserver(()=>{bind();requestSync()}).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  bind();
})();
