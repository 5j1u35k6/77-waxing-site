# 77waxing 產品訂購：複製後待調整清單

`/shop/` 與 `/shop/admin.html` 目前是由 `5j1u35k6/zizhen-sweets` 複製的第一版基底。品牌名稱已改為 77waxing，資料 namespace 改為 `77waxing-shop`，避免與原站資料路徑混用。

## 優先處理
- Firebase：目前暫用複製來源的 Firebase project，只用 `77waxing-shop` namespace 隔離；後續移至 77waxing 專用 commerce backend 或整合 `waxing-86909`。
- Firestore Security Rules：依 products / orders / questions / admin roles 重做規則。
- 後台權限：建立真正的 admin allowlist 或 role claim；`shop/admin.html` 已 noindex，但網址仍可被知道。
- 商品資料：新 namespace 起初沒有 77waxing 商品，需要在後台建立或匯入。
- 法務資訊：原站食品登錄字號已移除；需補 77waxing 正確賣家資料、隱私權、退換貨/取消、付款與配送條款。

## 品牌與內容
- Hero、圖片與多數內容仍是甜點模板語境，後續換成 77waxing 實際產品。
- 「所有甜點／甜點目錄／甜蜜包裹／廚房備料」等詞需改成產品語境。
- 商品分類、成分欄位、圖片比例、卡片文案依實際產品重做。
- 色彩可再統一到 77waxing 米色／棕金品牌系統。

## 訂購流程
- 確認是否保留 Google 登入與匿名 fallback。
- 目前配送選項為自取、7-11、全家且超商費固定 60 元；需改成實際物流規則。
- 目前付款是靜態選項，尚未串正式金流。
- 檢查訂單編號、庫存扣減、物流編號、取消狀態的併發與資料完整性。
- 串接 77waxing 顧客／管理員訂單通知。

## 後台與營運
- 商品圖片目前以 Base64 存 Firestore，商品量增加後改 Storage/CDN。
- 儀表板補日期篩選、匯出、退款／取消統計。
- 商品、訂單、顧客問答功能已複製，但欄位與狀態要依 77waxing 營運調整。
- 加入錯誤監控、操作紀錄與 SEO／分享 metadata。
