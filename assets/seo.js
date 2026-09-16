(()=>{
  const SITE='https://5j1u35k6.github.io/77-waxing-site';
  const BASE='/77-waxing-site';
  const HOME_TITLE='77美學工作室｜基隆熱蠟除毛・清粉刺・肌膚管理｜77waxing';
  const HOME_DESCRIPTION='基隆 77美學工作室，提供女性與男性熱蠟除毛、手工清粉刺、肌膚管理與美胸保養。線上查看價目與預約服務。';
  const BUSINESS_ID=`${SITE}/#business`;

  const ROUTES={
    '/':{
      title:HOME_TITLE,
      description:HOME_DESCRIPTION,
      type:'WebPage'
    },
    '/about/':{
      title:'關於77美學工作室｜基隆熱蠟除毛・肌膚管理｜77waxing',
      description:'認識基隆 77美學工作室與 77waxing。預約制一對一服務，提供女性與男性熱蠟除毛、清粉刺、肌膚管理與美胸保養。',
      type:'AboutPage'
    },
    '/services/':{
      title:'基隆熱蠟除毛服務｜女性・男性・肌膚管理｜77waxing',
      description:'77waxing 基隆熱蠟除毛服務，包含女性與男性私密處、腋下、四肢熱蠟，以及清粉刺、肌膚管理與美胸保養。',
      type:'CollectionPage'
    },
    '/services/women-waxing/':{
      title:'基隆女性熱蠟除毛｜VIO私密處・腋下・四肢｜77waxing',
      description:'基隆女性熱蠟除毛服務，包含 VIO 私密處、腋下、手腳與細部熱蠟整理。77waxing 採預約制一對一服務。',
      serviceType:'女性熱蠟除毛'
    },
    '/services/men-waxing/':{
      title:'基隆男性熱蠟除毛｜私密處・胸腹背・四肢｜77waxing',
      description:'基隆男性熱蠟除毛服務，包含私密處、胸腹背、腋下、四肢與細部熱蠟整理。77waxing 採預約制一對一服務。',
      serviceType:'男性熱蠟除毛'
    },
    '/services/skin-care/':{
      title:'基隆清粉刺・肌膚管理｜臉部保養・粉刺護理｜77waxing',
      description:'基隆清粉刺與肌膚管理服務，提供臉部保養、粉刺清潔、撥筋與身體肌膚保養，依當日肌膚狀況評估。',
      serviceType:'清粉刺與肌膚管理'
    },
    '/services/bust-care/':{
      title:'基隆美胸保養｜胸部按摩・身體保養｜77waxing',
      description:'77waxing 基隆美胸保養服務，依時間與需求安排不同保養流程，採預約制一對一服務。',
      serviceType:'美胸保養'
    },
    '/menu/':{
      title:'基隆熱蠟除毛價目｜女性・男性除毛價格｜77waxing',
      description:'查看 77waxing 基隆熱蠟除毛與美容保養價目，包含女性、男性熱蠟除毛、清粉刺、肌膚管理與美胸保養。',
      type:'WebPage'
    },
    '/space/':{
      title:'77美學工作室空間｜基隆一對一預約制美容工作室｜77waxing',
      description:'查看基隆 77美學工作室空間。77waxing 採預約制一對一服務，提供更自在與安心的熱蠟除毛及美容保養環境。',
      type:'WebPage'
    },
    '/courses/':{
      title:'熱蠟除毛教學｜77waxing 基隆 77美學工作室',
      description:'77waxing 熱蠟除毛教學與課程資訊，由基隆 77美學工作室提供。',
      type:'WebPage'
    }
  };

  const normalizePath=(value)=>{
    let path=String(value||'/').split('?')[0].split('#')[0];
    if(path.startsWith(BASE))path=path.slice(BASE.length)||'/';
    if(!path.startsWith('/'))path=`/${path}`;
    if(path!=='/'&&!path.endsWith('/'))path+= '/';
    return path;
  };

  const effectivePath=()=>{
    const queryPath=new URLSearchParams(location.search).get('p');
    return normalizePath(queryPath||location.pathname);
  };

  const setMeta=(selector,attrs)=>{
    let node=document.head.querySelector(selector);
    if(!node){
      node=document.createElement('meta');
      document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
    return node;
  };

  const setLink=(rel,href)=>{
    let node=document.head.querySelector(`link[rel="${rel}"]`);
    if(!node){
      node=document.createElement('link');
      node.rel=rel;
      document.head.appendChild(node);
    }
    node.href=href;
  };

  const businessSchema=()=>({
    '@type':['BeautySalon','LocalBusiness'],
    '@id':BUSINESS_ID,
    name:'77美學工作室',
    alternateName:'77waxing',
    url:`${SITE}/`,
    description:HOME_DESCRIPTION,
    image:`${SITE}/assets/77waxing-wordmark.svg`,
    logo:`${SITE}/assets/77waxing-wordmark.svg`,
    address:{
      '@type':'PostalAddress',
      streetAddress:'義一路56號2樓',
      addressLocality:'中正區',
      addressRegion:'基隆市',
      addressCountry:'TW'
    },
    areaServed:[
      {'@type':'City',name:'基隆市'},
      {'@type':'AdministrativeArea',name:'北部地區'}
    ],
    sameAs:['https://www.instagram.com/77waxing/'],
    hasOfferCatalog:{
      '@type':'OfferCatalog',
      name:'77waxing 服務項目',
      itemListElement:[
        {'@type':'Offer','itemOffered':{'@type':'Service','name':'女性熱蠟除毛','url':`${SITE}/services/women-waxing/`}},
        {'@type':'Offer','itemOffered':{'@type':'Service','name':'男性熱蠟除毛','url':`${SITE}/services/men-waxing/`}},
        {'@type':'Offer','itemOffered':{'@type':'Service','name':'清粉刺與肌膚管理','url':`${SITE}/services/skin-care/`}},
        {'@type':'Offer','itemOffered':{'@type':'Service','name':'美胸保養','url':`${SITE}/services/bust-care/`}}
      ]
    }
  });

  const routeSchema=(path,config,canonical)=>{
    const graph=[
      {
        '@type':'WebSite',
        '@id':`${SITE}/#website`,
        url:`${SITE}/`,
        name:'77waxing｜77美學工作室',
        inLanguage:'zh-Hant-TW',
        publisher:{'@id':BUSINESS_ID}
      },
      businessSchema(),
      {
        '@type':config.type||'WebPage',
        '@id':`${canonical}#webpage`,
        url:canonical,
        name:config.title,
        description:config.description,
        inLanguage:'zh-Hant-TW',
        isPartOf:{'@id':`${SITE}/#website`},
        about:{'@id':BUSINESS_ID}
      }
    ];
    if(config.serviceType){
      graph.push({
        '@type':'Service',
        '@id':`${canonical}#service`,
        name:config.serviceType,
        serviceType:config.serviceType,
        url:canonical,
        description:config.description,
        provider:{'@id':BUSINESS_ID},
        areaServed:{'@type':'City',name:'基隆市'}
      });
    }
    return {'@context':'https://schema.org','@graph':graph};
  };

  const apply=()=>{
    const path=effectivePath();
    const blocked=path.startsWith('/booking/')||path.startsWith('/admin/')||path.startsWith('/line-auth/');
    const config=ROUTES[path]||ROUTES['/'];
    const canonical=`${SITE}${path==='/'?'/':path}`;

    if(blocked){
      setMeta('meta[name="robots"]',{name:'robots',content:'noindex,nofollow,noarchive'});
      return;
    }

    document.title=config.title;
    setMeta('meta[name="description"]',{name:'description',content:config.description});
    setMeta('meta[name="robots"]',{name:'robots',content:'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
    setMeta('meta[property="og:title"]',{property:'og:title',content:config.title});
    setMeta('meta[property="og:description"]',{property:'og:description',content:config.description});
    setMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
    setMeta('meta[property="og:locale"]',{property:'og:locale',content:'zh_TW'});
    setMeta('meta[property="og:site_name"]',{property:'og:site_name',content:'77waxing'});
    setMeta('meta[property="og:url"]',{property:'og:url',content:canonical});
    setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});
    setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:config.title});
    setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:config.description});
    setLink('canonical',canonical);
    setLink('alternate',canonical);
    const alternate=document.head.querySelector('link[rel="alternate"]');
    if(alternate)alternate.hreflang='zh-Hant-TW';

    let jsonLd=document.querySelector('#seo-structured-data');
    if(!jsonLd){
      jsonLd=document.createElement('script');
      jsonLd.type='application/ld+json';
      jsonLd.id='seo-structured-data';
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent=JSON.stringify(routeSchema(path,config,canonical));
  };

  const wrapHistory=(method)=>{
    const original=history[method];
    if(typeof original!=='function'||original.__seoWrapped)return;
    const wrapped=function(...args){
      const result=original.apply(this,args);
      queueMicrotask(apply);
      return result;
    };
    wrapped.__seoWrapped=true;
    history[method]=wrapped;
  };

  wrapHistory('pushState');
  wrapHistory('replaceState');
  addEventListener('popstate',()=>queueMicrotask(apply));
  addEventListener('hashchange',()=>queueMicrotask(apply));
  apply();
})();
