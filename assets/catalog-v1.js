(()=>{
  const B='/77-waxing-site';
  const SERVICE_BASE=`${B}/services/`;

  const services=[
    {
      key:'women',slug:'women-waxing',name:'女性熱蠟',en:'WOMEN HOT WAXING',
      intro:'依照不同部位選擇熱蠟除毛服務。服務頁只整理項目與範圍，價格統一放在價目頁。',
      groups:[
        {title:'熱蠟除毛項目',desc:'依你提供的女性熱蠟價目表整理。',items:[
          ['全腿 / 半腿','Full leg / Half leg'],['全手 / 半手','Full arm / Half arm'],['全背 / 半背','Full back / Half back'],['私密處全除','Hollywood'],['小鬍子 / 小腹線','Upper lip / Lower abdomen'],['腋下','Under arm']
        ]},
        {title:'加購保養',desc:'可搭配主服務加購。',items:[
          ['小鬍子 / 小腹線 / 腋下','加購除毛項目'],['腋下美白軟膜','Underarm whitening mask'],['私密處美白軟膜','Private area whitening mask']
        ]}
      ]
    },
    {
      key:'men',slug:'men-waxing',name:'男士熱蠟',en:'MEN HOT WAXING',
      intro:'男士熱蠟依不同部位安排服務，私密處與細部項目會依實際範圍確認。',
      groups:[
        {title:'熱蠟除毛項目',desc:'依你提供的男士熱蠟價目表整理。',items:[
          ['全腿 / 半腿','Full leg / Half leg'],['全手 / 半手','Full arm / Half arm'],['全背 / 半背','Full back / Half back'],['私密處全除','Hollywood'],['小腹線 / 鬍子','Lower abdomen / Beard，鬍子依視範圍確認'],['腋下','Under arm']
        ]},
        {title:'加購保養',desc:'可搭配主服務加購。',items:[
          ['小鬍子 / 小腹線 / 腋下','加購除毛項目'],['腋下美白軟膜','Underarm whitening mask'],['私密處美白軟膜','Private area whitening mask']
        ]}
      ]
    },
    {
      key:'skin',slug:'skin-care',name:'肌膚管理',en:'SKIN CARE',
      intro:'包含臉部清潔、修復、煥膚、撥筋與身體肌膚保養等項目。價格不在服務頁顯示。',
      groups:[
        {title:'臉部項目',desc:'依臉部價目表的服務名稱整理。',items:[
          ['修修臉粉刺毛孔大掃除','臉部清潔與粉刺毛孔管理'],['針管式客制化安瓶','依膚況安排客製化安瓶'],['CICA 深層修復','臉部修復管理'],['裸肌水光駐顏','水光駐顏管理'],['肌活再生外泌課程','肌活再生課程'],['濃縮原液客制化','依膚況安排濃縮原液'],['黑溜溜矽晶煥膚','矽晶煥膚管理']
        ]},
        {title:'臉部撥筋系列',desc:'你提供的價目表中包含兩種臉部撥筋流程。',items:[
          ['全方位臉部撥筋','臉部清潔、舒活嫩膚、臉部與肩頸放鬆、臉部肩頸撥筋、保濕、頭皮放鬆與肌膚喚醒','60–70 分鐘'],
          ['臉部撥筋 + 基礎手工清粉刺','臉部清潔、舒活嫩膚、放鬆與撥筋、肌膚處理、保濕、光譜儀、頭皮放鬆、頭刮與肌膚喚醒','120–150 分鐘']
        ]},
        {title:'身體項目',desc:'肌膚管理中的身體保養項目。',items:[
          ['果酸 / 矽晶美背護理','背部肌膚管理'],['水潤 / 肌泌緊緻肩頸胸','肩頸胸肌膚保養'],['果酸 / 矽晶粉嫩屁屁','臀部肌膚管理']
        ]},
        {title:'加購項目',desc:'可依主要服務需求加購。',items:[
          ['頸部緊緻保養','頸部加強保養'],['臉部拋光','臉部除毛項目'],['頭刮肩頸加強','肩頸加強','15 分鐘'],['耳穴放鬆','耳穴放鬆','30–40 分鐘'],['臉部熱蠟','依實際範圍確認']
        ]}
      ]
    },
    {
      key:'bust',slug:'bust-care',name:'美胸保養',en:'BUST CARE',
      intro:'美胸保養分為三種流程，依需要的時間與涵蓋部位選擇。服務頁不顯示價格。',
      groups:[
        {title:'美胸保養項目',desc:'依你提供的美胸價目表整理。',items:[
          ['基礎美胸','胸部、頭肩頸、手部','60 分鐘'],['舒緩美胸','胸部、頭肩頸、手部、頭刮','75 分鐘'],['全方位美胸','胸部、頭肩頸、手部、暖宮、頭刮','90 分鐘']
        ]}
      ]
    }
  ];

  const priceSections=[
    {
      key:'women',name:'女性熱蠟',en:'WOMEN HOT WAXING',groups:[
        {title:'熱蠟除毛',rows:[
          ['全腿 / 半腿','$1599 / 899'],['全手 / 半手','$1399 / 799'],['全背 / 半背','$1299 / 699'],['私密處全除','$1399'],['小鬍子 / 小腹線','$399'],['腋下','$399']
        ]},
        {title:'加購項目 ADD ON',rows:[
          ['小鬍子 / 小腹線 / 腋下','$199'],['腋下美白軟膜','$199'],['私密處美白軟膜','$199']
        ]}
      ]
    },
    {
      key:'men',name:'男士熱蠟',en:'MEN HOT WAXING',groups:[
        {title:'熱蠟除毛',rows:[
          ['全腿 / 半腿','$1899 / 1099'],['全手 / 半手','$1599 / 899'],['全背 / 半背','$1599 / 899'],['私密處全除','$2299'],['小腹線 / 鬍子','$499 / 視範圍'],['腋下','$499']
        ]},
        {title:'加購項目 ADD ON',rows:[
          ['小鬍子 / 小腹線 / 腋下','$350'],['腋下美白軟膜','$299'],['私密處美白軟膜','$299']
        ]}
      ]
    },
    {
      key:'skin',name:'肌膚管理',en:'FACIAL & BODY CARE',groups:[
        {title:'臉部項目',rows:[
          ['修修臉粉刺毛孔大掃除','$1399'],['針管式客制化安瓶','$1599'],['CICA 深層修復','$1899'],['裸肌水光駐顏','$1899','痘肌／敏感肌不適用'],['肌活再生外泌課程','$1999'],['濃縮原液客制化','$1999'],['黑溜溜矽晶煥膚','$2199']
        ]},
        {title:'臉部撥筋',rows:[
          ['全方位臉部撥筋','$1399','60–70 分鐘'],['臉部撥筋 + 基礎手工清粉刺','$2499','120–150 分鐘']
        ]},
        {title:'身體項目',rows:[
          ['果酸 / 矽晶美背護理','$1699 / 2999'],['水潤 / 肌泌緊緻肩頸胸','$699 / 1099'],['果酸 / 矽晶粉嫩屁屁','$1499 / 2199']
        ]},
        {title:'加購項目',rows:[
          ['頸部緊緻保養','$699'],['臉部拋光','$499','臉部除毛；痘肌／敏感肌不適用'],['頭刮肩頸加強','$399','15 分鐘'],['耳穴放鬆','$599','30–40 分鐘'],['臉部熱蠟','視範圍']
        ]}
      ],notes:['臉部療程皆包含 5–10 分鐘肩部放鬆、手工清粉刺。','客製化安瓶以上課程皆含水飛梭；中階課程含 MTS；高階課程含 MTS、RF 緊緻。','操作時間依參考，實際以肌膚狀況為主。']
    },
    {
      key:'bust',name:'美胸保養',en:'BUST CARE',groups:[
        {title:'美胸項目',rows:[
          ['基礎美胸','$1299','60 分鐘｜胸部、頭肩頸、手部'],['舒緩美胸','$1499','75 分鐘｜胸部、頭肩頸、手部、頭刮'],['全方位美胸','$1699','90 分鐘｜胸部、頭肩頸、手部、暖宮、頭刮']
        ]}
      ]
    }
  ];

  const app=()=>document.querySelector('#app');
  const normalizedPath=()=>{
    let p=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
    if(!p.startsWith('/'))p='/'+p;
    if(p!=='/'&&!p.endsWith('/'))p+='/';
    return p;
  };
  const servicePath=(s)=>`${SERVICE_BASE}${s.slug}/`;
  const serviceByPath=()=>services.find((s)=>normalizedPath()===`/services/${s.slug}/`);

  const switcher=(activeKey)=>`<nav class="service-switcher" aria-label="其他服務項目">${services.map((s)=>`<a href="${servicePath(s)}" data-catalog-link class="${s.key===activeKey?'on':''}">${s.name}</a>`).join('')}</nav>`;

  function renderService(service){
    const root=app();
    if(!root)return;
    root.dataset.catalogPath=normalizedPath();
    root.innerHTML=`<div class="catalog-page" data-catalog-page="service"><section class="catalog-hero"><div class="wrap"><span class="tag">${service.en}</span><h1>${service.name}</h1><p class="lead muted">${service.intro}</p>${switcher(service.key)}</div></section><section class="service-detail-section"><div class="wrap">${service.groups.map((g)=>`<div class="service-group"><div class="service-group-head"><div><span class="tag">SERVICE</span><h2>${g.title}</h2></div><p class="muted">${g.desc||''}</p></div><div class="service-item-grid">${g.items.map((item)=>`<article class="service-item-card"><h3>${item[0]}</h3>${item[1]?`<p>${item[1]}</p>`:''}${item[2]?`<span class="duration">${item[2]}</span>`:''}</article>`).join('')}</div></div>`).join('')}<div class="catalog-actions"><a class="btn dark" href="${B}/booking/">立即預約</a><a class="btn" href="${B}/menu/" data-catalog-link>查看價目</a></div></div></section></div>`;
    markHeader();
    window.scrollTo({top:0,behavior:'auto'});
  }

  function renderPrice(){
    const root=app();
    if(!root)return;
    root.dataset.catalogPath=normalizedPath();
    root.innerHTML=`<div class="price-page" data-catalog-page="price"><section class="pagehero price-hero"><div class="wrap narrow"><span class="tag">MENU</span><h1>價目表</h1><p class="lead muted">依服務項目依序整理。可用上方分類按鈕快速移動到指定區塊。</p></div></section><div class="price-jump-shell"><nav class="price-jump" aria-label="價目分類">${priceSections.map((s,i)=>`<button type="button" data-price-jump="price-${s.key}" class="${i===0?'on':''}">${s.name}</button>`).join('')}</nav></div><section class="price-sections"><div class="wrap narrow">${priceSections.map((s)=>`<section id="price-${s.key}" class="price-section ${s.key}" data-price-section="${s.key}"><div class="price-section-title"><h2>${s.name}</h2><small>${s.en}</small></div>${s.groups.map((g)=>`<div class="price-group"><h3>${g.title}</h3><div class="price-list">${g.rows.map((r)=>`<div class="price-row"><b>${r[0]}</b><span class="price">${r[1]}</span>${r[2]?`<p>${r[2]}</p>`:''}</div>`).join('')}</div></div>`).join('')}${s.notes?`<div class="price-note">${s.notes.map((n)=>`<div>｜${n}</div>`).join('')}</div>`:''}</section>`).join('')}</div></section></div>`;
    bindPriceJump();
    markHeader();
    if(location.hash&&document.querySelector(location.hash))setTimeout(()=>document.querySelector(location.hash)?.scrollIntoView({behavior:'smooth',block:'start'}),0);else window.scrollTo({top:0,behavior:'auto'});
  }

  function bindPriceJump(){
    document.querySelectorAll('[data-price-jump]').forEach((button)=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.priceJump;
        const target=document.getElementById(id);
        if(!target)return;
        document.querySelectorAll('[data-price-jump]').forEach((b)=>b.classList.toggle('on',b===button));
        history.replaceState(null,'',`${location.pathname}#${id}`);
        target.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
    const sections=[...document.querySelectorAll('[data-price-section]')];
    if(!('IntersectionObserver'in window)||!sections.length)return;
    const observer=new IntersectionObserver((entries)=>{
      const visible=entries.filter((e)=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      const id=visible.target.id;
      document.querySelectorAll('[data-price-jump]').forEach((b)=>b.classList.toggle('on',b.dataset.priceJump===id));
    },{rootMargin:'-150px 0px -55% 0px',threshold:[0,.2,.5]});
    sections.forEach((s)=>observer.observe(s));
  }

  function markHeader(){
    const nav=document.querySelector('.header nav');
    if(!nav)return;
    nav.querySelectorAll(':scope > a').forEach((a)=>a.classList.remove('on'));
    const path=normalizedPath();
    if(path.startsWith('/services/')){
      const trigger=[...nav.querySelectorAll('a')].find((a)=>a.querySelector('.nav-zh')?.textContent.trim()==='服務');
      trigger?.classList.add('on');
    }else if(path==='/menu/'){
      const menu=[...nav.querySelectorAll('a')].find((a)=>a.querySelector('.nav-zh')?.textContent.trim()==='價目');
      menu?.classList.add('on');
    }
  }

  function enhanceHomeServiceLinks(){
    const root=app();
    if(!root)return;
    root.querySelectorAll('a[href$="/services/"]').forEach((a)=>{
      if(a.closest('.header'))return;
      const title=a.closest('.card')?.querySelector('h3')?.textContent.trim();
      const service=services.find((s)=>s.name===title) || services[0];
      a.setAttribute('href',servicePath(service));
      a.dataset.catalogLink='1';
    });
  }

  function ensureServiceDropdown(){
    const nav=document.querySelector('.header nav');
    if(!nav)return;
    const trigger=[...nav.querySelectorAll('a')].find((a)=>a.querySelector('.nav-zh')?.textContent.trim()==='服務');
    if(!trigger)return;
    trigger.classList.add('service-nav-trigger');
    trigger.setAttribute('aria-haspopup','true');
    trigger.setAttribute('aria-expanded','false');

    let dropdown=nav.querySelector('.service-dropdown');
    if(!dropdown){
      dropdown=document.createElement('div');
      dropdown.className='service-dropdown';
      dropdown.innerHTML=services.map((s)=>`<a href="${servicePath(s)}" data-catalog-link><strong>${s.name}</strong><small>${s.en}</small></a>`).join('');
      nav.appendChild(dropdown);
    }

    const position=()=>{
      if(innerWidth<=850){dropdown.style.left='';dropdown.style.top='';return;}
      dropdown.style.left=`${trigger.offsetLeft}px`;
      dropdown.style.top=`${trigger.offsetTop+trigger.offsetHeight+7}px`;
    };
    const close=()=>{dropdown.classList.remove('open');trigger.setAttribute('aria-expanded','false')};
    const toggle=(event)=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      position();
      const open=dropdown.classList.toggle('open');
      trigger.setAttribute('aria-expanded',String(open));
    };
    if(trigger.dataset.catalogMenuBound!=='1'){
      trigger.dataset.catalogMenuBound='1';
      trigger.addEventListener('click',toggle,true);
      addEventListener('resize',position);
      document.addEventListener('click',(event)=>{if(!dropdown.contains(event.target)&&event.target!==trigger)close()});
      document.addEventListener('keydown',(event)=>{if(event.key==='Escape')close()});
    }
    position();
    dropdown.querySelectorAll('a').forEach((a)=>{
      const svc=services.find((s)=>a.getAttribute('href')===servicePath(s));
      a.classList.toggle('on',svc?.key===serviceByPath()?.key);
    });
  }

  function closeMobileNav(){
    const nav=document.querySelector('.header nav');
    const hamb=document.querySelector('.header .hamb');
    nav?.classList.remove('open');
    hamb?.classList.remove('is-open');
    hamb?.setAttribute('aria-expanded','false');
    if(hamb)hamb.setAttribute('aria-label','開啟選單');
    document.querySelector('.static-nav-backdrop')?.classList.remove('on');
    document.body.style.overflow='';
    nav?.querySelector('.service-dropdown')?.classList.remove('open');
  }

  function applyRoute(){
    ensureServiceDropdown();
    enhanceHomeServiceLinks();
    const path=normalizedPath();
    const root=app();
    if(!root)return;

    if(path==='/services/'){
      history.replaceState(null,'',servicePath(services[0]));
      renderService(services[0]);
      return;
    }
    const service=serviceByPath();
    if(service){
      if(root.querySelector('[data-catalog-page="service"]')&&root.dataset.catalogPath===path){markHeader();return;}
      renderService(service);
      return;
    }
    if(path==='/menu/'){
      if(root.querySelector('[data-catalog-page="price"]')&&root.dataset.catalogPath===path){markHeader();return;}
      renderPrice();
      return;
    }
    root.dataset.catalogPath='';
  }

  document.addEventListener('click',(event)=>{
    const link=event.target.closest?.('a[data-catalog-link]');
    if(!link)return;
    let url;
    try{url=new URL(link.href,location.href)}catch{return}
    if(url.origin!==location.origin)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    history.pushState(null,'',url.pathname+url.search+url.hash);
    closeMobileNav();
    applyRoute();
  },true);

  addEventListener('popstate',()=>setTimeout(applyRoute,0));
  const root=app();
  if(root)new MutationObserver(()=>queueMicrotask(applyRoute)).observe(root,{childList:true,subtree:false});
  applyRoute();
})();