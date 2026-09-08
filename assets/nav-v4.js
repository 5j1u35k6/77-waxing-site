(()=>{
 const header=document.querySelector('.header');
 const nav=header?.querySelector('nav');
 const hamb=header?.querySelector('.hamb');
 if(!header||!nav||!hamb)return;
 let backdrop=document.querySelector('.static-nav-backdrop');
 if(!backdrop){backdrop=document.createElement('button');backdrop.className='static-nav-backdrop';backdrop.setAttribute('aria-label','關閉選單');header.after(backdrop)}
 const sync=()=>{const open=nav.classList.contains('open');hamb.classList.toggle('is-open',open);hamb.setAttribute('aria-expanded',String(open));hamb.setAttribute('aria-label',open?'關閉選單':'開啟選單');backdrop.classList.toggle('on',open);document.body.style.overflow=open&&innerWidth<=850?'hidden':''};
 const close=()=>{nav.classList.remove('open');sync()};
 hamb.setAttribute('aria-controls','static-primary-navigation');
 nav.id='static-primary-navigation';
 hamb.addEventListener('click',()=>requestAnimationFrame(sync));
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>requestAnimationFrame(close)));
 backdrop.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 addEventListener('resize',()=>{if(innerWidth>850)close();else sync()});
 sync();
})();
