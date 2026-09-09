(()=>{
  const B='/77-waxing-site';
  const app=document.querySelector('#app');
  if(!app)return;
  const currentPath=()=>{
    let p=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
    if(!p.startsWith('/'))p='/'+p;
    if(p!=='/'&&!p.endsWith('/'))p+='/';
    return p;
  };
  const scrollToHash=()=>{
    const id=decodeURIComponent((location.hash||'').replace(/^#/,''));
    if(!id)return;
    requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}));
  };
  const enhance=()=>{
    if(currentPath()!=='/about/')return;
    const hero=app.querySelector('.pagehero');
    if(!hero)return;
    hero.id='philosophy';
    if(!app.querySelector('#first-visit')){
      app.insertAdjacentHTML('beforeend',`<section class="section soft" id="first-visit"><div class="wrap narrow"><span class="tag">FIRST VISIT</span><h2>首訪的你</h2><p>第一次來店前，可以先知道接待、需求確認、服務前說明、施作與術後照護會怎麼進行。</p><ol class="flow"><li><b>抵達與接待</b><small>確認預約項目與當天身體狀況。</small></li><li><b>需求諮詢</b><small>第一次、怕痛或有特別在意的地方都可以先說。</small></li><li><b>服務前說明</b><small>開始前確認服務範圍與流程。</small></li><li><b>一對一施作</b><small>過程中有任何不適都可以即時調整。</small></li><li><b>術後照護</b><small>完成後確認居家照護方式與後續建議。</small></li></ol></div></section>`);
    }
    if(!app.querySelector('#xiaobai')){
      app.insertAdjacentHTML('beforeend',`<section class="section" id="xiaobai"><div class="wrap narrow"><span class="tag">XIAOBAI XIAOBAI</span><h2>小白小白</h2><p class="muted">這個區塊已先建立，正式內容確認後會在這裡更新。</p></div></section>`);
    }
    scrollToHash();
  };
  new MutationObserver(()=>queueMicrotask(enhance)).observe(app,{childList:true,subtree:false});
  window.addEventListener('popstate',()=>setTimeout(enhance,0));
  window.addEventListener('hashchange',scrollToHash);
  setTimeout(enhance,0);
})();
