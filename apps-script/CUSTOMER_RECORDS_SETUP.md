# 顧客紀錄上傳

## 部署

1. 在既有 Apps Script 專案新增 `CustomerRecords.gs`。保留線上版本原有的 Email、LINE 及 IdentityLink 檔案。
2. 在現有 `doPost` 解析 payload 之後、其他 action 路由之前加入：

   ```js
   if (typeof routeCustomerRecordsPost_ === 'function') {
     const recordResponse = routeCustomerRecordsPost_(payload);
     if (recordResponse) return recordResponse;
   }
   ```

   不要用舊的本機 Code.gs 全檔覆蓋線上版本；本機已有的路由可能落後於線上 Apps Script。
3. 確認既有 `IdentityLink.gs` 中的 `firebaseLookupUser_` 與 `identityAdminGetDoc_` 正常，後者使用既有伺服器憑證讀取 `admins/{uid}`。不需新增公開 Firestore 規則。
4. 在此 Apps Script 所使用的 Google Cloud 專案啟用 Google Drive API。執行 `setupCustomerRecordUploads` 並由店家帳號同意 Drive 存取及每日清理觸發器授權。如專案使用明列 OAuth scopes，合併加入 `https://www.googleapis.com/auth/drive`、`https://www.googleapis.com/auth/script.scriptapp` 與既有 external_request scope，保留所有既有 scopes。
5. 更新**現有**網頁應用程式部署版本（以店家執行；允許跨裝置連結存取）。沿用原 `/exec` URL。若另行建立部署，將 `settings/general.customerRecordUploadUrl` 設為新網址。
6. 透過使用者已登入的 GitHub 網頁上傳新增 assets、vendor 及 `admin/record-upload.html`，在正式 `admin/index.html` 的 body 結尾加入新 CSS 與 module script。不能直接覆蓋本機整份 admin/index.html，因為已有其他尚未提交的修改。
7. 正式顧客紀錄功能另外部署 `admin/customer-record.html` 及 `customer-record-page*.js/css`、calendar/data/store/list 模組，更新 admin-core 與載入版本。保留舊 `customer-record-form.js` 供已開啟的舊頁面相容；新頁面使用 `customer-record-page-form.js`，不再開啟表單彈窗。

## 行為與限制

- 管理員建立 20 分鐘工作階段。手機 QR Code 的 fragment 只包含上傳權杖，沒有管理員登入憑證；權杖只允許新增檔案，不能列出、下載、辨識其他檔案。
- 每個階段最多 8 個檔案，每個 5 MB。接受所有檔案格式；任意 HTML/SVG 等檔案僅下載、不在管理頁執行。
- 原檔暫存在店家私人 Drive 資料夾。關閉彈窗立即撤銷權杖；到期後拒絕任何存取。每日觸發器將過期階段資料夾移至垃圾桶。
- QR Code 使用本機附帶的 MIT 授權 qrcode-generator 1.4.4 產生；不把連結或檔案傳送給第三方 QR 服務。
- UTF-8 文字檔直接擷取；JPEG/PNG/GIF/BMP、PDF、DOC/DOCX 嘗試 Drive 轉 Google Docs/OCR。手寫字、低清晰度圖片及版面複雜文件可能無法正確辨識；HEIC、壓縮檔、影片、試算表等格式可上傳但目前不自動辨識。
- 「手動輸入」前往獨立的 `admin/customer-record.html` 頁面，不再使用表單彈跳視窗。辨識檔案也前往同一頁，透過僅管理員可讀取的工作階段／檔案編號載入資料；健康資料、登入憑證、上傳權杖不放入 URL 或瀏覽器儲存。
- 擷取有明確標籤的基本資料、身高體重、日期、除毛資訊及症狀說明。複選框只採用文字辨識中仍可確認的勾選符號；沒有辨識到勾選狀態時不猜測健康狀況。未辨識欄位留白，提供原文核對，人工填寫或清除的欄位不覆寫。
- LINE 欄位僅保存本次紙本資料草稿，不改寫會員的 LINE 綁定。
- 本人同意、簽署日期及手寫簽名不從掃描自動帶入，必須由本人核對操作。服務說明照店家提供的原表轉錄，不另作醫療或法律保證。
- 未儲存前，表單僅存在頁面記憶體；離開前會提醒。點擊「正式儲存顧客紀錄」才寫入既有管理員專用 `customers/{paper_UUID}` 文件，包含完整表單、PNG 簽名、版本、建立者、伺服器時間與內容雜湊。健康與簽名資料不寫入 localStorage。
- 每份資料表是獨立且唯讀的歷史紀錄；交易避免重複建立或覆寫，並再次從伺服器確認儲存。儲存後可重新載入、從顧客姓名的歷史視窗開啟；不影響預約次數、會員資料及 LINE 綁定。
- 可儲存未簽署紀錄，清楚標記「未完成本人確認」。若勾選同意，則必須由本人完成簽名與日期；辨識不代替本人同意。簽名欄點擊開啟放大簽名板，完成後回填 PNG 預覽。
- 條件欄位依使用者指定：初次除毛選「是」才展開次數／最近日期／部位；選其他、敏感膚質、發癢或發炎「是」才展開相應說明。儲存時清除未啟用條件的舊值，避免隱藏內容誤存。
- 不新增預約、不發送郵件、不變更資料權限；沿用 `customers` 僅 `isAdmin()` 可讀寫的既有規則。部署不需更動 Apps Script 或擴張權限。
- 正式紀錄保存當時的服務條款文字與版本，歷史頁依其快照顯示，避免後續修改條款影響舊紀錄。正式保存的是表格與簽名；原始上傳檔仍依既有私人暫存／到期清理規則處理。

## 上線驗收

必須以實際管理員登入後測試：直接上傳照片、PDF、TXT 及不支援辨識的任意檔案；手機掃碼上傳後電腦收到檔案；辨識回填與保留手動修改；未登入及非管理員拒絕讀取；其他工作階段無法下載此檔案；過期及關閉連結拒絕上傳。Apps Script 授權、Drive OCR 與跨裝置測試無法以本機語法檢查取代。
