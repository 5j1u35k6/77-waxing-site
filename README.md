# 77waxing｜77美學工作室品牌官網

77waxing 品牌官網、預約系統與單一管理者後台。

## 正式網站

- 前台：`https://5j1u35k6.github.io/77-waxing-site/`
- 預約：`https://5j1u35k6.github.io/77-waxing-site/booking/`
- 後台：`https://5j1u35k6.github.io/77-waxing-site/admin/`

目前正式架構為 **GitHub Pages + Firebase Authentication + Cloud Firestore**。

## 架構

- GitHub：程式碼版本管理
- GitHub Pages：正式前台與管理後台 UI
- Firebase Authentication：一般預約工作階段與管理員登入
- Cloud Firestore：預約、時段鎖定、顧客、服務與設定資料
- Firestore Security Rules：限制一般顧客與管理員各自可讀寫的資料
- GitHub Actions：每次 push 執行 JavaScript 檢查、Next.js 相容性 build 與 Pages 部署

Repo 內仍保留早期 Next.js/server 程式作為既有開發資產與相容性檢查，但目前正式網站不依賴任何額外 server hosting。

## 預約規則

- 顧客不需要建立會員帳號。
- 今天不可預約；最早只能選明天。
- 月曆選定基準日期後，下方固定顯示 7 天；點擊下方日期只改實際預約日，不重新置中 7 天範圍。
- 每 30 分鐘一格。
- 目前服務時間預設 90 分鐘，另保留 30 分鐘整理緩衝。
- 顧客畫面顯示服務開始與結束時間；例如 13:00 開始，90 分鐘服務結束為 14:30。
- 系統實際會鎖住 13:00 / 13:30 / 14:00 / 14:30 四個半小時格，避免整理時間被下一位顧客占用。
- 所有服務共用 77 的同一條工作時間軸，不能同時接受兩項服務。
- 待確認預約使用 `availabilityLocks` 的 `held` 狀態，前台顯示「保留中」。
- 後台確認後 lock 改為 `confirmed`，重疊開始時段不再提供預約。
- 取消、未到店或完成後釋放對應 lock。
- 建立預約使用 Firestore transaction，避免同時搶到重疊時段。

## 訂金規則

- 首次預約：77 確認後收訂金。
- 回訪客：後台可選擇本次收訂金或免訂金。
- 主要狀態：`pending_confirmation → pending_payment → confirmed → completed`。
- 其他狀態：`cancelled / no_show`。
- 付款串接尚未選定，目前由後台手動標記付款。

## Firestore collections

- `admins`：可登入管理後台的 Firebase Auth UID
- `bookings`：正式預約資料
- `availabilityLocks`：30 分鐘時段鎖定
- `customers`：顧客主檔
- `customerPhoneIndex`：手機索引
- `services`：服務資料
- `settings/general`：營運設定
- `customerImportBatches`：顧客匯入批次紀錄

## 後台

目前 GitHub Pages `/admin/` 提供：

- 總覽
- 預約管理
- 預約行事曆
- 顧客資料
- 服務管理
- 價格管理
- 網站設定
- 回到網站
- 登出

其中預約資料與狀態操作已直接連接 Firestore；其餘管理功能會依序完成正式內容。

## Firebase Web 設定

公開 Web App 設定放在 `assets/firebase-config.js`。這些 Firebase Web config 值本來就會出現在瀏覽器端；真正的權限保護由 Firebase Authentication 與 `firebase/firestore.rules` 控制。

**不要**把 Service Account JSON、`private_key` 或其他 server secret 放進前端程式或提交到 GitHub。

## Firestore Security Rules

正式規則位於：

`firebase/firestore.rules`

一般顧客只能執行預約所需的有限操作；只有 `admins/{uid}` 對應的管理員帳號可讀取完整預約與顧客資料並執行後台管理操作。

## 尚待營運資料

- 最新服務價目
- 正式各服務施作時間
- 正式營業／休假規則
- LINE 官方帳號連結
- 首次訂金金額與正式付款方式
- Logo、空間與品牌照片
- 課程價格、時數與內容
- 正式取消／改期政策

## 資料原則

未提供的價格、地址、真實顧客評價、課程細節與顧客內容不自行杜撰。目前店名以「77美學工作室」呈現，網站畫面不直接顯示街道地址。
