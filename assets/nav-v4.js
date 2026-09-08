(()=>{
 const header=document.querySelector('.header');
 const nav=header?.querySelector('nav');
 const hamb=header?.querySelector('.hamb');
 if(!header||!nav||!hamb)return;
 let backdrop=document.querySelector('.static-nav-backdrop');
 if(!backdrop){backdrop=document.createElement('button');backdrop.className='static-nav-backdrop';backdrop.setAttribute('aria-label','關閉選單');header.after(backdrop)}
 let cursor=nav.querySelector('.nav-cursor');
 if(!cursor){cursor=document.createElement('span');cursor.className='nav-cursor';cursor.setAttribute('aria-hidden','true');nav.prepend(cursor)}
 const topLinks=()=>[...nav.children].filter(el=>el.matches?.('a'));
 const current=()=>topLinks().find(a=>a.classList.contains('on'))||null;
 const moveCursor=(target,instant=false)=>{
   if(!target||!cursor){if(cursor)cursor.style.opacity='0';return}
   const nr=nav.getBoundingClientRect();
   const r=target.getBoundingClientRect();
   if(!r.width||!r.height){cursor.style.opacity='0';return}
   if(instant)cursor.style.transition='none';
   cursor.style.width=`${r.width}px`;
   cursor.style.height=`${r.height}px`;
   cursor.style.transform=`translate3d(${r.left-nr.left}px,${r.top-nr.top}px,0)`;
   cursor.style.opacity='1';
   if(instant)requestAnimationFrame(()=>cursor.style.removeProperty('transition'));
 };
 const syncCursor=(instant=false)=>{
   const open=nav.classList.contains('open');
   if(innerWidth<=850&&!open){cursor.style.opacity='0';return}
   moveCursor(current(),instant);
 };
 const bindCursorLinks=()=>{
   topLinks().forEach(a=>{
     if(a.dataset.navMotionBound)return;
     a.dataset.navMotionBound='1';
     a.addEventListener('mouseenter',()=>moveCursor(a));
     a.addEventListener('focus',()=>moveCursor(a));
     a.addEventListener('click',()=>requestAnimationFrame(()=>syncCursor()));
   });
 };
 const sync=()=>{const open=nav.classList.contains('open');hamb.classList.toggle('is-open',open);hamb.setAttribute('aria-expanded',String(open));hamb.setAttribute('aria-label',open?'關閉選單':'開啟選單');backdrop.classList.toggle('on',open);document.body.style.overflow=open&&innerWidth<=850?'hidden':'';bindCursorLinks();requestAnimationFrame(()=>syncCursor())};
 const close=()=>{nav.classList.remove('open');sync()};
 hamb.setAttribute('aria-controls','static-primary-navigation');
 nav.id='static-primary-navigation';
 hamb.addEventListener('click',()=>requestAnimationFrame(sync));
 nav.addEventListener('mouseleave',()=>moveCursor(current()));
 nav.addEventListener('focusout',e=>{if(!nav.contains(e.relatedTarget))moveCursor(current())});
 backdrop.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 addEventListener('resize',()=>{if(innerWidth>850)close();else sync();requestAnimationFrame(()=>syncCursor(true))});
 new MutationObserver(()=>{bindCursorLinks();requestAnimationFrame(()=>syncCursor())}).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 bindCursorLinks();
 sync();
 requestAnimationFrame(()=>syncCursor(true));
})();
