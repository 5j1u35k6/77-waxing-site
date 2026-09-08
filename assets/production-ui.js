(()=>{
  const REPO_BASE='/77-waxing-site';
  const onGithubPages=location.hostname.endsWith('github.io');
  const bookingUrl=onGithubPages?`${REPO_BASE}/booking/`:'/booking/';
  const siteUrl=onGithubPages?`${REPO_BASE}/`:'/';
  const DURATION_MINUTES=90;

  function setText(node,value){
    if(node&&node.textContent!==value)node.textContent=value;
  }

  function addMinutes(time,amount){
    const [hours,minutes]=String(time||'').split(':').map(Number);
    if(!Number.isFinite(hours)||!Number.isFinite(minutes))return '';
    const total=hours*60+minutes+amount;
    return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }

  function updateBookingSummary(){
    document.querySelectorAll('.summary').forEach((summary)=>{
      const rows=[...summary.children];
      const startRow=rows.find((row)=>row.querySelector('small')?.textContent.trim()==='開始時間');
      const reserveRow=rows.find((row)=>row.querySelector('small')?.textContent.trim()==='預留');
      if(!startRow||!reserveRow)return;
      const start=startRow.querySelector('b')?.textContent.trim();
      const end=addMinutes(start,DURATION_MINUTES);
      if(!end)return;
      setText(reserveRow.querySelector('small'),'結束時間');
      setText(reserveRow.querySelector('b'),`${end}（${DURATION_MINUTES} 分鐘）`);
    });
  }

  function cleanTechnicalCopy(){
    document.querySelectorAll('.firebase-state.ok,.firebase-state.info').forEach((node)=>node.remove());

    document.querySelectorAll('[data-booking-sync]').forEach((node)=>{
      const text=node.textContent||'';
      if(text.includes('正在讀取 Firestore')) setText(node,'正在確認可預約時段…');
      else if(text.startsWith('固定日期範圍：')) setText(node,text.replace('固定日期範圍：','可選日期範圍：'));
      else if(text.includes('無法讀取 Firestore')) setText(node,'目前無法取得可預約時段，請稍後再試。');
    });

    document.querySelectorAll('#booking .muted').forEach((node)=>{
      const text=node.textContent||'';
      if(text.includes('匿名 Firebase')) setText(node,'不用建立會員帳號，填寫資料後即可送出預約需求。');
    });

    document.querySelectorAll('#booking .notice p').forEach((node)=>{
      const text=node.textContent||'';
      if(text.includes('寫入 Firestore')) setText(node,'成功送出後，該時段會先標示為「保留中」，等待 77 確認。');
    });

    document.querySelectorAll('#booking .success p').forEach((node)=>{
      if((node.textContent||'').includes('Firestore')) setText(node,'預約需求已送出，該時段已暫時保留，等待 77 確認。');
    });

    const adminLogin=document.querySelector('.admin-login-card');
    if(adminLogin){
      const description=adminLogin.querySelector('.muted');
      if(description&&(description.textContent||'').includes('Firebase')) setText(description,'請使用管理員帳號登入。');
    }

    document.querySelectorAll('.admin-topline .tag').forEach((node)=>{
      if((node.textContent||'').includes('FIRESTORE')) setText(node,'ADMIN');
    });
    document.querySelectorAll('.firebase-live').forEach((node)=>setText(node,'● 即時同步'));
    document.querySelectorAll('.panel .muted').forEach((node)=>{
      const text=node.textContent||'';
      if(text.includes('Firestore')) setText(node,'待確認會顯示保留中；確認後重疊時段將不再提供預約；取消／完成／未到店會重新釋出時段。');
    });

    document.querySelectorAll('[data-admin-message]').forEach((node)=>{
      const text=node.textContent||'';
      if(text.includes('Firebase Authentication 找不到')) setText(node,'Email 或密碼不正確，請重新確認後再試。');
      else if(text.includes('Email/Password 登入尚未啟用')) setText(node,'目前無法登入，請稍後再試。');
      else if(text.includes('尚未取得後台權限')||text.includes('缺少 admins/')) setText(node,'帳號密碼正確，但目前沒有後台權限，請確認管理員帳號設定。');
      else if(text.includes('正在驗證 Firebase Authentication')) setText(node,'正在登入…');
      else if(text.includes('正在確認後台權限')) setText(node,'正在確認管理員權限…');
    });
  }

  function fixBookingReturn(){
    document.querySelectorAll('#booking .success a,#booking .success button').forEach((control)=>{
      if(!/預約|時段/.test(control.textContent||''))return;
      setText(control,'回到預約頁面');
      if(control.tagName==='A')control.setAttribute('href',bookingUrl);
      control.dataset.bookingReturn='1';
    });
  }

  function enhanceAdminSidebar(){
    const sidebar=document.querySelector('#admin-preview .sidebar');
    const dash=document.querySelector('#admin-preview .dash');
    if(!sidebar||!dash)return;

    const items=[
      ['dashboard','總覽'],
      ['bookings','預約管理'],
      ['calendar','預約行事曆'],
      ['customers','顧客資料'],
      ['services','服務管理'],
      ['pricing','價格管理'],
      ['settings','網站設定'],
    ];
    const links=[...sidebar.querySelectorAll('a')].slice(0,items.length);
    links.forEach((link,index)=>{
      const [key,label]=items[index];
      setText(link,label);
      link.setAttribute('href',`#${key}`);
      link.dataset.adminView=key;
      if(!location.hash)link.classList.toggle('on',key==='dashboard');
    });

    const logout=sidebar.querySelector('[data-admin-logout]');
    if(logout&&!sidebar.querySelector('[data-admin-site-link]')){
      const siteLink=document.createElement('a');
      siteLink.href=siteUrl;
      siteLink.textContent='← 回到網站';
      siteLink.dataset.adminSiteLink='1';
      siteLink.className='admin-site-link';
      sidebar.insertBefore(siteLink,logout);
    }

    let placeholder=dash.querySelector('[data-admin-placeholder]');
    if(!placeholder){
      placeholder=document.createElement('div');
      placeholder.className='panel admin-placeholder';
      placeholder.dataset.adminPlaceholder='1';
      placeholder.hidden=true;
      dash.appendChild(placeholder);
    }

    const metrics=dash.querySelector('.metrics');
    const panel=dash.querySelector('.panel:not(.admin-placeholder)');
    if(panel&&!panel.dataset.originalTitle)panel.dataset.originalTitle=panel.querySelector('h3')?.textContent||'預約與時段狀態';

    links.forEach((link)=>{
      if(link.dataset.boundAdminView==='1')return;
      link.dataset.boundAdminView='1';
      link.addEventListener('click',(event)=>{
        event.preventDefault();
        const view=link.dataset.adminView;
        links.forEach((item)=>item.classList.toggle('on',item===link));
        history.replaceState(null,'',`${location.pathname}#${view}`);

        if(view==='dashboard'||view==='bookings'||view==='calendar'){
          placeholder.hidden=true;
          if(panel)panel.hidden=false;
          if(metrics)metrics.hidden=view!=='dashboard';
          const title=panel?.querySelector('h3');
          const targetTitle=view==='calendar'?'預約行事曆':view==='bookings'?'預約管理':panel?.dataset.originalTitle;
          if(title&&targetTitle)setText(title,targetTitle);
          if(view!=='dashboard')panel?.scrollIntoView({behavior:'smooth',block:'start'});
          else window.scrollTo({top:0,behavior:'smooth'});
          return;
        }

        if(metrics)metrics.hidden=true;
        if(panel)panel.hidden=true;
        const labels={customers:'顧客資料',services:'服務管理',pricing:'價格管理',settings:'網站設定'};
        placeholder.hidden=false;
        const html=`<h3>${labels[view]||'管理功能'}</h3><p class="muted">此功能已保留在後台功能列，接下來會依序補上管理內容。</p>`;
        if(placeholder.innerHTML!==html)placeholder.innerHTML=html;
      });
    });
  }

  function applyAll(){
    updateBookingSummary();
    cleanTechnicalCopy();
    fixBookingReturn();
    enhanceAdminSidebar();
  }

  document.addEventListener('click',(event)=>{
    const returnControl=event.target.closest?.('[data-booking-return],#booking .success a,#booking .success button');
    if(returnControl&&/預約|時段/.test(returnControl.textContent||'')){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.replace(bookingUrl);
      return;
    }

    const anchor=event.target.closest?.('a[href]');
    if(!anchor)return;
    let url;
    try{url=new URL(anchor.href,location.href);}catch{return;}
    if(onGithubPages&&url.origin===location.origin&&url.pathname===bookingUrl&&location.pathname!==bookingUrl){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(bookingUrl);
    }
  },true);

  new MutationObserver(()=>queueMicrotask(applyAll)).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  applyAll();
})();