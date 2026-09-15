(()=>{
  const TARGETS = new Set([
    "庫存在管理員確認訂單時才以 Firestore transaction 原子扣減；取消已確認訂單時自動回補。",
    "商品可建立多個規格、TW/HK 獨立售價、規格庫存、數量優惠，以及多張規格對應圖片。",
    "促銷設定獨立儲存，不改商品、圖片、規格與購物車既有程式。",
  ]);

  let scheduled = false;

  function removeTargetCopy() {
    scheduled = false;
    document.querySelectorAll("#admin-app .order-date").forEach((node) => {
      if (TARGETS.has(node.textContent.trim())) node.remove();
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(removeTargetCopy);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
