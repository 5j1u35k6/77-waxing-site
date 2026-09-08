(()=>{
  const LEGACY_STORE='77waxing-preview-bookings-v2';
  try{localStorage.removeItem(LEGACY_STORE)}catch{}

  const loadingBooking=`<div class="firebase-state info">正在載入 Firebase 預約資料…</div>`;
  const loadingAdmin=`<main class="dash admin-setup"><span class="tag">FIREBASE ADMIN</span><h2>正在載入管理員登入…</h2><p class="muted">正式後台會使用 Firebase Authentication 登入，不再顯示瀏覽器本機示範資料。</p></main>`;

  function prepare(){
    const booking=document.querySelector('#booking');
    if(booking&&!booking.dataset.firebaseMounted&&!booking.dataset.firebaseBootstrap){
      booking.dataset.firebaseBootstrap='1';
      const preview=booking.parentElement?.querySelector(':scope > .preview');
      if(preview)preview.remove();
      booking.innerHTML=loadingBooking;
    }

    const admin=document.querySelector('#admin-preview');
    if(admin&&!admin.dataset.firebaseMounted&&!admin.dataset.firebaseBootstrap){
      admin.dataset.firebaseBootstrap='1';
      admin.innerHTML=loadingAdmin;
    }
  }

  const app=document.querySelector('#app');
  if(app)new MutationObserver(()=>queueMicrotask(prepare)).observe(app,{childList:true,subtree:true});
  prepare();

  window.setTimeout(()=>{
    const booking=document.querySelector('#booking');
    if(booking&&!booking.dataset.firebaseMounted){
      booking.innerHTML='<div class="firebase-state warning">Firebase 模組尚未完成載入。請重新整理一次；若仍出現此訊息，請回報這個畫面。</div>';
    }
    const admin=document.querySelector('#admin-preview');
    if(admin&&!admin.dataset.firebaseMounted){
      admin.innerHTML='<main class="dash admin-setup"><span class="tag">FIREBASE LOAD ERROR</span><h2>管理員登入尚未載入</h2><p>請重新整理一次；若仍出現此畫面，代表 Firebase 模組未成功啟動。</p></main>';
    }
  },8000);
})();
