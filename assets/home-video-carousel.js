(()=>{
  const POSTS=[
    ['DUuGt-Rk3pz','https://www.instagram.com/reel/DUuGt-Rk3pz/'],
    ['DUGhMGBE8sE','https://www.instagram.com/reel/DUGhMGBE8sE/'],
    ['DTlAcQUE61G','https://www.instagram.com/reel/DTlAcQUE61G/'],
    ['DR95-4vE6o-','https://www.instagram.com/reel/DR95-4vE6o-/'],
    ['DRKZWu4E-Hw','https://www.instagram.com/reel/DRKZWu4E-Hw/'],
    ['DQfzi4mCuJq','https://www.instagram.com/reel/DQfzi4mCuJq/'],
    ['DQIhm6Wk_yM','https://www.instagram.com/reel/DQIhm6Wk_yM/'],
    ['DPOe_Akk4NT','https://www.instagram.com/reel/DPOe_Akk4NT/'],
    ['DLQ0lbzS-rv','https://www.instagram.com/reel/DLQ0lbzS-rv/'],
    ['DKfIfq6yHbU','https://www.instagram.com/reel/DKfIfq6yHbU/'],
    ['DKEnFFgSYsV','https://www.instagram.com/reel/DKEnFFgSYsV/'],
    ['DH0JFjtzA4P','https://www.instagram.com/reel/DH0JFjtzA4P/'],
    ['DHlXkunTxvL','https://www.instagram.com/reel/DHlXkunTxvL/'],
    ['DGmOSY_TaJ1','https://www.instagram.com/reel/DGmOSY_TaJ1/'],
    ['DGNabU8zg-R','https://www.instagram.com/reel/DGNabU8zg-R/'],
    ['DDTsBunzhMW','https://www.instagram.com/reel/DDTsBunzhMW/']
  ].map(([code,url],index)=>({code,url,index}));

  const GROUPS=[
    {key:'all',label:'全部影片',indexes:POSTS.map((_,i)=>i)},
    {key:'01',label:'01 — 04',indexes:[0,1,2,3]},
    {key:'02',label:'05 — 08',indexes:[4,5,6,7]},
    {key:'03',label:'09 — 12',indexes:[8,9,10,11]},
    {key:'04',label:'13 — 16',indexes:[12,13,14,15]}
  ];

  let category='all';
  let active=0;
  let startX=null;

  const section=()=>document.querySelector('.home-video-section');
  const currentGroup=()=>GROUPS.find(group=>group.key===category)||GROUPS[0];
  const currentSet=()=>currentGroup().indexes;
  const pad=value=>String(value).padStart(2,'0');

  function mount(){
    const root=section();
    if(!root||root.dataset.videoCarouselReady==='1')return;
    root.dataset.videoCarouselReady='1';
    root.innerHTML=`<div class="wrap home-video-carousel-layout">
      <aside class="home-video-side">
        <span class="tag">VIDEO LIBRARY</span>
        <h2>7777waxing video</h2>
        <nav class="home-video-categories" aria-label="影片分類" data-video-categories></nav>
        <a class="home-video-instagram" href="https://www.instagram.com/77waxing/?hl=zh-tw" target="_blank" rel="noreferrer">Instagram @77waxing ↗</a>
      </aside>
      <div class="home-video-showcase">
        <div class="home-video-stage-meta"><span data-video-frame>FRAME 01</span><span data-video-count>01 / 16</span></div>
        <div class="home-video-stage" data-video-stage tabindex="0" aria-label="77waxing Instagram 影片輪播"></div>
        <div class="home-video-caption"><a data-video-original target="_blank" rel="noreferrer">查看 Instagram 原文 ↗</a></div>
        <div class="home-video-controls">
          <button type="button" data-video-prev aria-label="上一支影片">‹</button>
          <div class="home-video-dots" data-video-dots aria-label="影片分頁"></div>
          <button type="button" data-video-next aria-label="下一支影片">›</button>
        </div>
      </div>
    </div>`;

    root.querySelector('[data-video-prev]').addEventListener('click',()=>move(-1));
    root.querySelector('[data-video-next]').addEventListener('click',()=>move(1));
    root.querySelector('[data-video-stage]').addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'){event.preventDefault();move(-1)}
      if(event.key==='ArrowRight'){event.preventDefault();move(1)}
    });
    root.querySelector('[data-video-stage]').addEventListener('pointerdown',event=>{startX=event.clientX});
    root.querySelector('[data-video-stage]').addEventListener('pointerup',event=>{
      if(startX===null)return;
      const delta=event.clientX-startX;
      startX=null;
      if(Math.abs(delta)<44)return;
      move(delta<0?1:-1);
    });
    root.querySelector('[data-video-stage]').addEventListener('pointercancel',()=>{startX=null});
    render();
  }

  function move(step){
    const set=currentSet();
    let pos=set.indexOf(active);
    if(pos<0)pos=0;
    active=set[(pos+step+set.length)%set.length];
    render();
  }

  function selectCategory(key){
    const next=GROUPS.find(group=>group.key===key);
    if(!next)return;
    category=next.key;
    active=next.indexes[0];
    render();
  }

  function ringDelta(pos,activePos,length){
    let delta=pos-activePos;
    if(delta>length/2)delta-=length;
    if(delta<-length/2)delta+=length;
    return delta;
  }

  function renderCategories(root){
    const nav=root.querySelector('[data-video-categories]');
    nav.innerHTML=GROUPS.map(group=>`<button type="button" class="${group.key===category?'on':''}" data-video-category="${group.key}"><span>${group.label}</span><small>${pad(group.indexes.length)}</small></button>`).join('');
    nav.querySelectorAll('[data-video-category]').forEach(button=>button.addEventListener('click',()=>selectCategory(button.dataset.videoCategory)));
  }

  function render(){
    const root=section();
    if(!root)return;
    renderCategories(root);
    const set=currentSet();
    if(!set.includes(active))active=set[0];
    const activePos=set.indexOf(active);
    const stage=root.querySelector('[data-video-stage]');
    const visible=[];
    set.forEach((postIndex,pos)=>{
      const delta=ringDelta(pos,activePos,set.length);
      if(Math.abs(delta)<=2)visible.push({postIndex,delta});
    });
    stage.innerHTML=visible.map(({postIndex,delta})=>{
      const post=POSTS[postIndex];
      const isActive=delta===0;
      return `<article class="home-video-card ${isActive?'is-active':''}" data-offset="${delta}" data-video-index="${postIndex}" aria-hidden="${isActive?'false':'true'}">
        <div class="home-video-embed-wrap">
          <iframe src="https://www.instagram.com/reel/${post.code}/embed/" loading="lazy" allowfullscreen title="77waxing Instagram 影片 ${pad(postIndex+1)}"></iframe>
          ${isActive?'':`<button type="button" class="home-video-card-select" data-select-video="${postIndex}" aria-label="切換到第 ${postIndex+1} 支影片"></button>`}
        </div>
      </article>`;
    }).join('');
    stage.querySelectorAll('[data-select-video]').forEach(button=>button.addEventListener('click',()=>{active=Number(button.dataset.selectVideo);render()}));

    root.querySelector('[data-video-frame]').textContent=`FRAME ${pad(active+1)}`;
    root.querySelector('[data-video-count]').textContent=`${pad(activePos+1)} / ${pad(set.length)}`;
    const original=root.querySelector('[data-video-original]');
    original.href=POSTS[active].url;

    const dots=root.querySelector('[data-video-dots]');
    dots.innerHTML=set.map((postIndex,pos)=>`<button type="button" class="${postIndex===active?'on':''}" data-dot-video="${postIndex}" aria-label="第 ${pos+1} 支影片"></button>`).join('');
    dots.querySelectorAll('[data-dot-video]').forEach(button=>button.addEventListener('click',()=>{active=Number(button.dataset.dotVideo);render()}));
  }

  const observer=new MutationObserver(()=>mount());
  observer.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
