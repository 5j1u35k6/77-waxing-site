(()=>{
  const B='/77-waxing-site';
  const KEY='77waxing-warm-intro-seen';
  const path=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
  if(path!=='/'&&path!=='')return;
  try{if(sessionStorage.getItem(KEY)==='1')return;}catch{}

  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`${B}/assets/home-warm-intro.css?v=20260909-2236`;
  document.head.appendChild(link);

  const root=document.createElement('section');
  root.id='warmIntro';
  root.setAttribute('aria-label','77waxing 開場動畫');
  root.innerHTML=`<button class="warm-skip" type="button" data-warm-skip>略過</button><div class="warm-intro-copy"><small>77WAXING · WARM LIGHT</small><h1>今日，都留一點時間俾自己。</h1><p>輕輕拉一下，點亮 77waxing。</p><p class="warmline" data-warm-line>準備好喇，等77waxing好好照顧妳。</p></div><div class="warm-lamp-wrap"><div class="warm-glow" data-warm-glow></div><div class="warm-lamp" data-warm-lamp><div class="warm-shade"></div><div class="warm-stem"></div><div class="warm-base"></div><button class="warm-cord-hit" type="button" aria-label="拉一下燈繩，點亮 77waxing" data-warm-hit><span class="warm-cord" data-warm-cord></span><span class="warm-knob" data-warm-knob></span></button></div></div>`;
  document.body.appendChild(root);
  const prevOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';

  const finish=()=>{
    try{sessionStorage.setItem(KEY,'1')}catch{}
    document.body.style.overflow=prevOverflow;
    root.remove();
  };
  const skip=root.querySelector('[data-warm-skip]');
  const hit=root.querySelector('[data-warm-hit]');
  const cord=root.querySelector('[data-warm-cord]');
  const knob=root.querySelector('[data-warm-knob]');
  const lamp=root.querySelector('[data-warm-lamp]');
  const glow=root.querySelector('[data-warm-glow]');
  const line=root.querySelector('[data-warm-line]');
  let running=false;

  skip.addEventListener('click',finish);
  hit.addEventListener('click',()=>{
    if(running)return;
    running=true;
    hit.disabled=true;
    try{sessionStorage.setItem(KEY,'1')}catch{}
    const g=window.gsap;
    if(!g){
      root.style.transition='opacity .45s ease,background-color .45s ease';
      root.style.background='#F9F6F0';
      setTimeout(()=>{root.style.opacity='0';setTimeout(finish,460)},520);
      return;
    }
    const tl=g.timeline({defaults:{ease:'power2.out'}});
    tl.to(cord,{scaleY:1.26,duration:.16},0)
      .to(knob,{y:31,duration:.16},0)
      .to(lamp,{rotation:1.8,duration:.16,transformOrigin:'50% 10%'},0)
      .to(cord,{scaleY:1,duration:.33,ease:'elastic.out(1,.42)'},.16)
      .to(knob,{y:0,duration:.33,ease:'elastic.out(1,.42)'},.16)
      .to(lamp,{rotation:-1.1,duration:.25},.16)
      .to(lamp,{rotation:0,duration:.42,ease:'elastic.out(1,.55)'},.35)
      .to(glow,{opacity:1,scale:1,duration:.62},.2)
      .to(root,{backgroundColor:'#51493f',duration:.55},.22)
      .to(line,{opacity:1,y:-4,duration:.48},.66)
      .to(glow,{scale:4.8,opacity:.98,duration:1.05,ease:'power2.inOut'},1.25)
      .to(root,{backgroundColor:'#F9F6F0',duration:.72},1.36)
      .to(root,{autoAlpha:0,duration:.52,onComplete:finish},2.05);
  });
})();