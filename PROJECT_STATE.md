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

### 總覽指標語意

- 「概論 > 待確認」只計算 `status == pending_confirmation` 的預約。
- 「營運總覽 > 待處理」是較大的人工處理區塊，包含「待確認」(`pending_confirmation`) 與「待收訂金／待付款」(`pending_payment`)；兩者不是同一個數字概念。
- 不得把「待處理」誤改成只等於待確認；若要顯示待處理總數，應為待確認＋待付款。

### 後台功能命名與時段功能

- 後台側欄在「顧客資料」後固定依序顯示：`服務功能`、`時段功能`、`價格功能`、`網站設定`；不得再出現「服務管理／價格管理」或重複的「網站設定」。
- 以上四個項目必須由 `firebase-pages.js` 原生產生並由 `admin-v2.js` 直接綁定路由，不可再靠後置腳本依位置改文字或隱藏連結。
- `assets/admin-ux.js` 若需正規化側欄，只能依 `#dashboard/#bookings/#calendar/#customers/#services/#slots/#pricing/#settings` 路由辨識；禁止依 DOM 位置改文字，且必須自動移除重複路由連結。
- 「服務功能」維持既有服務分類／項目管理；「價格功能」維持既有價格調整。
- 「時段功能」可依日期將單一 30 分鐘時段或整天空白時段設定為「其他行程／休息／私人行程／暫停預約」，也可以恢復開放。
- 「時段功能」日期區只保留左側自訂日期按鈕；原生 `date` 輸入欄只作資料同步且必須隱藏，不可同時顯示兩個日期欄位。點擊左側日期按鈕後才開啟與後台風格一致的小型卡片式月曆視窗，選擇日期後自動關閉。
- 「時段功能」日期可選範圍必須與正式前端預約月曆一致：以台北時區計算，今天與所有過去日期都不可選，最早可選日期為明天；過期日期應保留在月曆上但顯示禁用狀態，且不可透過切月回到早於最早可選月份。
- 店家手動時段保留存於 `settings/availability_YYYY-MM-DD`，欄位 `blockedTimes`；沿用既有 `settings/{settingId}` 管理員寫入權限，不新增未部署的 Firestore rule 依賴。
- 店家手動解除時段只解除店家設定，不得釋放既有顧客 booking lock。
- `網站設定 > 每日最早可約時間` 的選項從 `08:00` 開始；若尚未設定，預設值為 `08:00`。
- 正式預約時段來源也必須支援 `08:00` 起每 30 分鐘一格，不能只改後台下拉選單而讓前端仍從 10:00 開始。

## 前端預約時段不可回歸項目

- 正式預約月曆以台北時區判斷日期，今天與所有過去日期不可選，最早可選日期為明天。
- `availabilityLocks.state == held`：時段仍顯示但不可點，使用黃色，不在時段內顯示「保留中」文字。
- 已確認預約原本隱藏的開始時段必須改為顯示灰色且不可點，不顯示狀態說明文字。
- 店家透過「時段功能」設定的休息／其他行程，同樣顯示灰色且不可點，不顯示原因文字。
- 店家手動保留需依服務實際占用區間做重疊判定，不能只檢查單一起始 30 分鐘。
- 若顧客已選的時段之後被店家封鎖，進入下一步或送出前必須阻止使用舊選擇並要求重選。

## 前端服務／價目資料不可回歸項目

- 正式服務頁與價目頁只能由 `assets/catalog-dynamic.js` 一套 renderer 產生；不得再恢復 `catalog-v1.js` 先畫靜態舊資料、再由動態資料覆蓋的雙 renderer 架構。
- 已移除 `assets/catalog-v1.js` 與 `assets/catalog-copy-v1.js`；`catalog-v1.css` 僅作正式動態服務頁的樣式表，可保留。
- 手機與桌機進入「服務」四個分類時，不得先閃現缺少項目、錯誤施作時間或其他舊資料，再數秒後更新。
- `catalog-dynamic.js` 使用 `localStorage` key `77waxing-public-catalog-v1` 快取最近一次已確認的公開服務資料：有快取時立即顯示，再由 Firestore 背景更新；沒有快取時只顯示中性的「正在載入最新服務內容…」，不可顯示假資料或舊資料。
- Firestore 最新資料載入後必須更新本機快取，並由 `watchCatalog()` 持續同步後台服務／價格異動。

## 首頁開場動畫不可回歸項目

- 首頁開場不再使用檯燈／拉繩／點燈互動；正式版本為深色背景上的純 `77waxing` 品牌字標動畫。
- 動畫字標使用與首頁左上角 logo 相同的 `Georgia, serif`；深色背景階段 `77` 為金色 `#C5A070`，`waxing` 為淺暖白 `#F9F6F0`。
- 字標以由左到右的掃亮方式完整出現；正式掃亮時間約 `4.28s`，不可因尺寸調整而加速。
- `g` 等 descender 字母在掃亮途中與完整亮起後都必須完整顯示，遮罩不可裁掉下伸筆畫。
- 電腦與手機的動畫字標／掃光範圍維持較收斂版本：約比前一版縮小 7%；白色斜線的垂直活動範圍、寬度與水平行程同步縮小約 5–10%，不得再明顯跑出字標範圍。
- 掃亮完成後才可讓背景由深色漸亮至首頁底色 `#F9F6F0`，再淡出開場層進入首頁；不可在字標掃亮完成前提前轉亮背景。
- 動畫維持每個 browser session 播放一次，保留「略過」與 `prefers-reduced-motion` 相容。
- 正式資產為 `assets/home-warm-intro.js` + `assets/home-warm-intro.css`；目前 cache-busting 基準 `20260911-1015`，session key 為 `77waxing-brand-intro-v5-seen`。

