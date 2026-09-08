(()=>{
  let raf=0;
  function syncPriceJump(){
    const nav=document.querySelector('.price-jump');
    const sections=[...document.querySelectorAll('[data-price-section]')];
    if(!nav||!sections.length)return;
    const buttons=[...nav.querySelectorAll('[data-price-jump]')];
    const stickyShell=document.querySelector('.price-jump-shell');
    const header=document.querySelector('.header');
    const headerHeight=header?.getBoundingClientRect().height||64;
    const stickyHeight=stickyShell?.getBoundingClientRect().height||56;
    const threshold=headerHeight+stickyHeight+28;
    let active=sections[0];
    for(const section of sections){
      if(section.getBoundingClientRect().top<=threshold)active=section;
      else break;
    }
    const bottomReached=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4;
    if(bottomReached)active=sections[sections.length-1];
    buttons.forEach(button=>button.classList.toggle('on',button.dataset.priceJump===active.id));
  }
  function requestSync(){cancelAnimationFrame(raf);raf=requestAnimationFrame(syncPriceJump)}
  function bind(){
    const nav=document.querySelector('.price-jump');
    if(!nav||nav.dataset.scrollFixBound)return;
    nav.dataset.scrollFixBound='1';
    nav.querySelectorAll('[data-price-jump]').forEach(button=>{
      button.addEventListener('click',event=>{
        event.preventDefault();
        const target=document.getElementById(button.dataset.priceJump);
        if(!target)return;
        const header=document.querySelector('.header');
        const shell=document.querySelector('.price-jump-shell');
        const offset=(header?.getBoundingClientRect().height||64)+(shell?.getBoundingClientRect().height||56)+16;
        const top=window.scrollY+target.getBoundingClientRect().top-offset;
        window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
        nav.querySelectorAll('[data-price-jump]').forEach(item=>item.classList.toggle('on',item===button));
      },true);
    });
    requestSync();
  }
  addEventListener('scroll',requestSync,{passive:true});
  addEventListener('resize',requestSync);
  new MutationObserver(()=>{bind();requestSync()}).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  bind();
})();
