# 77waxing｜目前正式基準

> 修改前先閱讀本檔。這裡只記錄「現在仍有效」的產品規則，不保存舊版實作歷史。

## 架構

- 正式站為 GitHub Pages 靜態前台：`/`、`/about/`、`/first-visit/`、`/beginner/`、`/booking/`、`/admin/`。
- 正式資產使用穩定名稱，不再以 `v1/v2/v3/v4` 表示目前版本；核心入口為 `nav.js`、`booking-core.js`、`admin-core.js`、`admin-firebase.js`、`admin-dashboard.js`、`catalog.css`、`footer.css`、`beginner.css`。
- Firebase Authentication + Cloud Firestore 是正式資料層。
- 公開前台匿名 Firebase Auth 固定使用獨立命名 app `77waxing-public`；不得與管理後台 `[DEFAULT]` 的管理員登入共用 Auth persistence，避免公開頁面匿名登入覆蓋後台 session。
- 管理後台讀寫 `services/catalog-main` 時只能使用 `[DEFAULT]` 的非匿名管理員 Auth；admin context 不得自動執行匿名登入。
- Google Apps Script `apps-script/Code.gs` 負責預約 Email。
- 服務／價目唯一公開 renderer 為 `assets/catalog-dynamic.js`；資料來源為 `services/catalog-main`，並使用瀏覽器快取後再背景同步 Firestore。

## Email

- 新預約建立後必須以實際 `bookingId` 立即觸發 Email dispatch；若 Email module 尚未完成 Firebase 初始化要先排隊，並使用 `keepalive` 加一次延遲重送。Apps Script 端以 bookingId + status 去重，因此重送不得造成重複信。
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
- 預約聯絡資料的手機欄位使用「英文國名 + 國際冠碼」選單（A→Z，預設 Taiwan +886）與本地號碼同框顯示；依國家嚴格限制允許位數，Taiwan 必須 10 碼、Japan 必須 11 碼。Firestore 保留本地號碼並另外儲存國家、冠碼與完整國際格式。
- 預約送出優先寫入國家、冠碼與完整國際格式；若線上 Firestore rules 尚未同步而回傳 `permission-denied`，前端必須自動改用舊 schema 重試並把國際手機資訊附記到 note，不能讓整筆預約失敗。

## 管理後台

- 側欄固定：`總覽 → 預約管理 → 預約行事曆 → 顧客資料 → 服務功能 → 時段功能 → 價格功能 → 網站設定`。
- 預約時間必須顯示「開始–服務結束」，例如 `11:00–12:30`。
- 每筆預約必須保留永久「刪除」；永久刪除同步刪除該 booking 的 availability locks。取消與永久刪除是不同操作。
- 預約管理的顧客姓名可點擊，顯示：姓名／電話／性別、Email／LINE ID、過去預約紀錄。
- 客別只顯示 `新` 或 `舊`。
- 「概論 > 待確認」只計算 `pending_confirmation`；「營運總覽 > 待處理」包含待確認與待付款。
- 總覽不顯示版型／資料狀態等系統說明文案；保留指標與圖表本身，空資料直接以 0 或空圖表呈現。
- 時段功能只顯示單一自訂日期按鈕；點擊後開小型月曆，選日後關閉。今天與過去日期不可選。
- 店家手動封鎖寫入 `settings/availability_YYYY-MM-DD.blockedTimes`；解除店家封鎖不得刪除顧客 booking lock。
- 編輯預約彈窗底部不得使用深色整塊背景；只保留右下角的「取消／儲存修改」按鈕，取消文字使用紅色。
- 「儲存網站設定」寫入 `settings/general` 後，必須用 Firestore server read-back 驗證主要欄位完全一致；只有驗證成功才能顯示已儲存。
- 服務管理必須可對「服務分類（母項目）／分類內區塊／區塊內服務項目（次項目）」逐層上移、下移；排序直接儲存在 `services/catalog-main.categories` 陣列順序，並同步決定前端服務選單、服務頁置頂切換標籤、價目表分類／內容與預約服務選項順序。

## 首頁文案與版面

