(()=>{
  const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
  const KEY='77waxing-brand-intro-v6-seen';
  const path=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
  if(path!=='/'&&path!=='')return;
  try{if(sessionStorage.getItem(KEY)==='1')return;sessionStorage.setItem(KEY,'1')}catch{}

  const html=document.documentElement;
  const root=document.createElement('section');
  root.id='brandIntro';
  root.setAttribute('aria-label','77waxing 開場動畫');
  root.innerHTML=`<button class="brand-intro-skip" type="button" data-brand-skip>略過</button><div class="brand-intro-stage" aria-hidden="true"><div class="brand-intro-mark"><span class="brand-intro-base"><b>77</b>waxing</span><span class="brand-intro-lit"><b>77</b>waxing</span><span class="brand-intro-sheen"></span></div></div>`;
  document.body.appendChild(root);

  const prevOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timers=[];
  let watchdog=0;
  let finished=false;
  let started=false;
  let timelineStarted=false;

  const later=(fn,ms)=>{
    const id=setTimeout(fn,ms);
    timers.push(id);
    return id;
  };
  const finish=()=>{
    if(finished)return;
    finished=true;
    timers.forEach(clearTimeout);
    if(watchdog)clearTimeout(watchdog);
    html.classList.remove('brand-intro-pending');
    document.body.style.overflow=prevOverflow;
    root.remove();
  };
  const exit=()=>{
    if(finished)return;
    html.classList.remove('brand-intro-pending');
    root.classList.add('is-exiting');
    later(finish,reduced?180:600);
  };
  const runTimeline=()=>{
    if(timelineStarted||finished)return;
    timelineStarted=true;
    if(reduced){
      root.classList.add('is-logo-lit','is-reveal');
      later(exit,180);
      return;
    }
    later(()=>root.classList.add('is-logo-lit'),90);
    later(()=>root.classList.add('is-reveal'),4450);
    later(exit,5240);
  };
  const start=()=>{
    if(started||finished)return;
    started=true;

    // This timer is deliberately independent of animation frames. Even if a
    // browser suspends transitions/requestAnimationFrame, the homepage unlocks.
    watchdog=setTimeout(finish,6500);

    // Start the same timeline from a normal timer as well as rAF. This avoids a
    // permanently dark intro when the first animation frame is not delivered.
    later(runTimeline,120);
    try{
      requestAnimationFrame(()=>requestAnimationFrame(runTimeline));
    }catch{
      runTimeline();
    }
  };

  root.querySelector('[data-brand-skip]')?.addEventListener('click',exit);
  window.addEventListener('pagehide',finish,{once:true});
  start();
})();
