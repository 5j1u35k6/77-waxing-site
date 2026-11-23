import { allProducts } from "./series.js?v=20261124-series1";
import { canonicalStoreHref, storeRoute } from "./select-routes.js?v=20261124-series1";

const URL='https://5j1u35k6.github.io/77select/';

const canonicalUrl = canonicalStoreHref();
const TITLE = storeRoute.view === "product" ? "商品詳情｜77 Select" :
  storeRoute.view === "products" ? (storeRoute.category === allProducts ? "商品目錄｜77 Select" : `${storeRoute.category}｜77 Select`) :
  "77select｜熱蠟後保養・居家保養商品選物";
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
setMeta('meta[property="og:url"]',{property:'og:url',content:canonicalUrl});
setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});
setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:TITLE});
setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:DESCRIPTION});

let canonical=document.head.querySelector('link[rel="canonical"]');
if(!canonical){
  canonical=document.createElement('link');
  canonical.rel='canonical';
  document.head.appendChild(canonical);
}
canonical.href=canonicalUrl;

let alternate=document.head.querySelector('link[rel="alternate"][hreflang]');
if(!alternate){
  alternate=document.createElement('link');
  alternate.rel='alternate';
  alternate.hreflang='zh-Hant-TW';
  document.head.appendChild(alternate);
}
alternate.href=canonicalUrl;

let jsonLd=document.querySelector('#shop-seo-structured-data');
if(!jsonLd){
  jsonLd=document.createElement('script');
  jsonLd.type='application/ld+json';
  jsonLd.id='shop-seo-structured-data';
  document.head.appendChild(jsonLd);
}
const structuredData = {
  '@context':'https://schema.org',
  '@graph':[
    {
      '@type':'OnlineStore',
      '@id':`${URL}#store`,
      name:'77select',
      url:URL,
      description:DESCRIPTION,
      logo:'https://5j1u35k6.github.io/77select/77select-wordmark.svg',
      image:'https://5j1u35k6.github.io/77select/77select-wordmark.svg',
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
      '@type':storeRoute.view === 'product' ? 'ItemPage' : 'CollectionPage',
      '@id':`${canonicalUrl}#webpage`,
      url:canonicalUrl,
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
};

jsonLd.textContent = JSON.stringify(structuredData);

export function setProductPageMetadata(product) {
  const name = String(product.name || "商品詳情");
  const title = `${name}｜77 Select`;
  const description = String(product.description || DESCRIPTION).replace(/\s+/g, " ").trim().slice(0, 160);
  document.title = title;
  setMeta('meta[name="description"]', { name: "description", content: description });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: description });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  Object.assign(structuredData["@graph"][2], { name: title, description });
  jsonLd.textContent = JSON.stringify(structuredData);
}
