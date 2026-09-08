# 77waxing｜77美學工作室品牌官網 v0.1

依《77waxing 品牌官網整合建置企劃簡報》建立的第一版網站骨架。

## 已完成

- 日式中性視覺，使用企劃五色：`#C5A070` / `#F9F6F0` / `#E6DFC8` / `#9B9B88` / `#3A3836`
- 七個獨立前台頁面：HOME / ABOUT / SERVICES / MENU / SPACE / COURSES / BOOKING
- Mobile-first 響應式前台與手機選單
- 獨立 `/booking` 四步驟預約流程，不使用彈跳視窗
- Guest booking：顧客不需註冊或登入
- 預約規則文案：送出後由 77 確認；首次確認後收訂金，回訪客由後台決定
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

## 第一版資料原則

企劃未提供的價格、地址、真實顧客評價與課程細節不自行杜撰。目前店名以「77美學工作室」呈現，網站畫面不直接顯示義一路地址。
