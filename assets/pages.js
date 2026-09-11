(()=>{
const B='/77-waxing-site';
const app=document.querySelector('#app');
if(!app)return;
let brandIntroRequested=false;

const FAQ=[
  ['第一次熱蠟會很痛嗎？','每個人的感受與部位不同。施作前會先說明流程，過程中也可以隨時反映感受。'],
  ['毛要留多長？','若不確定目前毛長是否適合，可在預約備註中先說明，現場會再依實際狀況確認。'],
  ['第一次做 VIO 會很尷尬嗎？','一對一獨立空間會先說明流程，需要暫停或調整時都可以直接提出。'],
  ['生理期可以預約嗎？','建議預約時先備註，讓 77waxing 依當天身體狀況與服務內容確認。'],
  ['多久做一次比較好？','依毛髮生長週期、部位與個人狀況不同，完成服務後再提供下次建議。']
];
const SERVICE_CARDS=[
  ['女性熱蠟','VIO 私密處、腋下、四肢與細部熱蠟整理','women-waxing'],
  ['男士熱蠟','男士私密處、胸腹背、四肢與細部熱蠟整理','men-waxing'],
  ['肌膚管理','臉部、粉刺、撥筋與身體肌膚保養','skin-care'],
  ['美胸保養','依時間與需求選擇不同美胸保養流程','bust-care']
];
const faqs=()=>`<div class="faq">${FAQ.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
const hero=(tag,title,copy)=>`<section class="pagehero"><div class="wrap narrow"><span class="tag">${tag}</span><h1>${title}</h1><p class="lead muted">${copy}</p></div></section>`;

function home(){
  return `<section class="hero"><div class="wrap hero-grid"><div><span class="tag">77WAXING · KEELUNG BEAUTY STUDIO</span><h1>把第一次的緊張，<br>交給 77 的細心與溫柔。</h1><p class="lead">怕痛、害羞、不知道第一次要準備什麼，都不用先變成專家。把服務、流程、價目與預約說清楚，讓你在決定以前就先感到安心。</p><div class="btns"><a class="btn dark" href="${B}/booking/">預約時段讓自己更好</a><a class="btn" data-link href="${B}/services/">77waxing提供的服務</a></div></div><div class="art" aria-hidden="true"></div></div></section>
  <section class="section soft"><div class="wrap"><div class="head"><div><span class="tag">START HERE</span><h2>第一次，不需要一次懂全部。</h2></div></div><div class="grid4">${SERVICE_CARDS.map(([name,desc,slug],i)=>`<article class="card"><div class="num">0${i+1}</div><h3>${name}</h3><p>${desc}</p><a href="${B}/services/${slug}/" data-catalog-link>了解服務 →</a></article>`).join('')}</div></div></section>
  <section class="section"><div class="wrap two"><div class="art" aria-hidden="true"></div><div><span class="tag">SAFE SPACE</span><h2>把「會不會尷尬」先放下。</h2><ol class="flow"><li><b>抵達與接待</b><small>確認今天的需求與身體狀況。</small></li><li><b>諮詢與評估</b><small>不確定服務也沒關係，先把需求說清楚。</small></li><li><b>施作與衛教</b><small>每個步驟先說明，完成後提供居家照護提醒。</small></li></ol><a class="btn" data-link href="${B}/about/#first-visit">給77waxing首訪的你</a></div></div></section>
  <section class="section soft"><div class="wrap narrow"><span class="tag">FAQ</span><h2>第一次最常先問的事</h2>${faqs()}</div></section>`;
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
function catalogShell(){return '<div data-current-catalog-shell></div>';}
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
  script.src=`${B}/assets/home-warm-intro.js?v=20260911-1009`;
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