(()=>{
  const URL='https://5j1u35k6.github.io/77-waxing-site/shop/';
  const TITLE='77select｜熱蠟後保養・居家保養商品選物';
  const DESCRIPTION='77select 精選熱蠟除毛後保養、肌膚舒緩與日常居家保養商品，提供台灣與香港訂購。';

  const setMeta=(selector,attrs)=>{
    let node=document.head.querySelector(selector);
    if(!node){
      node=document.createElement('meta');
      document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
    return node;
  };

  document.title=TITLE;
  setMeta('meta[name="description"]',{name:'description',content:DESCRIPTION});
  setMeta('meta[name="robots"]',{name:'robots',content:'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
  setMeta('meta[property="og:title"]',{property:'og:title',content:TITLE});
  setMeta('meta[property="og:description"]',{property:'og:description',content:DESCRIPTION});
  setMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
  setMeta('meta[property="og:locale"]',{property:'og:locale',content:'zh_TW'});
  setMeta('meta[property="og:site_name"]',{property:'og:site_name',content:'77select'});
  setMeta('meta[property="og:url"]',{property:'og:url',content:URL});
  setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});
  setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:TITLE});
  setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:DESCRIPTION});

  let canonical=document.head.querySelector('link[rel="canonical"]');
  if(!canonical){
    canonical=document.createElement('link');
    canonical.rel='canonical';
    document.head.appendChild(canonical);
  }
  canonical.href=URL;

  let alternate=document.head.querySelector('link[rel="alternate"][hreflang]');
  if(!alternate){
    alternate=document.createElement('link');
    alternate.rel='alternate';
    alternate.hreflang='zh-Hant-TW';
    document.head.appendChild(alternate);
  }
  alternate.href=URL;

  let jsonLd=document.querySelector('#shop-seo-structured-data');
  if(!jsonLd){
    jsonLd=document.createElement('script');
    jsonLd.type='application/ld+json';
    jsonLd.id='shop-seo-structured-data';
    document.head.appendChild(jsonLd);
  }
  jsonLd.textContent=JSON.stringify({
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':'OnlineStore',
        '@id':`${URL}#store`,
        name:'77select',
        url:URL,
        description:DESCRIPTION,
        logo:'https://5j1u35k6.github.io/77-waxing-site/shop/77select-wordmark.svg',
        image:'https://5j1u35k6.github.io/77-waxing-site/shop/77select-wordmark.svg',
        areaServed:[
          {'@type':'Country','name':'台灣'},
          {'@type':'Country','name':'香港'}
        ],
        currenciesAccepted:'TWD, HKD'
      },
      {
        '@type':'WebSite',
        '@id':`${URL}#website`,
        url:URL,
        name:'77select',
        description:DESCRIPTION,
        inLanguage:'zh-Hant-TW',
        publisher:{'@id':`${URL}#store`}
      },
      {
        '@type':'CollectionPage',
        '@id':`${URL}#webpage`,
        url:URL,
        name:TITLE,
        description:DESCRIPTION,
        inLanguage:'zh-Hant-TW',
        isPartOf:{'@id':`${URL}#website`},
        about:[
          {'@type':'Thing','name':'熱蠟後保養'},
          {'@type':'Thing','name':'居家保養'},
          {'@type':'Thing','name':'肌膚保養商品'}
        ]
      }
    ]
  });
})();
