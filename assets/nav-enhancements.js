(()=>{
  const source=document.currentScript?.src||location.href;
  const memberUrl=new URL('./member-auth.js?v=20260915-member2',source).href;
  const googleUrl=new URL('./google-auth-ui.js?v=20260915-google4-restore',source).href;
  const popupFixUrl=new URL('./member-auth-popup-fix.js?v=20260915-line-custom5',source).href;
  import(memberUrl)
    .then(()=>import(googleUrl))
    .then(()=>import(popupFixUrl))
    .catch(error=>console.warn('77waxing member layer unavailable',error));
})();

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

  if(!aboutLink)return;
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
  addEventListener('resize',hide);
  new MutationObserver(()=>{if(aboutMenu.classList.contains('on'))position()}).observe(nav,{childList:true,subtree:true});
})();

(()=>{
  const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
  const legal=document.querySelector('.footer-legal');
  if(!legal||legal.querySelector('[data-privacy-link]'))return;
  const p=document.createElement('p');
  const a=document.createElement('a');
  a.href=`${B}/privacy/`;
  a.textContent='隱私權政策';
  a.dataset.privacyLink='1';
  p.appendChild(a);
  legal.insertBefore(p,legal.querySelector('.footer-credit')||null);
})();

(()=>{
  const source=document.currentScript?.src||location.href;
  const railUrl=new URL('./desktop-rail-nav.js?v=20260915-rail3',source).href;
  const railPolishUrl=new URL('./desktop-rail-collapse-polish.js?v=20260915-rail4-polish',source).href;
  import(railUrl)
    .then(()=>import(railPolishUrl))
    .catch(error=>console.warn('77waxing desktop rail unavailable',error));
})();

(()=>{
  const source=document.currentScript?.src||location.href;
  const footerUrl=new URL('./footer-enhancements.js?v=20260915-footer4-soft-coral',source).href;
  import(footerUrl).catch(error=>console.warn('77waxing footer unavailable',error));
})();
