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
  const parentKeys=new Set(['about','services']);
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
  rail.innerHTML=`<nav class="desktop-side-nav__inner">${items.map(([label,href,key])=>parentKeys.has(key)
    ? `<button type="button" data-rail-key="${key}" data-rail-target="${B}${href}" aria-haspopup="true" aria-expanded="false"><span>${label}</span></button>`
    : `<a href="${B}${href}" data-link data-rail-key="${key}" data-rail-target="${B}${href}"><span>${label}</span></a>`).join('')}</nav>`;
  document.body.appendChild(rail);

  const submenu=document.createElement('div');
  submenu.className='desktop-side-submenu';
  submenu.setAttribute('aria-hidden','true');
  document.body.appendChild(submenu);

  document.documentElement.classList.add('has-desktop-side-nav');

  if(!document.querySelector('style[data-desktop-rail-nav="1"]')){
    const style=document.createElement('style');
    style.dataset.desktopRailNav='1';
    style.textContent=`
@media (min-width:851px){
  html.has-desktop-side-nav body{padding-right:88px}
  .desktop-side-nav{position:fixed;inset:0 0 0 auto;z-index:60;width:88px;border-left:1px solid rgba(58,56,54,.10);background:rgba(249,246,240,.93);-webkit-backdrop-filter:blur(18px) saturate(.9);backdrop-filter:blur(18px) saturate(.9);box-shadow:-10px 0 30px rgba(58,56,54,.035)}
  .desktop-side-nav__inner{height:100%;display:flex;flex-direction:column;justify-content:center;gap:7px;padding:92px 8px 28px}
  .desktop-side-nav a,.desktop-side-nav button{position:relative;display:flex;align-items:center;justify-content:center;width:100%;min-height:54px;padding:10px 7px;border:0;border-radius:14px;background:transparent;color:#5d5853;font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;font-size:15px;font-weight:400;letter-spacing:.08em;line-height:1;white-space:nowrap;cursor:pointer;transition:background .18s ease,color .18s ease,transform .18s ease}
  .desktop-side-nav a::before,.desktop-side-nav button::before{content:"";position:absolute;left:-9px;top:50%;width:3px;height:22px;border-radius:99px;background:#C5A070;opacity:0;transform:translateY(-50%) scaleY(.45);transition:opacity .18s ease,transform .22s ease}
  .desktop-side-nav button::after{content:"";width:6px;height:6px;margin-left:6px;border-right:1px solid currentColor;border-top:1px solid currentColor;transform:rotate(-135deg);opacity:.42;transition:transform .18s ease,opacity .18s ease}
  .desktop-side-nav button[aria-expanded="true"]::after{transform:rotate(45deg);opacity:.72}
  .desktop-side-nav a:hover,.desktop-side-nav a:focus-visible,.desktop-side-nav button:hover,.desktop-side-nav button:focus-visible{background:rgba(197,160,112,.10);color:#3a3836;outline:none;transform:translateX(-1px)}
  .desktop-side-nav a.is-active,.desktop-side-nav button.is-active{background:rgba(197,160,112,.12);color:#765d43;font-weight:600}
  .desktop-side-nav a.is-active::before,.desktop-side-nav button.is-active::before{opacity:1;transform:translateY(-50%) scaleY(1)}

  .desktop-side-submenu{position:fixed;right:98px;z-index:61;width:230px;padding:8px;border:1px solid rgba(58,56,54,.08);border-radius:17px;background:rgba(255,253,249,.98);box-shadow:0 16px 42px rgba(58,56,54,.14);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);opacity:0;visibility:hidden;pointer-events:none;transform:translate(8px,-50%);transition:opacity .18s ease,transform .22s cubic-bezier(.22,.8,.22,1),visibility 0s linear .22s}
  .desktop-side-submenu::after{content:"";position:absolute;top:0;right:-12px;width:12px;height:100%}
  .desktop-side-submenu.is-open{opacity:1;visibility:visible;pointer-events:auto;transform:translate(0,-50%);transition-delay:0s}
  .desktop-side-submenu a{display:grid;align-content:center;gap:6px;min-height:58px;padding:12px 14px;border-radius:12px;color:#3a3836;text-align:left;line-height:1.16;transition:background .16s ease,color .16s ease}
  .desktop-side-submenu a:hover,.desktop-side-submenu a:focus-visible{background:#e8deca;color:#765d43;outline:none}
  .desktop-side-submenu a span,.desktop-side-submenu a strong{font-size:15.5px;font-weight:600;letter-spacing:.025em}
  .desktop-side-submenu a small{font:600 8.5px/1 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#9b9b88;white-space:nowrap}

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
  .desktop-side-nav,.desktop-side-submenu{display:none!important}
  .header nav>[data-desktop-home="1"]{display:none!important}
}
@media(prefers-reduced-motion:reduce){.desktop-side-nav a,.desktop-side-nav button,.desktop-side-nav a::before,.desktop-side-nav button::before,.desktop-side-submenu{transition:none!important}}
`;
    document.head.appendChild(style);
  }

  const fallback={
    about:[
      ['理念',`${B}/about/#philosophy`,'PHILOSOPHY'],
      ['首訪的你',`${B}/about/#first-visit`,'FIRST VISIT'],
      ['小白小白',`${B}/about/#xiaobai`,'XIAOBAI XIAOBAI'],
    ],
    services:[
      ['女性熱蠟',`${B}/services/women-waxing/`,'WOMEN HOT WAXING'],
      ['男士熱蠟',`${B}/services/men-waxing/`,'MEN HOT WAXING'],
      ['肌膚管理',`${B}/services/skin-care/`,'SKIN CARE'],
      ['美胸保養',`${B}/services/bust-care/`,'BUST CARE'],
    ],
  };

  const sourceMenu=(key)=>key==='about'?nav.querySelector('.about-flyout'):nav.querySelector('.service-flyout');
  const buildSubmenu=(key)=>{
    submenu.replaceChildren();
    const sourceLinks=[...(sourceMenu(key)?.querySelectorAll('a[href]')||[])];
    if(sourceLinks.length){
      sourceLinks.forEach((source)=>{
        const link=source.cloneNode(true);
        link.removeAttribute('id');
        link.removeAttribute('style');
        link.removeAttribute('aria-current');
        link.dataset.railChild='1';
        submenu.appendChild(link);
      });
    }else{
      (fallback[key]||[]).forEach(([label,href,en])=>{
        const link=document.createElement('a');
        link.href=href;
        link.dataset.railChild='1';
        link.innerHTML=`<span>${label}</span><small>${en}</small>`;
        submenu.appendChild(link);
      });
    }
    submenu.setAttribute('aria-label',key==='about'?'關於子選單':'服務子選單');
  };

  let openKey='';
  let closeTimer=0;
  const parentButton=(key)=>rail.querySelector(`button[data-rail-key="${key}"]`);
  const hideSubmenu=()=>{
    clearTimeout(closeTimer);
    openKey='';
    submenu.classList.remove('is-open');
    submenu.setAttribute('aria-hidden','true');
    rail.querySelectorAll('button[data-rail-key]').forEach((button)=>button.setAttribute('aria-expanded','false'));
  };
  const positionSubmenu=(trigger)=>{
    if(!trigger||innerWidth<=850)return;
    const rect=trigger.getBoundingClientRect();
    const center=rect.top+rect.height/2;
    submenu.style.top=`${Math.max(110,Math.min(innerHeight-110,center))}px`;
  };
  const showSubmenu=(key,trigger=parentButton(key))=>{
    if(innerWidth<=850||!parentKeys.has(key)||!trigger)return;
    clearTimeout(closeTimer);
    buildSubmenu(key);
    openKey=key;
    rail.querySelectorAll('button[data-rail-key]').forEach((button)=>button.setAttribute('aria-expanded',String(button===trigger)));
    positionSubmenu(trigger);
    submenu.classList.add('is-open');
    submenu.setAttribute('aria-hidden','false');
  };
  const scheduleHide=()=>{
    if(innerWidth<=850)return;
    clearTimeout(closeTimer);
    closeTimer=setTimeout(hideSubmenu,170);
  };

  rail.querySelectorAll('button[data-rail-key]').forEach((button)=>{
    const key=button.dataset.railKey;
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      if(openKey===key&&submenu.classList.contains('is-open'))hideSubmenu();else showSubmenu(key,button);
    });
    button.addEventListener('mouseenter',()=>showSubmenu(key,button));
    button.addEventListener('mouseleave',scheduleHide);
    button.addEventListener('focus',()=>showSubmenu(key,button));
  });
  rail.querySelectorAll('a[data-rail-key]').forEach((link)=>{
    link.addEventListener('mouseenter',hideSubmenu);
    link.addEventListener('focus',hideSubmenu);
    link.addEventListener('click',hideSubmenu);
  });
  submenu.addEventListener('mouseenter',()=>clearTimeout(closeTimer));
  submenu.addEventListener('mouseleave',scheduleHide);
  submenu.addEventListener('focusin',()=>clearTimeout(closeTimer));
  submenu.addEventListener('focusout',(event)=>{if(!submenu.contains(event.relatedTarget))scheduleHide()});
  submenu.addEventListener('click',()=>setTimeout(hideSubmenu,0));
  document.addEventListener('click',(event)=>{
    if(!rail.contains(event.target)&&!submenu.contains(event.target))hideSubmenu();
  });
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape')hideSubmenu()});

  const syncActive=()=>{
    const current=cleanPath(location.pathname);
    rail.querySelectorAll('[data-rail-key]').forEach((item)=>{
      const target=cleanPath(item.dataset.railTarget||item.getAttribute('href')||'/');
      const active=current===target||current.startsWith(`${target}/`);
      item.classList.toggle('is-active',active);
      if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    });
  };

  syncActive();
  addEventListener('popstate',()=>{hideSubmenu();syncActive()});
  addEventListener('resize',()=>{
    if(innerWidth<=850)hideSubmenu();
    else if(openKey)positionSubmenu(parentButton(openKey));
  });
  const originalPush=history.pushState.bind(history);
  const originalReplace=history.replaceState.bind(history);
  history.pushState=(...args)=>{const result=originalPush(...args);queueMicrotask(syncActive);return result};
  history.replaceState=(...args)=>{const result=originalReplace(...args);queueMicrotask(syncActive);return result};
})();
