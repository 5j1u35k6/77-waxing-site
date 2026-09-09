(()=>{
  const header=document.querySelector('.header');
  const nav=header?.querySelector('nav');
  if(!header||!nav)return;
  const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
  const isDesktop=()=>innerWidth>850;
  const topLinks=()=>[...nav.children].filter(el=>el.matches?.('a'));
  const findTop=(suffix)=>topLinks().find(a=>{
    try{return new URL(a.href,location.href).pathname.replace(/\/$/,'').endsWith(suffix)}catch{return false}
  })||null;
  const aboutLink=findTop('/about');
  const serviceLink=findTop('/services');
  const serviceMenu=()=>nav.querySelector('.service-flyout');

  function ensureBustCare(){
    const menu=serviceMenu();
    if(!menu)return;
    const exists=[...menu.querySelectorAll('a[href]')].some(a=>{
      try{return new URL(a.href,location.href).pathname.includes('/services/bust-care/')}catch{return false}
    });
    if(exists)return;
    menu.insertAdjacentHTML('beforeend',`<a href="${B}/services/bust-care/" data-catalog-link><span>美胸保養</span><small>BUST CARE</small></a>`);
  }

  if(!aboutLink){ensureBustCare();return;}
  const ABOUT_ITEMS=[
    ['理念','philosophy','PHILOSOPHY'],
    ['首訪的你','first-visit','FIRST VISIT'],
    ['小白小白','xiaobai','XIAOBAI XIAOBAI']
  ];
  let aboutMenu=nav.querySelector('.about-flyout');
  if(!aboutMenu){
    aboutMenu=document.createElement('div');
    aboutMenu.className='about-flyout';
    aboutMenu.id='about-flyout-menu';
    aboutMenu.setAttribute('aria-label','關於 77 選單');
    aboutMenu.innerHTML=ABOUT_ITEMS.map(([name,anchor,en])=>`<a href="${B}/about/#${anchor}"><span>${name}</span><small>${en}</small></a>`).join('');
    aboutLink.after(aboutMenu);
  }

  // Match the Services parent item: it is a submenu trigger only, not a navigable page link.
  // pages.js captures [data-link] clicks at document level, so remove that marker before any interaction.
  aboutLink.removeAttribute('data-link');
  aboutLink.dataset.aboutTrigger='1';
  aboutLink.setAttribute('aria-haspopup','true');
  aboutLink.setAttribute('aria-controls','about-flyout-menu');
  aboutLink.setAttribute('aria-expanded','false');

  let closeTimer=0;
  const position=()=>{
    if(!isDesktop()||!aboutMenu)return;
    const nr=nav.getBoundingClientRect();
    const r=aboutLink.getBoundingClientRect();
    aboutMenu.style.left=`${r.left-nr.left+r.width/2}px`;
    aboutMenu.style.top=`${r.bottom-nr.top+16}px`;
  };
  const hide=()=>{
    clearTimeout(closeTimer);
    aboutMenu.classList.remove('on');
    aboutLink.classList.remove('service-open');
    aboutLink.setAttribute('aria-expanded','false');
  };
  const show=()=>{
    clearTimeout(closeTimer);
    ensureBustCare();
    const sm=serviceMenu();
    if(sm){sm.classList.remove('on');serviceLink?.classList.remove('service-open');serviceLink?.setAttribute('aria-expanded','false');}
    position();
    aboutMenu.classList.add('on');
    aboutLink.classList.add('service-open');
    aboutLink.setAttribute('aria-expanded','true');
  };
  const scheduleHide=()=>{
    if(!isDesktop())return;
    clearTimeout(closeTimer);
    closeTimer=setTimeout(hide,130);
  };

  aboutLink.addEventListener('mouseenter',()=>{if(isDesktop())show()});
  aboutLink.addEventListener('mouseleave',scheduleHide);
  aboutLink.addEventListener('focus',()=>{if(isDesktop())show()});
  aboutLink.addEventListener('click',event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    if(isDesktop()){
      show();
      return;
    }
    if(aboutMenu.classList.contains('on'))hide();else show();
  },true);

  aboutMenu.addEventListener('mouseenter',()=>{if(isDesktop())clearTimeout(closeTimer)});
  aboutMenu.addEventListener('mouseleave',scheduleHide);
  aboutMenu.addEventListener('focusin',()=>{if(isDesktop())clearTimeout(closeTimer)});
  aboutMenu.addEventListener('focusout',event=>{if(isDesktop()&&!aboutMenu.contains(event.relatedTarget))scheduleHide()});
  aboutMenu.addEventListener('click',()=>hide());

  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-service-trigger]');
    if(trigger)hide();
  },true);
  nav.addEventListener('mouseover',event=>{
    if(!isDesktop())return;
    if(event.target.closest?.('.about-flyout'))return;
    const direct=event.target.closest?.('a[href]');
    if(direct&&direct.parentElement===nav&&direct!==aboutLink)hide();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()});
  addEventListener('resize',()=>{hide();ensureBustCare()});
  new MutationObserver(()=>{ensureBustCare();if(aboutMenu.classList.contains('on'))position()}).observe(nav,{childList:true,subtree:true});
  ensureBustCare();
})();