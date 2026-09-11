# 77waxing｜目前正式基準

> 修改前先閱讀本檔。這裡只記錄「現在仍有效」的產品規則，不保存舊版實作歷史。

## 架構

- 正式站為 GitHub Pages 靜態前台：`/`、`/booking/`、`/admin/`。
- Firebase Authentication + Cloud Firestore 是正式資料層。
- Google Apps Script `apps-script/Code.gs` 負責預約 Email。
- 服務／價目唯一公開 renderer 為 `assets/catalog-dynamic.js`；資料來源為 `services/catalog-main`，並使用瀏覽器快取後再背景同步 Firestore。

## Email

- 寄件顯示名稱為 `77waxing`，店家信箱為 `77waxing.mail@gmail.com`。
- 信件 footer 必須在 Gmail 正文內顯示，不使用 CID/inlineImages 附件 MIME。
- 正式 footer 使用公開 HTTPS 圖片 `assets/email-footer-77waxing-v25.jpg`，整張可點擊回官方網站。

## 預約前台

- 最早可約日期為台北時區的「明天」；今天與過去日期不可選。
- 每 30 分鐘一格；網站設定最早時間可從 `08:00` 開始。
- `held` 顯示黃色且不可點；已確認預約與店家手動封鎖顯示灰色且不可點，時段格不顯示狀態說明文字。
- 服務時間依 catalog 個別項目設定，結束時間依實際 duration 計算；整理緩衝仍納入時段鎖定。
- 顧客選好的時段若之後被占用／封鎖，下一步或送出前必須要求重選。
- 服務頁與價目頁不得先顯示舊資料再覆蓋；首次無快取時只顯示中性載入狀態。

## 管理後台

- 側欄固定：`總覽 → 預約管理 → 預約行事曆 → 顧客資料 → 服務功能 → 時段功能 → 價格功能 → 網站設定`。
- 預約時間必須顯示「開始–服務結束」，例如 `11:00–12:30`。
- 每筆預約必須保留永久「刪除」；永久刪除同步刪除該 booking 的 availability locks。取消與永久刪除是不同操作。
- 預約管理的顧客姓名可點擊，顯示：姓名／電話／性別、Email／LINE ID、過去預約紀錄。
- 客別只顯示 `新` 或 `舊`。
- 「概論 > 待確認」只計算 `pending_confirmation`；「營運總覽 > 待處理」包含待確認與待付款。
- 時段功能只顯示單一自訂日期按鈕；點擊後開小型月曆，選日後關閉。今天與過去日期不可選。
- 店家手動封鎖寫入 `settings/availability_YYYY-MM-DD.blockedTimes`；解除店家封鎖不得刪除顧客 booking lock。

## 首頁動畫

- 深色背景中央顯示 `77waxing`；字體使用 Georgia。
- `77` 為 `#C5A070`，`waxing` 在深色背景為 `#F9F6F0`。
- 左到右掃亮約 4.28 秒；`g` 下伸筆畫不可被裁切。
- 桌機與手機字標／掃光維持收斂尺寸，白色斜線不可明顯超出字標範圍。
- 掃亮完成後背景才漸亮成首頁；每個 browser session 播放一次，保留略過與 reduced-motion。

## 目前仍必要的保護／同步層

- `admin-critical-preserve.js`：時間區間與永久刪除最後保護。
- `admin-time-range.js`：預約時間區間顯示。
- `admin-record-actions.js`：預約／顧客刪除操作。
- `admin-functions.js`：顧客快速資料與時段功能資料操作。
- `admin-slot-calendar.js`：時段功能日期彈窗。
- `booking-slot-status.js`：前端黃色／灰色時段狀態同步。
- `nav-service-catalog-sync.js`：預約頁服務選單同步 catalog。

## 修改規則

1. 不新增第二套 renderer 或第二套同功能資料來源。
2. 不用 DOM 位置硬改側欄文字；功能名稱由正式來源直接產生。
3. 不恢復已移除的 demo、legacy、preview、Next.js/server 相容程式。
4. 每次更新後至少檢查 JavaScript syntax、靜態資產引用與 GitHub Pages deploy。
5. 新增不可回歸需求時，更新本檔，只寫「目前狀態」，不堆疊舊版本歷史。
