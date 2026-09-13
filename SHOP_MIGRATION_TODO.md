# 77waxing 產品訂購遷移狀態

> 2026-09-13：原本由 `5j1u35k6/zizhen-sweets` 複製的暫存架構已完成第一階段正式遷移。`/shop/` 不再引用 `zizhen-sweets` Firebase，也不再使用原甜點站的前後台程式。

## 已完成

- [x] **Firebase 專案遷移**：前台、後台統一改用 77waxing Firebase project `waxing-86909`，共用 `assets/firebase-config.js`。
- [x] **部署目標鎖定**：新增 `.firebaserc`，預設 Firebase project 固定為 `waxing-86909`，降低誤部署到其他 project 的風險。
- [x] **公開端 Auth 隔離**：Shop 前台使用 77waxing 已有的 `77waxing-public` named Firebase app + 匿名 Auth，不與管理後台登入 session 共用。
- [x] **管理員權限**：Shop 後台使用 Email/Password 登入，並以 `admins/{uid}` 判斷管理員；單純知道 `/shop/admin.html` 網址不能取得後台資料。
- [x] **Firestore Security Rules**：新增 `shopProducts`、`shopOrders`、`shopMessages`、`shopSettings`、`shopAuditLogs` 規則；顧客只能建立自己的待確認訂單、讀自己的訂單／留言，商品只有管理員可寫入，庫存與訂單狀態只有管理員可修改。
- [x] **庫存一致性**：顧客送單時不直接扣庫存；管理員「確認訂單」時用 Firestore transaction 重新讀商品、驗證上架狀態與庫存、重算價格並原子扣庫存。取消已確認訂單時以 transaction 回補庫存。
- [x] **訂單編號**：改為 `77W-YYYYMMDD-XXXXXX`，使用 Firestore document id 片段避免原本掃描當日訂單後自行加流水號的併發問題。
- [x] **商品管理**：後台可新增、編輯、上下架、排序、調整價格與庫存、永久刪除商品；已存在的訂單保留商品快照。
- [x] **商品圖片**：不再把 Base64 圖片塞進 Firestore；商品改存公開 HTTPS 圖片 URL，可使用 Firebase Storage/CDN 或其他正式圖片來源。
- [x] **配送與運費**：自取、7-11、全家改為後台開關；7-11／全家費用可分別設定，不再硬寫固定 60 元。初始只開啟工作室自取，避免未確認物流條件就直接對外承諾。
- [x] **付款策略**：目前正式流程只提供後台可控制的「自取付款／銀行轉帳」；網站明確不收集信用卡卡號。日後若決定金流商，再另外串 API，不假裝目前已有線上刷卡。
- [x] **訂單流程**：`待確認 → 已確認 → 備貨中 → 待自取／已出貨 → 已完成`，並支援取消與物流編號。
- [x] **訂單查詢**：顧客可在同一匿名身分下查看自己的訂單；後台可依狀態／日期篩選並匯出 CSV。
- [x] **顧客問答**：前台可留言並查看自己的紀錄，後台可回覆；權限依 owner UID 隔離。
- [x] **通知程式**：`apps-script/Code.gs` 已加入產品訂單 Email 分流與去重，支援新訂單、確認、備貨、自取、出貨、完成、取消通知；沿用 77waxing 店家信箱與既有 Email footer。
- [x] **操作紀錄**：Shop 後台的重要商品／訂單／設定／回覆操作會寫入 `shopAuditLogs`。
- [x] **基本錯誤紀錄**：前台與後台加入全域 JS error / unhandled promise logging，重要操作在 UI 顯示失敗訊息。
- [x] **SEO 與後台索引**：前台補 title / description / Open Graph 基本資料；後台保留 `noindex,nofollow,noarchive`。
- [x] **法務與商業資訊**：移除所有子珍甜點、食品字號與甜點商業資訊；新增 `/shop/policies.html`，說明訂單成立、付款、交付、取消／瑕疵處理、個資使用與匿名裝置訂單紀錄。
- [x] **品牌與內容脫鉤**：原「甜點目錄／所有甜點／甜蜜包裹／廚房備料」等模板語境已從正式 Shop 程式移除；前台改為 77waxing 中性產品訂購版型，實際商品由後台新增。
- [x] **色彩與介面**：Shop 前後台改用 77waxing 米色／棕金／暖灰系統，不再直接沿用甜點站視覺。
- [x] **首頁入口游標**：`立即預約` 與 `產品訂購` 都視為獨立 CTA；首頁滑動游標不會移到這兩顆按鈕上。手機選單順序也固定為立即預約後再產品訂購。

## 正式上線前的外部部署動作

以下不是程式碼待辦，而是 Firebase / Apps Script 服務端必須實際發布一次，GitHub commit 本身不會自動改變線上服務：

1. **部署 Firestore Rules 到 `waxing-86909`**
   - Repository 已將 `firebase.json` 指向 `firebase/firestore.rules`，且 `.firebaserc` 已固定 project。
   - 執行正式部署後，Shop 才能依新規則建立／讀取資料。

2. **確認 Firebase Authentication 已啟用 Anonymous 與 Email/Password**
   - Anonymous：Shop 前台與既有預約前台使用。
   - Email/Password：Shop 後台與既有管理後台使用。

3. **確認至少一個管理員存在於 `admins/{uid}`**
   - Shop 後台沿用既有 77waxing 管理員 ACL，不另外建立不安全的前端 allowlist。

4. **重新部署既有 Google Apps Script Web App**
   - Repository 的 `apps-script/Code.gs` 已更新為 v26；必須把新版 Code.gs 發布到目前 Email Web App deployment，產品訂單 Email 才會開始寄送。

## 資料處理原則

- **沒有把子珍甜點商品、訂單、留言搬進 77waxing Firebase。** 這是刻意的：避免甜點資料污染正式 77waxing 商店。
- 新的 `shopProducts` 初始可為空；由 `/shop/admin.html` 建立 77waxing 真正要販售的商品即可。
- 舊 `zizhen-sweets` Firebase 金鑰與 project id 已不再出現在正式 `/shop/` 前台／後台程式中。

## 後續只有在確定營運需求後才做

- 串正式線上金流（需要先決定金流商、商店帳號與退款流程）。
- 串正式超商物流 API／電子託運單（需要先決定物流服務商與合約）。
- 商品圖片若確認使用 Firebase Storage，再把目前的「HTTPS URL」欄位接成後台直接上傳；現行資料模型不需要重做。
- 若未來要跨裝置查看訂單，可再從匿名 Auth 升級成 Email link／Google 帳號綁定；目前先維持最低摩擦的裝置型匿名帳號。
