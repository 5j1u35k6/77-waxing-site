(()=>{
  const B='/77-waxing-site';
  const app=document.querySelector('#app');
  if(!app)return;

  const copy={
    '/services/women-waxing/':{
      intro:'今次嘅妳想改變啲咩呢？77waxing幫妳實現願望。',
      remove:['依你提供的女性熱蠟價目表整理。']
    },
    '/services/men-waxing/':{
      intro:'唔使怕醜！專業嘅77waxing一樣可以令你變得更型、更有自信！',
      remove:['依你提供的男士熱蠟價目表整理。']
    },
    '/services/skin-care/':{
      intro:'交俾77waxing，等每一次保養都更靠近妳鍾意嘅自己一啲。',
      remove:['依臉部價目表的服務名稱整理。']
    },
    '/services/bust-care/':{
      intro:'照顧曲線，都照顧自己嘅感受。等77waxing陪妳慢慢搵返自信。',
      remove:['依你提供的美胸價目表整理。']
    }
  };

  const path=()=>{
    let p=location.pathname.startsWith(B)?location.pathname.slice(B.length):location.pathname;
    if(!p.startsWith('/'))p='/'+p;
    if(p!=='/'&&!p.endsWith('/'))p+='/';
    return p;
  };

  const apply=()=>{
    const setting=copy[path()];
    if(!setting)return;
    const lead=app.querySelector('.catalog-hero .lead');
    if(lead&&lead.textContent!==setting.intro)lead.textContent=setting.intro;
    app.querySelectorAll('.service-group-head > p.muted').forEach((p)=>{
      if(setting.remove.includes(p.textContent.trim()))p.remove();
    });
  };

  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;apply();});
  };
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  addEventListener('popstate',()=>setTimeout(apply,0));
  document.addEventListener('click',()=>setTimeout(apply,0),true);
  apply();
})();
