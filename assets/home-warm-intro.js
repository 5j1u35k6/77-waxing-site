(()=>{
  const B='/77-waxing-site';
  const KEY='77waxing-brand-intro-v5-seen';
  const path=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
  if(path!=='/'&&path!=='')return;
  try{if(sessionStorage.getItem(KEY)==='1')return;}catch{}

  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`${B}/assets/home-warm-intro.css?v=20260911-1015`;
  document.head.appendChild(link);

  const root=document.createElement('section');
  root.id='brandIntro';
  root.setAttribute('aria-label','77waxing 開場動畫');
  root.innerHTML=`<button class="brand-intro-skip" type="button" data-brand-skip>略過</button><div class="brand-intro-stage" aria-hidden="true"><div class="brand-intro-mark"><span class="brand-intro-base"><b>77</b>waxing</span><span class="brand-intro-lit"><b>77</b>waxing</span><span class="brand-intro-sheen"></span></div></div>`;
  document.body.appendChild(root);

  const prevOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timers=[];
  let finished=false;
  let started=false;

  const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
  const finish=()=>{
    if(finished)return;
    finished=true;
    timers.forEach(clearTimeout);
    try{sessionStorage.setItem(KEY,'1')}catch{}
    document.body.style.overflow=prevOverflow;
    root.remove();
  };
  const exit=()=>{
    if(finished)return;
    root.classList.add('is-exiting');
    later(finish,reduced?180:600);
  };
  const start=()=>{
    if(started||finished)return;
    started=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(reduced){
        root.classList.add('is-logo-lit','is-reveal');
        later(exit,180);
        return;
      }
      later(()=>root.classList.add('is-logo-lit'),90);
      later(()=>root.classList.add('is-reveal'),4450);
      later(exit,5240);
    }));
  };

  root.querySelector('[data-brand-skip]')?.addEventListener('click',exit);
  link.addEventListener('load',start,{once:true});
  later(start,220);
})();