- 首頁主標中文固定一行：`只需要安心躺好，剩下的交給77就可以了。`
- 下一行顯示粵語：`安心瞓好，剩低嘅交畀77就得喇。`
- `把「會不會尷尬」先放下。` 使用較小字級並維持單行。
- SAFE SPACE 區塊使用「左側較小品牌情境圖 + 右側三步驟圖文流程」版型；三步驟為 `抵達與接待 → 諮詢與評估 → 施作與衛教`。
- SAFE SPACE 三步驟每一步都要有柔和米色底、細線條人物情境圖、編號、標題與說明；桌機橫向以細箭頭串接，手機改為縱向流程，整體維持柔和、有質感的視覺。
- SAFE SPACE 區塊不顯示「第一次熱蠟｜小白小白專區」按鈕；小白小白由頂部選單 `關於 → 小白小白` 進入。
- 頂部「關於」選單固定三項：`77waxing故事 → /about/`、`首訪的你 → /first-visit/`、`小白小白 → /beginner/`。
- `/about/` 不再內嵌「首訪的你」或「小白小白」區塊；`/first-visit/` 為獨立首訪頁，承接原本的首訪流程內容。
- `/about/` 的 `77waxing故事` 為正式品牌故事頁；可使用圖片／插畫與留白排版，但所有可見品牌故事文字必須完全依照使用者提供的原文，不得自行新增小標、編號、摘要、CTA、英文字樣，也不得改寫、補字或重組句子。頁面主標使用 `品牌故事`，主標下小標固定為 `保養不只是技術，更是一場好好對待自己的儀式。`；「從香港到台灣…」與「還記得初訪台灣旅遊…」必須合併於同一圖文區塊並搭配 SVG；「很多時候…」與「當你因為肌膚或毛髮問題…」必須合併於同一圖文區塊並搭配 SVG；不得另外在頁面中重複顯示該小標。手機版所有含 SVG 的品牌故事圖文區塊固定為「文字在上、SVG 在下」，每一張 SVG 必須緊跟自己的文案，不得讓相鄰區塊形成連續兩張 SVG 而把對應文字隔開。
- 首頁原本底部的「第一次熱蠟，可能也會想問...」FAQ 區塊已移除；完整內容只保留在 `/beginner/`。
- 首頁 Hero 的 `77waxing提供的服務` 右側固定新增 `第一次熱蠟，可能也會想問...` 按鈕，連到 `/beginner/`。
- 首頁底部固定改為兩個區塊，順序為 `7777waxing video` → `為什麼大家都推薦77waxing？`；在使用者提供影片或推薦內容前，不自行杜撰可見文案。
- 首頁 `7777waxing video` 區塊的正式呈現方式：桌機採左側影片分類／右側 3D perspective 卡片輪播；中央目前影片最大且正面，左右相鄰影片縮小、後退並帶透視角度形成疊卡效果，底部提供左右切換與分頁點；可滑動／拖曳切換，手機改為適合觸控的單列輪播。此視覺參考使用者 2026-09-12 提供的範例圖，但網站不得顯示範例圖中的 source code 區塊。實際影片來源待使用者提供 Instagram Reel 連結後串接。
- `7777waxing video` 以使用者 2026-09-12 最新提供的 16 個 @77waxing Instagram Reel 連結為唯一正式來源，依使用者提供順序固定為 01–16；這批 Reel 取代先前 `/p/` 貼文連結，包含新增 `DKfIfq6yHbU` 並移除舊的 `DCWqB-SOrI1`。正式前台以 Instagram Reel embed iframe 作為媒體來源，但 iframe 必須裁切成 9:16 純影片視窗，隱藏 Instagram 上下介面；iframe 固定 `pointer-events:none`、`scrolling=no`、`tabindex=-1`，不得讓滑鼠、游標、滾輪或觸控進入 iframe 操作／捲動 Instagram 內容。3D 卡片切換全部由外層輪播控制；點中央影片卡片時開啟該支 Reel 原文。左側分類在尚未取得／確認內容語意分類前不得自行猜測服務類別，先使用中性的 `全部影片`、`01—04`、`05—08`、`09—12`、`13—16` 分組；之後若使用者指定實際分類，再改成內容分類。
- 首頁「第一次，不需要一次懂全部。」中的任一服務連結，以及其他無 hash 的服務連結，切換到服務頁後必須回到該服務頁頂部／服務標題，不得保留首頁原本的捲動位置而落在服務頁中段。
- `/beginner/` 標題固定為「第一次熱蠟，可能也會想問...」；副標「希望在來之前，先把最在意的事情說清楚，讓第一次也可以安心一點。」不使用「妳」。
- `/beginner/` 全頁不使用表情符號。Q1 的「原來沒有想像中那麼可怕。」維持引用標記；Q2「毛髮建議保留約 0.5–1 公分」、Q3「細節和肌膚狀況」、Q4「會慢慢長回來。」及「之後再依照每個人的毛髮生長速度，大約4-6週安排適合自己的保養時間就可以了。」、Q5「不是每一種肌膚狀態都一定適合當下操作」、Q6「妳只需要安心躺好，剩下的交給77就可以了。」使用同系暖色重點標記。

## 首頁動畫

- 首次進入首頁且本 session 尚未播放動畫時，第一個可見畫面必須直接是深色動畫層；不得先閃出首頁內容再切換到動畫。Intro bootstrap 必須在首頁內容 render 前啟動。
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