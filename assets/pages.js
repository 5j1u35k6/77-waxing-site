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
const BEGINNER_FAQ=[
  {
    question:'熱蠟除毛會很痛嗎？',
    body:`<p>每個人的疼痛感受都不一樣，第一次因為毛髮通常比較粗、毛量也比較多，感覺會相對明顯一些。</p><p>操作時，77會依照不同部位、毛髮方向及肌膚狀況調整手法，不會為了求快而反覆拉扯肌膚。</p><p>很多第一次來時很緊張的客人，做完反而會跟77說：</p><blockquote>「原來沒有想像中那麼可怕。」</blockquote>`
  },
  {
    question:'第一次熱蠟，需要先做什麼準備嗎？',
    body:`<p>其實不用特別準備很多。</p><p><mark class="beginner-highlight">毛髮建議保留約 0.5–1 公分</mark>，大約至少一粒米的長度，不用自己先刮短。</p><p>當天保持肌膚乾爽，並先暫停去角質、酸類或較刺激性的保養。</p><p>如果真的不知道自己的毛長度適不適合，也不用太緊張，可以先私訊77詢問唷。</p>`
  },
  {
    question:'一次大約需要多久？',
    body:`<p>會依照不同部位、毛量，以及第一次或固定保養而有所不同。</p><p>以女士私密處熱蠟為例，77會預留約 1.5 小時，包含前面的簡單諮詢、確認肌膚狀況及完整操作時間。</p><p>77比較在意操作的<mark class="beginner-highlight">細節和肌膚狀況</mark>，不會單純追求速度。</p><p>第一次來，我也會先跟妳說明等等怎麼進行、需要怎麼配合，不會一躺下就直接開始，讓妳慢慢熟悉之後再進行，也會安心很多。</p>`
  },
  {
    question:'做一次之後，就不會再長了嗎？',
    body:`<p>還是會長喔！</p><p>熱蠟是將毛髮從根部帶走，但因為毛髮本身有不同的生長週期，所以之後還是<mark class="beginner-highlight">會慢慢長回來。</mark></p><p>固定保養一段時間後，很多客人會發現新長出來的毛髮比較細，摸起來也不會像刮毛後一樣刺刺的。</p><p><mark class="beginner-highlight beginner-highlight-long">之後再依照每個人的毛髮生長速度，大約4-6週安排適合自己的保養時間就可以了。</mark></p>`
  },
  {
    question:'我的皮膚比較敏感，也適合做熱蠟嗎？',
    body:`<p>大部分情況都可以先評估，但<mark class="beginner-highlight">不是每一種肌膚狀態都一定適合當下操作</mark>。</p><p>如果有明顯破皮、發炎、感染、曬傷，或近期正在使用較刺激性的酸類、藥物，都會先確認當下的肌膚狀況，再決定是否適合進行。</p><p>對77來說，能不能安全地做，比一定要把這次服務做完更重要。</p>`
  },
  {
    question:'第一次做私密處熱蠟，會不會很尷尬？',
    body:`<p>這真的是第一次來的客人最常擔心的事情之一。</p><p>但對77來說，私密處熱蠟就是很日常、也很專業的一項服務。</p><p>過程中我會一步一步告訴妳現在要做什麼、姿勢要怎麼調整，也會盡量減少不必要的暴露。</p><p>所以真的不用擔心自己的毛量、膚色，或者身體狀態是不是「很奇怪」。</p><p>每個人的身體本來就不一樣。</p><p><mark class="beginner-highlight beginner-highlight-long">妳只需要安心躺好，剩下的交給77就可以了。</mark></p>`
  }
];
const HOME_FAQ=[
  ['熱蠟除毛會很痛嗎？','每個人的疼痛感受都不一樣。第一次因為毛髮通常比較粗、毛量也比較多，感覺會相對明顯一些；77會依照部位、毛髮方向及肌膚狀況調整手法。'],
  ['第一次熱蠟，需要先做什麼準備嗎？','毛髮建議保留約 0.5–1 公分，大約至少一粒米的長度，不用自己先刮短。當天保持肌膚乾爽，並先暫停去角質、酸類或較刺激性的保養。'],
  ['一次大約需要多久？','會依照不同部位、毛量，以及第一次或固定保養而有所不同。以女士私密處熱蠟為例，77會預留約 1.5 小時，包含簡單諮詢、確認肌膚狀況及完整操作時間。'],
  ['做一次之後，就不會再長了嗎？','還是會長喔！熱蠟將毛髮從根部帶走，但毛髮有不同的生長週期，之後會慢慢長回來；可依每個人的生長速度，大約 4–6 週安排保養。'],
  ['我的皮膚比較敏感，也適合做熱蠟嗎？','大部分情況都可以先評估，但不是每一種肌膚狀態都一定適合當下操作。若有破皮、發炎、感染、曬傷，或近期使用較刺激性的酸類、藥物，會先確認肌膚狀況。'],
  ['第一次做私密處熱蠟，會不會很尷尬？','不用擔心毛量、膚色，或者身體狀態是不是「很奇怪」。過程中會一步一步說明，也會盡量減少不必要的暴露；妳只需要安心躺好，剩下的交給77就可以了。']
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
  <section class="section home-safe-section"><div class="wrap home-safe-layout"><div class="art home-safe-art" aria-hidden="true"></div><div class="home-safe-copy"><span class="tag">SAFE SPACE</span><h2 class="home-safe-title">把「會不會尷尬」先放下。</h2>${experienceFlow()}</div></div></section>
  <section class="section home-faq-section"><div class="wrap narrow"><div class="home-faq-head"><span class="tag">FIRST WAX FAQ</span><h2>第一次熱蠟，可能也會想問...</h2></div><div class="home-faq">${HOME_FAQ.map(([q,a],i)=>`<details><summary><span>Q${i+1}</span>${q}</summary><p>${a}</p></details>`).join('')}</div></div></section>`;
}
function beginner(){
  return `<section class="pagehero beginner-hero"><div class="wrap narrow"><span class="tag">FIRST WAX · 小白小白專區</span><h1>第一次熱蠟，可能也會想問...</h1><p class="lead">第一次嘗試熱蠟，會緊張、怕痛，甚至不知道要先準備什麼，其實都很正常。</p><p class="lead">希望在來之前，先把最在意的事情說清楚，讓第一次也可以安心一點。</p></div></section>
  <section class="section beginner-section"><div class="wrap narrow"><div class="beginner-faq">${BEGINNER_FAQ.map((item,i)=>`<article class="beginner-card"><div class="beginner-q">Q${i+1}</div><div class="beginner-copy"><h2>${item.question}</h2>${item.body}</div></article>`).join('')}</div><div class="beginner-outro"><strong>第一次不用很勇敢，剩下的交給77就好。</strong><p>從諮詢、確認肌膚狀況，到每一次操作，我都會一步一步告訴妳現在正在做什麼。</p><p>比起把速度做到最快，77WAXING 更在意每一次拉除的細節、妳當下的感受，以及做完之後，妳會願意放心地再回來。</p><div class="btns"><a class="btn dark" href="${B}/booking/">安心預約第一次</a></div></div></div></section>`;
}
function about(){
  return `<section class="pagehero about-story-hero"><div class="wrap narrow"><span class="tag">ABOUT 77 · BRAND STORY</span><h1>77waxing故事</h1><p class="lead">從香港到台灣，跨越海峽的不只是距離，還有對理想生活的堅持。</p></div></section>
  <section class="section about-story-section"><div class="wrap about-story-wrap">
    <article class="about-story-grid about-story-origin"><div class="about-story-art" aria-hidden="true"><svg viewBox="0 0 560 390"><path class="about-art-haze" d="M42 316c86-67 169-84 252-52 80 31 147 23 224-44v132H42Z"/><g class="about-art-line"><path d="M38 313h484"/><path d="M58 275h105l-14-28h-78Z"/><path d="M81 247v-78m27 78v-104m28 104v-65"/><path d="M70 170h76M92 143h35"/><path d="M188 295c36-25 70-34 104-24 27 8 49 6 70-5"/><path d="M369 251c27-53 57-81 91-84 33 3 55 26 67 69"/><path d="M418 223c13-11 27-16 42-16 21 0 39 10 53 29"/><path d="M275 157c45 0 78 22 101 66" stroke-dasharray="7 12"/><path d="M269 157l16-8-5 17Z"/><circle cx="241" cy="158" r="6"/><path d="M225 184c8-10 19-15 31-15 13 0 24 5 32 15"/><path d="M452 168v-57m-18 57h36m-28-56 10-19 10 19m-21 31h22"/></g><text x="67" y="338" class="about-art-label">HONG KONG</text><text x="417" y="338" class="about-art-label">TAIWAN</text></svg></div><div class="about-story-copy"><span class="about-story-index">01 · 落腳</span><h2>從香港到台灣，找到想留下來的地方。</h2><p>還記得初訪台灣旅遊，就被這邊的人文深深吸引，喜歡這裡的溫暖與步調，最後決定在這裡落腳扎根。</p><p>跨越海峽的不只是生活的距離，也像是一步一步走向自己真正想要的生活。</p></div></article>

    <blockquote class="about-story-quote"><span>“</span><p>保養不只是技術，<br>更是一場好好對待自己的儀式。</p></blockquote>

    <article class="about-story-grid about-story-selfcare"><div class="about-story-copy"><span class="about-story-index">02 · 初心</span><h2>因為自己也曾經歷過，所以更懂那份在意。</h2><p>因為我自己本身也有毛髮上面的困擾，過去也曾長年受臉部肌膚問題影響，甚至連心情與自信都受到牽連。</p><p>對我來說，熱蠟與肌膚保養不只是一項技術，更是一場關於「好好對待自己」的儀式。</p><p>每次當毛髮再一次被整理乾淨，好好檢查和保養自己的皮膚後，就好像獲得了一個全新的自己一樣。</p></div><div class="about-story-art about-story-art-soft" aria-hidden="true"><svg viewBox="0 0 520 430"><path class="about-art-haze" d="M68 348c31-126 104-205 219-235 77-19 137 8 179 82v173H68Z"/><g class="about-art-line"><path d="M193 279c-21-39-17-91 13-127 30-37 80-49 122-28 43 22 62 68 49 112-8 28-26 50-51 65"/><path d="M231 133c14-24 35-36 63-36 31 0 53 14 67 42"/><path d="M240 203c17 18 34 27 52 27 20 0 39-10 56-30"/><path d="M219 283c21 30 51 47 89 50 39 3 73-9 101-36"/><path d="M174 361c13-49 45-77 95-84m127 84c-14-47-44-74-90-83"/><path d="M104 267c31 3 57 15 78 36m-79-21c-18 19-28 40-31 64"/><path d="M409 245c20-8 38-7 54 3m-47 13c23 0 41 7 54 22"/><path d="M121 156l5 12 12 5-12 5-5 12-5-12-12-5 12-5Zm333 27 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/></g></svg></div></article>

    <article class="about-story-panel"><div class="about-story-watermark">77</div><div class="about-story-panel-copy"><span class="about-story-index">03 · 堅持</span><h2>讓來到這裡的每一個人，都能變得更好。</h2><p>創業過程中有過不安，但每當看到顧客帶著放鬆的笑容離開，就更加確定這是我想一輩子用心做的事。</p><p>很多時候，我們習慣了把照顧別人的優先順序放在最前面，卻忘了停下來好好看看自己。當你因為肌膚或毛髮問題感到不自信時，那種藏在心裡的卡卡感，我也曾經深深體會過。</p></div></article>

    <article class="about-story-grid about-story-space"><div class="about-story-art" aria-hidden="true"><svg viewBox="0 0 560 390"><path class="about-art-haze" d="M31 345V87c0-22 18-40 40-40h418c22 0 40 18 40 40v258Z"/><g class="about-art-line"><path d="M53 332h454M90 332V173h134v159M123 173V98h68v75M109 217h95M344 332V207h115v125M365 207v-54h73v54"/><path d="M258 328c0-53 34-91 82-91 50 0 83 38 83 91"/><path d="M269 289c24-17 47-24 71-23 26 1 50 10 72 28"/><path d="M289 235c11-20 28-31 51-31 24 0 43 12 55 35"/><path d="M77 150c18-12 35-17 53-16m340 12c-17-10-35-14-53-12"/><path d="M247 112l5 11 11 5-11 5-5 11-5-11-11-5 11-5Z"/></g></svg></div><div class="about-story-copy"><span class="about-story-index">04 · 安心</span><h2>一個可以安心歇腳的角落。</h2><p>所以我把這個空間打造成一個可以讓你安心歇腳的角落。在這裡沒有尷尬與壓力，只有最溫柔的照顧與細緻的堅持。</p><p>對我來說，「變得更好」不一定要完美無瑕，而是透過一次次的細心整理，讓你重新找回對自己的喜歡與自信。</p><p>當你做完保養、帶著一身輕鬆與滿意的笑容跨出大門時的那一刻，就是這份工作帶給我最大的幸福。</p></div></article>

    <section class="about-story-closing"><span class="tag">WELCOME TO 77WAXING</span><h2>把肌膚與心情，都安心地交給我。</h2><p>無論你是第一次嘗試，還是想給肌膚一次喘息的機會，都歡迎你來到這裡。</p><div class="btns"><a class="btn dark" data-link href="${B}/services/">看看服務</a><a class="btn" href="${B}/booking/">立即預約</a></div></section>
  </div></section>`;
}
function firstVisit(){
  return hero('FIRST VISIT','首訪的你','第一次來店前，可以先知道接待、需求確認、服務前說明、施作與術後照護會怎麼進行。')+
  `<section class="section soft"><div class="wrap narrow"><ol class="flow"><li><b>抵達與接待</b><small>確認預約項目與當天身體狀況。</small></li><li><b>需求諮詢</b><small>第一次、怕痛或有特別在意的地方都可以先說。</small></li><li><b>服務前說明</b><small>開始前確認服務範圍與流程。</small></li><li><b>一對一施作</b><small>過程中有任何不適都可以即時調整。</small></li><li><b>術後照護</b><small>完成後確認居家照護方式與後續建議。</small></li></ol></div></section>`;
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
    const on=path==='/'?href===`${B}/`:(path==='/beginner/'||path==='/first-visit/')?href===`${B}/about/`:path.startsWith('/services/')?href===`${B}/services/`:href===`${B}${path}`;
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
  else if(path==='/beginner/')app.innerHTML=beginner();
  else if(path==='/about/')app.innerHTML=about();
  else if(path==='/first-visit/')app.innerHTML=firstVisit();
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