# 77waxing｜77美學工作室品牌官網 v0.3

77waxing 品牌官網、預約系統與單一管理者後台。正式資料庫方案已確定採用 **Firebase Firestore**；GitHub Pages 僅保留作為前台／流程的靜態預覽。

## GitHub Pages 預覽

`https://5j1u35k6.github.io/77-waxing-site/`

GitHub Pages 是純靜態主機，因此預覽資料只存在瀏覽器 localStorage，不會寫入真實顧客資料，也不是正式後台。正式營運版需要部署 Next.js Server Runtime，並連接 Firebase。

## 正式架構

- Next.js 15 App Router
- React 19
- Firebase Admin SDK
- Cloud Firestore
- 單一管理者登入（第一階段）
- Server-side API 存取 Firestore，瀏覽器不直接讀寫顧客資料
- Firestore Security Rules 預設禁止 client-side direct access
- GitHub Actions 每次 push 自動執行 JavaScript 檢查與 `next build`

## 預約規則

- 顧客 Guest booking，不需要建立帳號。
- 今天不可預約；最早只能選明天。
- 自訂月曆選日期後顯示 7 天比較視窗；手機版先選七天中的日期，再顯示該日半小時時段。
- 每 30 分鐘一格。
- 預設服務時間 90 分鐘＋整理緩衝 30 分鐘，因此預設占用 120 分鐘。
- 例如 13:00 預約會鎖住 13:00 / 13:30 / 14:00 / 14:30。
- 顧客剛送出時，Firestore `availabilityLocks` 以 `held` 狀態鎖定，前台顯示灰色「保留中」。
- 77 後台接受預約後，lock 改為 `confirmed`，前台直接隱藏該時段。
- 取消、未到店或完成後釋放對應 lock。
- 建立預約採 Firestore transaction，防止兩位顧客同時搶到重疊時段。

## 訂金規則

- 首次預約：77 確認後必須收訂金。
- 回訪客：後台可選擇本次收訂金或免訂金。
- 後台狀態：`pending_confirmation → pending_payment → confirmed → completed`。
- 另有 `cancelled / no_show`。
- 訂金金額可在 `/admin/settings` 設定；付款串接尚未選定，因此目前由後台手動「標記已付款」。

## Firestore collections

- `customers`：顧客主檔、紙本舊客、回訪次數與備註
- `customerPhoneIndex`：手機號碼去重複／查找索引
- `bookings`：預約、服務、訂金與狀態歷程
- `availabilityLocks`：30 分鐘時段鎖定，處理防撞預約
- `services`：服務、分類、價格、施作時間、緩衝時間、啟用狀態
- `settings/general`：營業時間、預設時間、訂金金額、LINE 等營運設定
- `customerImportBatches`：紙本 CSV 匯入批次紀錄

## 後台

- `/admin`：Dashboard、近期預約與營運指標
- `/admin/bookings`：搜尋／日期／狀態篩選、確認、訂金、付款、完成、取消、未到店
- `/admin/calendar`：30 分鐘日行事曆與實際占用時間
- `/admin/customers`：顧客搜尋、手動新增、CSV 紙本客資匯入
- `/admin/customers/[id]`：顧客基本資料、回訪設定、備註、歷史預約
- `/admin/services`：服務、價格、施作時間、緩衝時間、開放／停用
- `/admin/settings`：營業起迄時間、預設服務時間、首次訂金金額、LINE 與預約說明

## 紙本顧客資料

`public/customer-import-template.csv` 提供大量匯入範本。

目前可承接：姓名、手機、LINE ID、Email、回訪次數、舊客編號、紙本編號、首次來店日期、最近來店日期、備註。

匯入時優先以手機索引判斷既有顧客，其次比對舊客編號與紙本編號。每次 CSV 上限 500 筆／1 MB，避免一次大量寫入失控。

## 本機執行

```bash
npm install
cp .env.example .env.local
npm run dev
```

前台：`http://localhost:3000`

後台：`http://localhost:3000/admin/login`

## 正式環境變數

```env
ADMIN_PASSWORD=
ADMIN_SESSION_TOKEN=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`FIREBASE_PRIVATE_KEY` 是 server-side secret，禁止放進前端程式或提交到 GitHub。

## Firestore Security Rules

規則在 `firebase/firestore.rules`。目前正式架構只允許伺服器上的 Firebase Admin SDK 操作資料，client-side Firestore access 全部拒絕，以降低顧客資料外洩風險。

## 尚待營運資料

- 最新服務價目
- 正式各服務施作時間（目前預設 90 分鐘）
- 正式營業／休假規則
- LINE 官方帳號連結
- 首次訂金金額與正式付款方式
- Logo、空間與品牌照片
- 課程價格、時數與內容
- 正式取消／改期政策

## 資料原則

企劃未提供的價格、地址、真實顧客評價、課程細節與紙本顧客內容不自行杜撰。目前店名以「77美學工作室」呈現，網站畫面不直接顯示義一路地址。
