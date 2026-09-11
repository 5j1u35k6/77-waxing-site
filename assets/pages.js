(()=>{
const B='/77-waxing-site';
const app=document.querySelector('#app');
if(!app)return;
let brandIntroRequested=false;

const SERVICE_CARDS=[
  ['女性熱蠟','VIO 私密處、腋下、四肢與細部熱蠟整理','women-waxing'],
  ['男士熱蠟','男士私密處、胸腹背、四肢與細部熱蠟整理','men-waxing'],
  ['肌膚管理','臉部、粉刺、撥筋與身體肌膚保養','skin-care'],
  ['美胸保養','依時間與需求選擇不同美胸保養流程','bust-care']
];
const FLOW_STEPS=[
  ['arrival','抵達與接待','確認今天的需求與身體狀況。'],
  ['consult','諮詢與評估','不確定服務也沒關係，先把需求說清楚。'],
  ['service','施作與衛教','每個步驟先說明，完成後提供居家照護提醒。']
];
const FLOW_SCENES={
  arrival:`<svg viewBox="0 0 220 190" aria-hidden="true"><path class="scene-bg" d="M29 170V87C29 42 65 10 110 10s81 32 81 77v83Z"/><g class="scene-line"><path d="M35 157c20-10 41-13 63-8m68 8c-8-16-20-25-37-29"/><circle cx="83" cy="67" r="20"/><path d="M64 65c4-19 29-29 43-11m-37 27c4 7 10 10 17 10 8 0 14-3 19-11M70 92l-6 48m40-47 8 45M64 111c17 7 31 7 48 0"/><path d="M77 105h36l-4 31H73Z"/><circle cx="151" cy="93" r="17"/><path d="M139 79c17-10 31 1 30 17m-37 28c5-13 12-20 21-21 14-2 25 11 26 38m-45-3c3-11 8-20 16-25"/><path d="M51 126c-9 4-15 9-20 17m151-15c6 7 10 14 12 23"/></g></svg>`,
  consult:`<svg viewBox="0 0 220 190" aria-hidden="true"><path class="scene-bg" d="M29 170V87C29 42 65 10 110 10s81 32 81 77v83Z"/><g class="scene-line"><circle cx="77" cy="76" r="19"/><path d="M60 73c7-20 30-25 40-8m-35 27-5 48m38-48 12 44M60 112c16 7 31 7 48-1"/><path d="M73 108h31l-2 28H69Z"/><circle cx="157" cy="101" r="16"/><path d="M144 89c13-11 29-2 30 13m-39 38c4-14 11-23 22-24 13-1 22 10 26 27"/><path d="M107 111c10 0 19-4 26-11m-3 2 10-7"/><path d="M123 37c0-12 11-22 25-22s25 10 25 22-11 22-25 22c-4 0-8-1-11-2l-10 7 3-12c-4-4-7-9-7-15Z"/><circle cx="141" cy="36" r="1.5" fill="currentColor"/><circle cx="149" cy="36" r="1.5" fill="currentColor"/><circle cx="157" cy="36" r="1.5" fill="currentColor"/></g></svg>`,
  service:`<svg viewBox="0 0 220 190" aria-hidden="true"><path class="scene-bg" d="M29 170V87C29 42 65 10 110 10s81 32 81 77v83Z"/><g class="scene-line"><circle cx="126" cy="55" r="18"/><path d="M109 52c4-17 26-24 36-10m-27 30-14 47m34-44 14 46M104 93c14 7 29 7 44 0"/><path d="M107 43c8-12 25-16 34-6M120 35c0-8 6-14 13-14s12 6 12 13"/><path d="M26 145c26-15 51-20 77-17 23 3 42 12 58 27m-126 4h154"/><path d="M42 142c10-16 25-23 43-21 13 2 24 8 34 18m12-28c-12 4-22 11-29 20m50-20c-10 2-19 7-26 15"/><path d="M103 121c4-7 11-11 20-12m-10 15c5-7 12-11 21-11"/><path d="M33 99l4 8 8 4-8 4-4 8-4-8-8-4 8-4Zm155 1 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/></g></svg>`
};
const hero=(tag,title,copy)=>`<section class="pagehero"><div class="wrap narrow"><span class="tag">${tag}</span><h1>${title}</h1><p class="lead muted">${copy}</p></div></section>`;
const experienceFlow=()=>`<div class="experience-flow">${FLOW_STEPS.map(([scene,title,copy],i)=>`<article class="experience-step"><div class="flow-visual">${FLOW_SCENES[scene]}</div><div class="flow-copy"><span class="flow-num">0${i+1}</span><h3>${title}</h3><p>${copy}</p></div></article>`).join('')}</div>`;

function home(){
  return `<section class="hero"><div class="wrap hero-grid"><div><span class="tag">77WAXING · KEELUNG BEAUTY STUDIO</span><h1 class="home-reassurance"><span>只需要安心躺好，剩下的交給77就可以了。</span><small>安心瞓好，剩低嘅交畀77就得喇。</small></h1><p class="lead">怕痛、害羞、不知道第一次要準備什麼，都不用先變成專家。把服務、流程、價目與預約說清楚，讓你在決定以前就先感到安心。</p><div class="btns"><a class="btn dark" href="${B}/booking/">預約時段讓自己更好</a><a class="btn" data-link href="${B}/services/">77waxing提供的服務</a></div></div><div class="art" aria-hidden="true"></div></div></section>
  <section class="section soft"><div class="wrap"><div class="head"><div><span class="tag">START HERE</span><h2>第一次，不需要一次懂全部。</h2></div></div><div class="grid4">${SERVICE_CARDS.map(([name,desc,slug],i)=>`<article class="card"><div class="num">0${i+1}</div><h3>${name}</h3><p>${desc}</p><a href="${B}/services/${slug}/" data-catalog-link>了解服務 →</a></article>`).join('')}</div></div></section>
  <section class="section home-safe-section"><div class="wrap home-safe-layout"><div class="art home-safe-art" aria-hidden="true"></div><div class="home-safe-copy"><span class="tag">SAFE SPACE</span><h2 class="home-safe-title">把「會不會尷尬」先放下。</h2>${experienceFlow()}<a class="btn home-safe-button" data-link href="${B}/about/#first-visit">給77waxing首訪的你</a></div></div></section>`;
}
function about(){
  return hero('ABOUT 77','關於 77waxing','把每一次服務做得清楚、細心，也讓第一次來的人知道自己會經歷什麼。')+
  `<section class="section"><div class="wrap narrow"><span class="tag">STUDIO</span><h2>一對一的服務節奏</h2><p>77waxing 以預約制安排服務，讓每位顧客都有足夠的諮詢、施作與整理時間。對於怕痛、害羞或第一次接觸服務的人，也會在開始前先說明流程與注意事項。</p><div class="btns"><a class="btn dark" data-link href="${B}/services/">查看服務</a><a class="btn" href="${B}/booking/">立即預約</a></div></div></section>`;
}
function space(){
  return '';
}
function courses(){
  return hero('COURSES','專業教學','教學內容與開課資訊會在確認後於此更新。')+
  `<section class="section"><div class="wrap narrow"><span class="tag">COURSES</span><h2>目前教學資訊整理中</h2><p>為避免放上尚未確認的課程內容、費用或時數，這個頁面只保留正式公告位置。</p></div></section>`;
}
function bookingShell(){
  return `<section class="section"><div class="wrap booking-wide"><div class="booking" id="booking"></div></div></section>`;
}
function catalogShell(){
  return `<section class="section" data-catalog-loading><div class="wrap narrow"><span class="tag">SERVICES</span><p class="muted">正在載入最新服務內容…</p></div></section>`;
}
function notFound(){return hero('77WAXING','找不到這個頁面','請從上方選單重新選擇。');}

function normalizedPath(){
  let p=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
  if(!p.startsWith('/'))p='/'+p;
  if(p!=='/'&&!p.endsWith('/'))p+='/';
  return p;
}
function applyRedirectQuery(){
  const url=new URL(location.href);
  const requested=url.searchParams.get('p');
  if(!requested)return;
  let p=requested.startsWith('/')?requested:`/${requested}`;
  if(p!=='/'&&!p.endsWith('/'))p+='/';
  history.replaceState(null,'',`${B}${p}${location.hash||''}`);
}
function syncHeader(path){
  document.querySelectorAll('.header nav > a').forEach(a=>{
    const href=new URL(a.href,location.href).pathname;
    const on=path==='/'?href===`${B}/`:path.startsWith('/services/')?href===`${B}/services/`:href===`${B}${path}`;
    a.classList.toggle('on',on);
  });
}
function ensureBrandIntro(path){
  if(path!=='/'||brandIntroRequested)return;
  brandIntroRequested=true;
  if(document.querySelector('script[data-home-brand-intro]'))return;
  const script=document.createElement('script');
  script.src=`${B}/assets/home-warm-intro.js?v=20260911-1015`;
  script.dataset.homeBrandIntro='1';
  document.body.appendChild(script);
}
function render(){
  const path=normalizedPath();
  syncHeader(path);
  if(path==='/')app.innerHTML=home();
  else if(path==='/about/')app.innerHTML=about();
  else if(path==='/space/')app.innerHTML=space();
  else if(path==='/courses/')app.innerHTML=courses();
  else if(path==='/booking/')app.innerHTML=bookingShell();
  else if(path==='/menu/'||path==='/services/'||path.startsWith('/services/'))app.innerHTML=catalogShell();
  else app.innerHTML=notFound();
  ensureBrandIntro(path);
  window.scrollTo({top:0,behavior:'auto'});
}

document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[data-link]');
  if(!link)return;
  let url;try{url=new URL(link.href,location.href)}catch{return}
  if(url.origin!==location.origin||!url.pathname.startsWith(B))return;
  if(url.pathname===`${B}/booking/`)return;
  event.preventDefault();
  history.pushState(null,'',url.pathname+url.search+url.hash);
  render();
},true);
window.addEventListener('popstate',render);
applyRedirectQuery();
render();
})();