(()=>{
 const header=document.querySelector('.header');
 const nav=header?.querySelector('nav');
 const hamb=header?.querySelector('.hamb');
 if(!header||!nav||!hamb)return;
 const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
 const SERVICE_ITEMS=[
   ['女性熱蠟','women-waxing','WOMEN HOT WAXING'],
   ['男士熱蠟','men-waxing','MEN HOT WAXING'],
   ['肌膚管理','skin-care','SKIN CARE'],
   ['美胸保養','bust-care','BUST CARE']
 ];
 const isDesktop=()=>innerWidth>850;
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
   serviceMenu.innerHTML=SERVICE_ITEMS.map(([name,slug,en])=>`<a href="${B}/services/${slug}/" data-catalog-link><span>${name}</span><small>${en}</small></a>`).join('');
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
   if(!target||!cursor||!isDesktop()||target.classList?.contains('book')){hideCursor();return}
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
 const setCursor=(target)=>{
   if(!isDesktop()){hideCursor();return}
   if(!target||target.classList?.contains('book')){hoverTarget=null;hideCursor();return}
   hoverTarget=target;
   moveCursor(target);
 };
 const syncCursor=(instant=false)=>{
   if(!isDesktop()){hideCursor();return}
   const target=hoverTarget&&document.body.contains(hoverTarget)?hoverTarget:current();
   moveCursor(target,instant);
 };
 let serviceCloseTimer=0;
 const positionServiceMenu=()=>{
   if(!serviceLink||!serviceMenu||!isDesktop())return;
   const nr=nav.getBoundingClientRect();
   const r=serviceLink.getBoundingClientRect();
   serviceMenu.style.left=`${r.left-nr.left+r.width/2}px`;
   serviceMenu.style.top=`${r.bottom-nr.top+16}px`;
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
   if(!isDesktop())return;
   clearTimeout(serviceCloseTimer);
   serviceCloseTimer=setTimeout(hideServiceMenu,130);
 };
 const directNavLink=(target)=>{
   const a=target?.closest?.('a[href]');
   return a&&a.parentElement===nav?a:null;
 };
 const activateDesktopLink=(link)=>{
   if(!isDesktop()||!link)return;
   if(link.classList.contains('book')){
     hoverTarget=null;
     hideServiceMenu();
     hideCursor();
     return;
   }
   setCursor(link);
   if(link===serviceLink)showServiceMenu();else hideServiceMenu();
 };
 nav.addEventListener('mouseover',event=>{
   if(!isDesktop())return;
   if(event.target.closest?.('.service-flyout')){
     clearTimeout(serviceCloseTimer);
     if(serviceLink)setCursor(serviceLink);
     return;
   }
   activateDesktopLink(directNavLink(event.target));
 });
 nav.addEventListener('pointermove',event=>{
   if(!isDesktop())return;
   if(event.target.closest?.('.service-flyout')){
     if(serviceLink)setCursor(serviceLink);
     return;
   }
   const link=directNavLink(event.target);
   if(link&&link!==hoverTarget)activateDesktopLink(link);
 });
 if(serviceMenu){
   serviceMenu.addEventListener('mouseenter',()=>{if(!isDesktop())return;clearTimeout(serviceCloseTimer);if(serviceLink)setCursor(serviceLink)});
   serviceMenu.addEventListener('mouseleave',scheduleServiceHide);
   serviceMenu.addEventListener('focusin',()=>{if(!isDesktop())return;clearTimeout(serviceCloseTimer);if(serviceLink)setCursor(serviceLink)});
   serviceMenu.addEventListener('focusout',event=>{if(isDesktop()&&!serviceMenu.contains(event.relatedTarget))scheduleServiceHide()});
   serviceMenu.addEventListener('click',()=>{hideServiceMenu();hoverTarget=null;if(!isDesktop())requestAnimationFrame(()=>close())});
 }
 if(serviceLink){
   serviceLink.addEventListener('mouseleave',scheduleServiceHide);
   serviceLink.addEventListener('click',event=>{
     event.preventDefault();
     event.stopImmediatePropagation();
     if(isDesktop()){
       setCursor(serviceLink);
       showServiceMenu();
       return;
     }
     if(serviceMenu?.classList.contains('on'))hideServiceMenu();else showServiceMenu();
   },true);
 }
 const bindCursorLinks=()=>{
   topLinks().forEach(a=>{
     if(a.dataset.navMotionBound)return;
     a.dataset.navMotionBound='1';
     if(a.classList.contains('book')){
       a.addEventListener('mouseenter',()=>{if(!isDesktop())return;hoverTarget=null;hideServiceMenu();hideCursor()});
       a.addEventListener('focus',()=>{if(!isDesktop())return;hoverTarget=null;hideServiceMenu();hideCursor()});
       a.addEventListener('click',()=>requestAnimationFrame(()=>hideCursor()));
       return;
     }
     if(a===serviceLink){
       a.addEventListener('mouseenter',()=>{if(!isDesktop())return;setCursor(a);showServiceMenu()});
       a.addEventListener('focus',()=>{if(!isDesktop())return;setCursor(a);showServiceMenu()});
     }else{
       a.addEventListener('mouseenter',()=>{if(!isDesktop())return;hideServiceMenu();setCursor(a)});
       a.addEventListener('focus',()=>{if(!isDesktop())return;hideServiceMenu();setCursor(a)});
     }
     a.addEventListener('click',()=>requestAnimationFrame(()=>{hoverTarget=null;syncCursor()}));
   });
 };
 const sync=()=>{
   const open=nav.classList.contains('open');
   hamb.classList.toggle('is-open',open);
   hamb.setAttribute('aria-expanded',String(open));
   hamb.setAttribute('aria-label',open?'關閉選單':'開啟選單');
   backdrop.classList.toggle('on',open);
   document.body.style.overflow=open&&!isDesktop()?'hidden':'';
   bindCursorLinks();
   if(serviceMenu?.classList.contains('on'))positionServiceMenu();
   requestAnimationFrame(()=>syncCursor());
 };
 const close=()=>{nav.classList.remove('open');hideServiceMenu();hoverTarget=null;sync()};
 hamb.setAttribute('aria-controls','static-primary-navigation');
 nav.id='static-primary-navigation';
 hamb.addEventListener('click',event=>{
   if(isDesktop())return;
   event.preventDefault();
   event.stopPropagation();
   const opening=!nav.classList.contains('open');
   nav.classList.toggle('open',opening);
   if(!opening)hideServiceMenu();
   sync();
 });
 nav.addEventListener('click',event=>{
   if(isDesktop())return;
   const link=event.target.closest?.('a[href]');
   if(!link||!nav.contains(link)||link===serviceLink)return;
   requestAnimationFrame(close);
 });
 nav.addEventListener('mouseleave',()=>{if(!isDesktop())return;hoverTarget=null;scheduleServiceHide();syncCursor()});
 nav.addEventListener('focusout',e=>{if(isDesktop()&&!nav.contains(e.relatedTarget)){hoverTarget=null;scheduleServiceHide();syncCursor()}});
 backdrop.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideServiceMenu();close()}});
 addEventListener('resize',()=>{hideServiceMenu();hoverTarget=null;if(isDesktop())close();else sync();requestAnimationFrame(()=>syncCursor(true))});
 new MutationObserver(()=>{bindCursorLinks();if(serviceMenu?.classList.contains('on'))positionServiceMenu();requestAnimationFrame(()=>syncCursor())}).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 bindCursorLinks();
 sync();
 requestAnimationFrame(()=>syncCursor(true));
})();
