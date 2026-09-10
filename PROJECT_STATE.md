# 77waxing｜不可回歸功能基準

> 每次修改本專案前，先閱讀本檔。除非使用者明確要求移除，以下功能都必須保留。完成修改後，必須檢查本清單，避免修正一項功能時讓其他已完成項目消失。

## 正式環境

- 正式前台：GitHub Pages `/77-waxing-site/`
- 正式預約：GitHub Pages `/77-waxing-site/booking/`
- 正式管理後台：GitHub Pages `/77-waxing-site/admin/`
- Firebase Authentication + Cloud Firestore 為正式資料層。
- Repo 內 Next.js 程式為既有資產／相容性 build；正式 GitHub Pages 功能不可因 Next.js 修改而被覆蓋。

## Email 不可回歸項目

- 信件寄件者維持 `77waxing.mail@gmail.com` / 顯示名稱 `77waxing`。
- 信件底部必須顯示 77waxing 品牌橫幅，整張橫幅可點擊前往官方網站。
- 手機 Gmail 中，footer 必須是「信件正文內的圖片」，不可另外出現附件／文件卡片。
- 因此正式 footer 不使用 `GmailApp.inlineImages` / CID MIME 圖片；使用公開 HTTPS 圖片 URL 置於 `<img>`。
- Email footer 顯示寬度上限為 680px；來源圖至少維持 2× 像素密度（>=1360px 寬）以保持文字清楚。
- 目前品牌視覺：金色海岸／夕陽／燈塔、左側 77waxing 與 77美學工作室、中間手寫標語、地址、右上角放大的「77waxing 官方網站 →」。
- 更新圖片時使用新檔名或 cache-busting query，避免 Gmail 圖片快取沿用舊版。

## 管理後台不可回歸項目

### 預約時間

- 預約管理每一筆都要清楚顯示「開始時間–服務結束時間」，例如 `11:00–12:30`。
- 服務結束時間以 `actualDurationMinutes` 優先，其次 `durationMinutes` 計算。
- 整理緩衝與服務結束時間分開；若有額外鎖定，可另外顯示「保留至 HH:MM」。
- 舊資料若缺 duration，需從 lockTimes 或 slotStart/slotEnd 扣除 buffer 推算，不能退化成只顯示開始時間。
- 行事曆與編輯區也應盡量維持開始–結束顯示。

### 刪除

- 預約管理每一筆預約都必須有「刪除」按鈕，不因狀態為待確認／待付款／已確認／完成／取消而消失。
- 永久刪除前必須二次確認。
- 刪除 booking 時，必須同步刪除該 booking 的 `availabilityLocks`（依 `lockIds`），釋放被占用時段。
- 「取消預約」與「永久刪除」是兩個不同功能，兩者都要保留。
- 顧客資料既有的刪除顧客功能不可因預約刪除功能調整而消失。

## 目前保護層

- `assets/admin-time-range.js`：既有時間區間增強。
- `assets/admin-record-actions.js`：既有預約／顧客刪除功能。
- `assets/admin-critical-preserve.js`：最後載入的保護層，DOM 被其他管理腳本重繪後會再次補回時間區間與預約刪除按鈕。

## 修改規則

1. 修改前先比對本檔與目前正式頁面所使用的檔案。
2. 不為了單一視覺／Email 修正而重寫或移除後台功能。
3. 靜態管理後台新增腳本時，要注意載入順序與 cache-busting。
4. 每次 push 後檢查 JavaScript syntax、Next.js build（若被觸發）與 GitHub Pages deploy。
5. 若需求新增或既有功能被指定為不可遺失，立即更新本檔。

## 2026-09-11 正式基準

- Email Apps Script source：`apps-script/Code.gs` v25。
- 正式 Email footer：`assets/email-footer-77waxing-v25.jpg`，以公開 HTTPS `<img>` 顯示於正文；禁止改回 CID / `inlineImages`，避免手機 Gmail 出現附件卡片。
- 管理後台 `admin/index.html` 必須最後載入 `assets/admin-critical-preserve.js`，並保留 `admin-time-range.js`、`admin-record-actions.js`。
- 目前 admin cache-busting 基準為 `20260911-0048`，用來避免瀏覽器繼續使用遺失時間區間／刪除按鈕的舊快取。
- 任何 Email、圖片、後台 UI 更新完成後，都必須再次驗證：① Gmail footer 在正文內、無附件卡片；② 預約時間為開始–結束；③ 每筆預約都有永久刪除功能。

## 2026-09-10 最新需求

- 修正手機 Gmail 的 CID 圖片被顯示成附件問題：改回公開 HTTPS 高解析 footer 圖片。
- 恢復並固定保留管理後台的開始–結束時間。
- 恢復並固定保留每筆預約永久刪除功能。
