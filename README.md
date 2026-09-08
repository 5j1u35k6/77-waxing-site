# 77waxing｜77美學工作室品牌官網 v0.2

依《77waxing 品牌官網整合建置企劃簡報》建立的第一版品牌網站與預約／後台原型。

## GitHub Pages 預覽

GitHub Pages 目前使用 `main` 根目錄的靜態預覽層，網址為：

`https://5j1u35k6.github.io/77-waxing-site/`

這一層的用途是讓目前就能直接看到「網站畫面」，而不是讓 Pages 將 Repository README 當成首頁。

預覽層包含：HOME / ABOUT / SERVICES / MENU / SPACE / COURSES / BOOKING，以及 `/admin/` 後台介面預覽；前台路由可切換成不同網址。Booking 在 GitHub Pages 僅示範互動流程，不會寫入真實顧客資料。

> GitHub Pages 是純靜態主機，無法執行 Next.js Route Handler、Cookie 登入、Middleware 與需要伺服器權限的 Supabase 後台操作。因此正式營運版仍以 Next.js 應用為主，之後部署到支援 Server Runtime 的平台（例如 Vercel），GitHub Pages 保留作為快速視覺預覽。

## Next.js 正式應用骨架

- 日式中性視覺，使用企劃五色：`#C5A070` / `#F9F6F0` / `#E6DFC8` / `#9B9B88` / `#3A3836`
- 七個獨立前台頁面：HOME / ABOUT / SERVICES / MENU / SPACE / COURSES / BOOKING
- Mobile-first 響應式前台與手機選單
- 獨立 `/booking` 四步驟預約流程，不使用彈跳視窗
- Guest booking：顧客不需註冊或登入
- 預約規則：送出後由 77 確認；首次確認後收訂金，回訪客由後台決定
- `/admin/login` 單一管理者登入骨架
- `/admin` Desktop-first Dashboard 與預約／顧客／服務／價格／行事曆入口
- Supabase 可選資料層與 SQL schema；未設定環境變數時使用 demo data
- 價格、課程資料、LINE、正式照片尚未杜撰，保留可替換位置

## 本機執行

```bash
npm install
cp .env.example .env.local
npm run dev
```

前台：`http://localhost:3000`

後台：`http://localhost:3000/admin/login`

## 後台環境變數

至少設定：

```env
ADMIN_PASSWORD=請設定管理者密碼
ADMIN_SESSION_TOKEN=請使用長且隨機的字串
```

若要啟用資料持久化，再設定 Supabase：

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

並在 Supabase SQL Editor 執行 `supabase/schema.sql`。

## 尚待 77 提供

1. 最新服務價目與施作時間
2. LINE 官方帳號連結
3. Logo 正式檔
4. 品牌／空間／施作／成果照片
5. 課程價格、時數與內容
6. 正式取消、改期、訂金金額與付款方式

## 資料原則

企劃未提供的價格、地址、真實顧客評價與課程細節不自行杜撰。目前店名以「77美學工作室」呈現，網站畫面不直接顯示義一路地址。