## 目前保護層

- `assets/admin-time-range.js`：既有時間區間增強。
- `assets/admin-record-actions.js`：既有預約／顧客刪除功能。
- `assets/admin-critical-preserve.js`：最後載入的保護層，DOM 被其他管理腳本重繪後會再次補回時間區間與預約刪除按鈕。
- `assets/admin-functions.js` + `assets/admin-functions.css`：顧客快速資料、`新／舊` 客別、時段功能資料操作。
- `assets/admin-slot-calendar.js` + `assets/admin-slot-calendar.css`：時段功能的單一日期按鈕＋小型彈出月曆；透過隱藏的 `data-slot-date` 欄位同步日期，並與前端共用「最早明天」的可選日期規則，不重寫 Firestore 操作。
- `assets/admin-ux.js`：依 hash 路由固定側欄文字／順序並去除重複項目；不得再改回位置式 labels 陣列。
- `assets/booking-slot-status.js` + `assets/booking-slot-status.css`：前端黃色保留、灰色已約／店家保留與手動封鎖同步。
- 已移除舊的 `assets/admin-menu-settings-fix.js`；不得恢復以 DOM 位置重命名／隱藏側欄的做法。

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
- Email／時間／刪除基準 cache-busting 為 `20260911-0048`；顧客快速資料與前端時段顏色基準為 `20260911-0841`；原生側欄路由基準為 `20260911-0904`；`admin-ux.js` 路由式側欄正規化基準為 `20260911-0912`；時段功能彈出式日期月曆基準為 `20260911-0916`；單一日期選項隱藏原生欄位基準為 `20260911-0921`；時段日期「最早明天」同步前端邏輯基準為 `20260911-0924`；首頁品牌字標動畫最新基準為 `20260911-1015`；前端單一動態 catalog 基準為 `20260911-1022`。
- 預約時段資料源已由 `10:00` 前移至 `08:00`，相關正式腳本（含 `admin-v2.js`、`booking-v3.js`、`firebase-pages.js`、`runtime-settings.js`、`booking-slot-status.js`、`admin-functions.js`）需維持此基準。
- 任何 Email、圖片、後台 UI 更新完成後，都必須再次驗證：① Gmail footer 在正文內、無附件卡片；② 預約時間為開始–結束；③ 每筆預約都有永久刪除功能；④ 顧客姓名可點出聯絡／歷史資料；⑤ 客別只顯示新／舊；⑥ 時段功能仍可封鎖與恢復；⑦ 前端 held 黃色、confirmed/manual 灰色；⑧ 側欄順序與點擊路由皆為服務功能／時段功能／價格功能／網站設定，且每個路由只出現一次；⑨ 網站設定與前端時段可從 08:00 開始；⑩ 時段功能只顯示左側日期選項，點擊後彈出小型月曆，選日後自動關閉；⑪ 前端與後台時段月曆都禁止選今天與過去日期，最早可選明天；⑫ 首頁開場維持 `77` 金色、`waxing` 淺暖白、掃亮約 4.28 秒、`g` 不裁切，且桌機／手機掃光範圍縮小約 5–10%；⑬ 手機／桌機服務頁只使用 dynamic catalog，不閃現舊資料或錯誤施作時間。

## 2026-09-10 最新需求

- 修正手機 Gmail 的 CID 圖片被顯示成附件問題：改回公開 HTTPS 高解析 footer 圖片。
- 恢復並固定保留管理後台的開始–結束時間。
- 恢復並固定保留每筆預約永久刪除功能。

## 2026-09-11 舊程式清理基準

- 已移除未被正式頁面載入的舊 runtime／補丁：`admin-catalog-route-bridge.js`、`booking-boot.js`、`booking-display-fix.js`、`booking-prefill-direct.js`。
- 已移除舊首頁實驗資產 `home-intro.css` 與 `/intro-demo/`，正式首頁仍保留目前實際使用的 `home-warm-intro.js/.css`。
- 已移除 Next.js 已被 `booking-wizard-v2.tsx` 取代的 `booking-wizard.tsx`。
- 已移除舊前台靜態 catalog renderer `catalog-v1.js` 與舊文案補丁 `catalog-copy-v1.js`；正式服務／價目只保留 `catalog-dynamic.js`。
- `admin-functions.js` 不再改寫側欄文字或動態插入 `#slots`；側欄唯一來源維持 `firebase-pages.js` + `admin-v2.js`。
- `booking-v3.js` 已移除不再使用的 `booking-boot` 相容碼。
- 一次性舊 footer workflow 與 CI workflow 的整理由 GitHub 連線直接處理，不由 Actions 自我修改。
- v19/v21/v22/v23 等舊 Email footer 圖片暫時保留，因為歷史已寄出的 Email 可能仍直接引用這些公開 URL；刪除會造成舊信件破圖。
- 後續若要刪除任何公開 URL 資產，先確認沒有既有 Email、書籤或外部頁面仍引用。