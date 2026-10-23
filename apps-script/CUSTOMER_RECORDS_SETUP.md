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

## 行為與限制

- 管理員建立 20 分鐘工作階段。手機 QR Code 的 fragment 只包含上傳權杖，沒有管理員登入憑證；權杖只允許新增檔案，不能列出、下載、辨識其他檔案。
- 每個階段最多 8 個檔案，每個 5 MB。接受所有檔案格式；任意 HTML/SVG 等檔案僅下載、不在管理頁執行。
- 原檔暫存在店家私人 Drive 資料夾。關閉彈窗立即撤銷權杖；到期後拒絕任何存取。每日觸發器將過期階段資料夾移至垃圾桶。
- QR Code 使用本機附帶的 MIT 授權 qrcode-generator 1.4.4 產生；不把連結或檔案傳送給第三方 QR 服務。
- UTF-8 文字檔直接擷取；JPEG/PNG/GIF/BMP、PDF、DOC/DOCX 嘗試 Drive 轉 Google Docs/OCR。手寫字、低清晰度圖片及版面複雜文件可能無法正確辨識；HEIC、壓縮檔、影片、試算表等格式可上傳但目前不自動辨識。
- 「手動輸入」開啟與店家紙本顧客資料表對應的第二層表單視窗，包含基本資料、除毛經驗、保養方式、肌膚狀況、服務說明與本人確認／簽名區；手動輸入與辨識共用同一份草稿。返回上傳選項不清除表格，關閉外層「新增紀錄」才清除。
- 擷取有明確標籤的基本資料、身高體重、日期、除毛資訊及症狀說明。複選框只採用文字辨識中仍可確認的勾選符號；沒有辨識到勾選狀態時不猜測健康狀況。未辨識欄位留白，提供原文核對，人工填寫或清除的欄位不覆寫。
- LINE 欄位僅保存本次紙本資料草稿，不改寫會員的 LINE 綁定。
- 本人同意、簽名姓名、簽署日期及手寫筆跡不從掃描自動帶入，必須由本人核對操作。服務說明照店家提供的原表轉錄，不另作醫療或法律保證。
- 表單是視窗記憶體中的草稿，沒有把健康或簽名資料寫入 localStorage、Firestore 或伺服器。這次沒有建立顧客資料的儲存功能，也不會自動新增預約、發送郵件或更改會員。

## 上線驗收

必須以實際管理員登入後測試：直接上傳照片、PDF、TXT 及不支援辨識的任意檔案；手機掃碼上傳後電腦收到檔案；辨識回填與保留手動修改；未登入及非管理員拒絕讀取；其他工作階段無法下載此檔案；過期及關閉連結拒絕上傳。Apps Script 授權、Drive OCR 與跨裝置測試無法以本機語法檢查取代。
