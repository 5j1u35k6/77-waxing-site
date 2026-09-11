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

### 顧客快速資料

- 預約管理的「顧客」姓名必須可以點擊。
- 點擊後顯示聯絡資訊，版型為：第一列「姓名／電話／性別」，第二列「信箱／LINE ID」，下方顯示此顧客更早的預約紀錄。
- 舊資料的性別若仍寫在備註 `[性別] ...`，顧客快速資料仍需能解析顯示。
- 預約表「客別」固定只顯示一個字：`新` 或 `舊`。

### 後台功能命名與時段功能

- 後台側欄在「顧客資料」後固定依序顯示：`服務功能`、`時段功能`、`價格功能`、`網站設定`；不得再出現「服務管理／價格管理」或重複的「網站設定」。
- 「服務功能」維持既有服務分類／項目管理；「價格功能」維持既有價格調整。
- 「時段功能」可依日期將單一 30 分鐘時段或整天空白時段設定為「其他行程／休息／私人行程／暫停預約」，也可以恢復開放。
- 店家手動時段保留存於 `settings/availability_YYYY-MM-DD`，欄位 `blockedTimes`；沿用既有 `settings/{settingId}` 管理員寫入權限，不新增未部署的 Firestore rule 依賴。
- 店家手動解除時段只解除店家設定，不得釋放既有顧客 booking lock。
- `網站設定 > 每日最早可約時間` 的選項從 `08:00` 開始；若尚未設定，預設值為 `08:00`。
- 正式預約時段來源也必須支援 `08:00` 起每 30 分鐘一格，不能只改後台下拉選單而讓前端仍從 10:00 開始。

## 前端預約時段不可回歸項目

- `availabilityLocks.state == held`：時段仍顯示但不可點，使用黃色，不在時段內顯示「保留中」文字。
- 已確認預約原本隱藏的開始時段必須改為顯示灰色且不可點，不顯示狀態說明文字。
- 店家透過「時段功能」設定的休息／其他行程，同樣顯示灰色且不可點，不顯示原因文字。
- 店家手動保留需依服務實際占用區間做重疊判定，不能只檢查單一起始 30 分鐘。
- 若顧客已選的時段之後被店家封鎖，進入下一步或送出前必須阻止使用舊選擇並要求重選。

## 目前保護層

- `assets/admin-time-range.js`：既有時間區間增強。
- `assets/admin-record-actions.js`：既有預約／顧客刪除功能。
- `assets/admin-critical-preserve.js`：最後載入的保護層，DOM 被其他管理腳本重繪後會再次補回時間區間與預約刪除按鈕。
- `assets/admin-functions.js` + `assets/admin-functions.css`：顧客快速資料、`新／舊` 客別、服務／價格功能命名、時段功能。
- `assets/admin-menu-settings-fix.js`：最後正規化側欄順序／文字，並確保網站設定最早時間可選 08:00。
- `assets/booking-slot-status.js` + `assets/booking-slot-status.css`：前端黃色保留、灰色已約／店家保留與手動封鎖同步。

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
- Email／時間／刪除基準 cache-busting 為 `20260911-0048`；顧客快速資料、時段功能與前端時段顏色基準為 `20260911-0841`；側欄文字／08:00 起始設定正規化基準為 `20260911-0854`。
- 預約時段資料源已由 `10:00` 前移至 `08:00`，相關正式腳本（含 `admin-v2.js`、`booking-v3.js`、`firebase-pages.js`、`runtime-settings.js`、`booking-slot-status.js`、`admin-functions.js`）需維持此基準。
- 任何 Email、圖片、後台 UI 更新完成後，都必須再次驗證：① Gmail footer 在正文內、無附件卡片；② 預約時間為開始–結束；③ 每筆預約都有永久刪除功能；④ 顧客姓名可點出聯絡／歷史資料；⑤ 客別只顯示新／舊；⑥ 時段功能仍可封鎖與恢復；⑦ 前端 held 黃色、confirmed/manual 灰色；⑧ 側欄順序為服務功能／時段功能／價格功能／網站設定；⑨ 網站設定與前端時段可從 08:00 開始。

## 2026-09-10 最新需求

- 修正手機 Gmail 的 CID 圖片被顯示成附件問題：改回公開 HTTPS 高解析 footer 圖片。
- 恢復並固定保留管理後台的開始–結束時間。
- 恢復並固定保留每筆預約永久刪除功能。
