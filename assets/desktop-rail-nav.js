(()=>{
  const header=document.querySelector('.header');
  const nav=header?.querySelector('nav');
  if(!header||!nav||document.querySelector('.desktop-side-nav'))return;

  const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
  const cleanPath=(value)=>{
    let path='';
    try{path=new URL(value,location.href).pathname}catch{path=String(value||'')}
    if(B&&path.startsWith(B))path=path.slice(B.length)||'/';
    return path.replace(/\/+$/,'')||'/';
  };

  const items=[
    ['關於','/about/','about'],
    ['服務','/services/','services'],
    ['價目','/menu/','menu'],
    ['空間','/space/','space'],
    ['教學','/courses/','courses'],
  ];
  const railPaths=new Map(items.map(([,href,key])=>[cleanPath(href),key]));

  [...nav.children].forEach((node)=>{
    if(!node.matches?.('a[href]'))return;
    const path=cleanPath(node.getAttribute('href')||node.href);
    if(path==='/')node.dataset.desktopHome='1';
    const key=railPaths.get(path);
    if(key)node.dataset.desktopRailSource=key;
  });

  const rail=document.createElement('aside');
  rail.className='desktop-side-nav';
  rail.setAttribute('aria-label','主要導覽');
  rail.innerHTML=`<nav class="desktop-side-nav__inner">${items.map(([label,href,key])=>`<a href="${B}${href}" data-link data-rail-key="${key}"><span>${label}</span></a>`).join('')}</nav>`;
  document.body.appendChild(rail);
  document.documentElement.classList.add('has-desktop-side-nav');

  if(!document.querySelector('style[data-desktop-rail-nav="1"]')){
    const style=document.createElement('style');
    style.dataset.desktopRailNav='1';
    style.textContent=`
@media (min-width:851px){
  html.has-desktop-side-nav body{padding-right:88px}
  .desktop-side-nav{position:fixed;inset:0 0 0 auto;z-index:60;width:88px;border-left:1px solid rgba(58,56,54,.10);background:rgba(249,246,240,.93);-webkit-backdrop-filter:blur(18px) saturate(.9);backdrop-filter:blur(18px) saturate(.9);box-shadow:-10px 0 30px rgba(58,56,54,.035)}
  .desktop-side-nav__inner{height:100%;display:flex;flex-direction:column;justify-content:center;gap:7px;padding:92px 8px 28px}
  .desktop-side-nav a{position:relative;display:flex;align-items:center;justify-content:center;min-height:54px;padding:10px 7px;border-radius:14px;color:#5d5853;font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;font-size:15px;font-weight:400;letter-spacing:.08em;line-height:1;white-space:nowrap;transition:background .18s ease,color .18s ease,transform .18s ease}
  .desktop-side-nav a::before{content:"";position:absolute;left:-9px;top:50%;width:3px;height:22px;border-radius:99px;background:#C5A070;opacity:0;transform:translateY(-50%) scaleY(.45);transition:opacity .18s ease,transform .22s ease}
  .desktop-side-nav a:hover,.desktop-side-nav a:focus-visible{background:rgba(197,160,112,.10);color:#3a3836;outline:none;transform:translateX(-1px)}
  .desktop-side-nav a.is-active{background:rgba(197,160,112,.12);color:#765d43;font-weight:600}
  .desktop-side-nav a.is-active::before{opacity:1;transform:translateY(-50%) scaleY(1)}

  .header nav{gap:10px!important}
  .header nav>[data-desktop-home="1"],.header nav>[data-desktop-rail-source]{display:none!important}
  .header nav>.service-flyout,.header nav>.about-flyout,.header nav>.nav-cursor{display:none!important}
  .header nav>.product-order{order:1!important;min-width:0!important;padding:10px 14px!important;background:transparent!important;border:1px solid rgba(139,115,85,.28)!important;box-shadow:none!important;color:#4b4641!important}
  .header nav>.product-order:hover{background:rgba(197,160,112,.10)!important;box-shadow:none!important;transform:none!important}
  .header nav>.product-order .nav-zh{color:#4b4641!important}
  .header nav>.book{order:2!important;min-width:0!important;padding:11px 17px!important;border-radius:13px!important}
  .header nav>.member-nav-link{order:3!important;min-width:48px!important;padding:10px 9px!important}
  .header nav>.product-order .nav-en,.header nav>.book .nav-en,.header nav>.member-nav-link .nav-en{display:none!important}
  .header nav>.product-order .nav-zh,.header nav>.book .nav-zh{font-size:15px!important;letter-spacing:.055em!important}
  .header nav>.member-nav-link .nav-zh{font-size:0!important;letter-spacing:0!important}
  .header nav>.member-nav-link .nav-zh::after{content:"會員";font-size:14px;font-weight:500;letter-spacing:.06em;color:#4b4641}
}
@media (max-width:850px){
  .desktop-side-nav{display:none!important}
  .header nav>[data-desktop-home="1"]{display:none!important}
}
@media(prefers-reduced-motion:reduce){.desktop-side-nav a,.desktop-side-nav a::before{transition:none!important}}
`;
    document.head.appendChild(style);
  }

  const syncActive=()=>{
    const current=cleanPath(location.pathname);
    rail.querySelectorAll('[data-rail-key]').forEach((link)=>{
      const target=cleanPath(link.getAttribute('href'));
      const active=current===target||current.startsWith(`${target}/`);
      link.classList.toggle('is-active',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
  };

  syncActive();
  addEventListener('popstate',syncActive);
  const originalPush=history.pushState.bind(history);
  const originalReplace=history.replaceState.bind(history);
  history.pushState=(...args)=>{const result=originalPush(...args);queueMicrotask(syncActive);return result};
  history.replaceState=(...args)=>{const result=originalReplace(...args);queueMicrotask(syncActive);return result};
  rail.addEventListener('click',()=>setTimeout(syncActive,0));
})();
