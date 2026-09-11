# 77waxing｜77美學工作室

77waxing 正式品牌官網、線上預約、管理後台與 Email 通知系統。

## 正式架構

- GitHub Pages：前台、預約頁、管理後台
- Firebase Authentication：顧客匿名工作階段與管理員登入
- Cloud Firestore：預約、時段鎖定、顧客、服務、價格與營運設定
- Firestore Security Rules：前後台資料權限
- Google Apps Script：預約 Email 通知

正式入口：
- `/`：品牌官網
- `/booking/`：線上預約
- `/admin/`：管理後台

## 主要資料

- `bookings`：預約
- `availabilityLocks`：30 分鐘時段鎖定
- `customers`：顧客資料
- `customerPhoneIndex`：手機索引
- `services/catalog-main`：正式服務／價格 catalog
- `settings/general`：網站與預約設定
- `settings/availability_YYYY-MM-DD`：店家手動封鎖時段
- `admins/{uid}`：管理員權限

## 專案結構

- `index.html` + `assets/`：正式前台
- `booking/index.html`：正式預約入口
- `admin/index.html`：正式後台入口
- `firebase/`：Firestore rules / indexes
- `apps-script/Code.gs`：Email 通知
- `PROJECT_STATE.md`：目前不可回歸的產品規則

本 repository 只保留目前正式環境需要的程式與資產；已不使用的 Next.js/server 舊架構、舊 renderer、相容補丁與歷史版本資產已移除。
