(()=>{
 const header=document.querySelector('.header');
 const nav=header?.querySelector('nav');
 const hamb=header?.querySelector('.hamb');
 if(!header||!nav||!hamb)return;
 const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
 const SERVICE_ITEMS=[
   ['女性熱蠟','women-waxing'],
   ['男士熱蠟','men-waxing'],
   ['肌膚管理','skin-care'],
   ['美胸保養','bust-care']
 ];
 let backdrop=document.querySelector('.static-nav-backdrop');
 if(!backdrop){backdrop=document.createElement('button');backdrop.className='static-nav-backdrop';backdrop.setAttribute('aria-label','關閉選單');header.after(backdrop)}
 let cursor=nav.querySelector('.nav-cursor');
 if(!cursor){cursor=document.createElement('span');cursor.className='nav-cursor';cursor.setAttribute('aria-hidden','true');nav.prepend(cursor)}
 const topLinks=()=>[...nav.children].filter(el=>el.matches?.('a'));
 const cursorLinks=()=>topLinks().filter(a=>!a.classList.contains('book'));
 const serviceLink=topLinks().find(a=>{
   try{return new URL(a.href,location.href).pathname.replace(/\/$/,'').endsWith('/services')}catch{return false}
 })||null;
 let serviceMenu=nav.querySelector('.service-flyout');
 if(serviceLink&&!serviceMenu){
   serviceMenu=document.createElement('div');
   serviceMenu.className='service-flyout';
   serviceMenu.setAttribute('aria-label','施作服務選單');
   serviceMenu.innerHTML=SERVICE_ITEMS.map(([name,slug])=>`<a href="${B}/services/${slug}/" data-catalog-link><span>${name}</span><small>查看施作項目</small></a>`).join('');
   serviceLink.after(serviceMenu);
 }
 if(serviceLink){
   serviceLink.dataset.serviceTrigger='1';
   serviceLink.setAttribute('aria-haspopup','true');
   serviceLink.setAttribute('aria-expanded','false');
 }
 const current=()=>cursorLinks().find(a=>a.classList.contains('on'))||null;
 let hoverTarget=null;
 const hideCursor=()=>{if(cursor)cursor.style.opacity='0'};
 const moveCursor=(target,instant=false)=>{
   if(!target||!cursor){hideCursor();return}
   if(innerWidth<=850){hideCursor();return}
   const nr=nav.getBoundingClientRect();
   const r=target.getBoundingClientRect();
   if(!r.width||!r.height){hideCursor();return}
   if(instant)cursor.style.transition='none';
   cursor.style.width=`${r.width}px`;
   cursor.style.height=`${r.height}px`;
   cursor.style.transform=`translate3d(${r.left-nr.left}px,${r.top-nr.top}px,0)`;
   cursor.style.opacity='1';
   if(instant)requestAnimationFrame(()=>cursor.style.removeProperty('transition'));
 };
 const setCursor=(target)=>{hoverTarget=target;moveCursor(target)};
 const syncCursor=(instant=false)=>{
   if(innerWidth<=850){hideCursor();return}
   moveCursor(hoverTarget||current(),instant);
 };
 let serviceCloseTimer=0;
 const positionServiceMenu=()=>{
   if(!serviceLink||!serviceMenu||innerWidth<=850)return;
   const nr=nav.getBoundingClientRect();
   const r=serviceLink.getBoundingClientRect();
   serviceMenu.style.left=`${r.left-nr.left+r.width/2}px`;
   serviceMenu.style.top=`${r.bottom-nr.top+10}px`;
 };
 const showServiceMenu=()=>{
   if(!serviceLink||!serviceMenu)return;
   clearTimeout(serviceCloseTimer);
   positionServiceMenu();
   serviceMenu.classList.add('on');
   serviceLink.classList.add('service-open');
   serviceLink.setAttribute('aria-expanded','true');
 };
 const hideServiceMenu=()=>{
   if(!serviceLink||!serviceMenu)return;
   clearTimeout(serviceCloseTimer);
   serviceMenu.classList.remove('on');
   serviceLink.classList.remove('service-open');
   serviceLink.setAttribute('aria-expanded','false');
 };
 const scheduleServiceHide=()=>{
   clearTimeout(serviceCloseTimer);
   serviceCloseTimer=setTimeout(hideServiceMenu,130);
 };
 if(serviceMenu){
   serviceMenu.addEventListener('mouseenter',()=>{clearTimeout(serviceCloseTimer);if(serviceLink)setCursor(serviceLink)});
   serviceMenu.addEventListener('mouseleave',scheduleServiceHide);
   serviceMenu.addEventListener('focusin',()=>{clearTimeout(serviceCloseTimer);if(serviceLink)setCursor(serviceLink)});
   serviceMenu.addEventListener('focusout',event=>{if(!serviceMenu.contains(event.relatedTarget))scheduleServiceHide()});
   serviceMenu.addEventListener('click',()=>{hideServiceMenu();hoverTarget=null;if(innerWidth<=850)requestAnimationFrame(()=>close())});
 }
 if(serviceLink){
   serviceLink.addEventListener('mouseleave',scheduleServiceHide);
   serviceLink.addEventListener('click',event=>{
     if(innerWidth>850)return;
     event.preventDefault();
     event.stopPropagation();
     if(serviceMenu?.classList.contains('on'))hideServiceMenu();else showServiceMenu();
   });
 }
 const bindCursorLinks=()=>{
   topLinks().forEach(a=>{
     if(a.dataset.navMotionBound)return;
     a.dataset.navMotionBound='1';
     if(a.classList.contains('book')){
       a.addEventListener('mouseenter',()=>{hoverTarget=null;hideServiceMenu();hideCursor()});
       a.addEventListener('focus',()=>{hoverTarget=null;hideServiceMenu();hideCursor()});
       a.addEventListener('click',()=>requestAnimationFrame(()=>hideCursor()));
       return;
     }
     if(a===serviceLink){
       a.addEventListener('mouseenter',()=>{setCursor(a);showServiceMenu()});
       a.addEventListener('focus',()=>{setCursor(a);showServiceMenu()});
     }else{
       a.addEventListener('mouseenter',()=>{hideServiceMenu();setCursor(a)});
       a.addEventListener('focus',()=>{hideServiceMenu();setCursor(a)});
     }
     a.addEventListener('click',()=>requestAnimationFrame(()=>{hoverTarget=null;syncCursor()}));
   });
 };
 const sync=()=>{const open=nav.classList.contains('open');hamb.classList.toggle('is-open',open);hamb.setAttribute('aria-expanded',String(open));hamb.setAttribute('aria-label',open?'關閉選單':'開啟選單');backdrop.classList.toggle('on',open);document.body.style.overflow=open&&innerWidth<=850?'hidden':'';bindCursorLinks();if(serviceMenu?.classList.contains('on'))positionServiceMenu();requestAnimationFrame(()=>syncCursor())};
 const close=()=>{nav.classList.remove('open');hideServiceMenu();hoverTarget=null;sync()};
 hamb.setAttribute('aria-controls','static-primary-navigation');
 nav.id='static-primary-navigation';
 hamb.addEventListener('click',event=>{
   if(innerWidth>850)return;
   event.preventDefault();
   event.stopPropagation();
   const opening=!nav.classList.contains('open');
   nav.classList.toggle('open',opening);
   if(!opening)hideServiceMenu();
   sync();
 });
 nav.addEventListener('click',event=>{
   if(innerWidth>850)return;
   const link=event.target.closest?.('a[href]');
   if(!link||!nav.contains(link)||link===serviceLink)return;
   requestAnimationFrame(close);
 });
 nav.addEventListener('mouseleave',()=>{hoverTarget=null;scheduleServiceHide();syncCursor()});
 nav.addEventListener('focusout',e=>{if(!nav.contains(e.relatedTarget)){hoverTarget=null;scheduleServiceHide();syncCursor()}});
 backdrop.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideServiceMenu();close()}});
 addEventListener('resize',()=>{hideServiceMenu();hoverTarget=null;if(innerWidth>850)close();else sync();requestAnimationFrame(()=>syncCursor(true))});
 new MutationObserver(()=>{bindCursorLinks();if(serviceMenu?.classList.contains('on'))positionServiceMenu();requestAnimationFrame(()=>syncCursor())}).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 bindCursorLinks();
 sync();
 requestAnimationFrame(()=>syncCursor(true));
})();
