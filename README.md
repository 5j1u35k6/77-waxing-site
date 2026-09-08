# 77waxing｜77美學工作室品牌官網 v0.2

依《77waxing 品牌官網整合建置企劃簡報》建立的第一版品牌網站與預約／後台原型。

## GitHub Pages 預覽

GitHub Pages 目前使用 `main` 根目錄的靜態預覽層：

`https://5j1u35k6.github.io/77-waxing-site/`

預覽層包含 HOME / ABOUT / SERVICES / MENU / SPACE / COURSES / BOOKING，以及 `/admin/` 後台流程預覽。GitHub Pages 是純靜態主機，因此預覽資料只存在瀏覽器 localStorage，不會寫入真實顧客資料。

> 正式營運版仍以 Next.js + Supabase 為主，之後部署到支援 Server Runtime 的平台；GitHub Pages 保留作為快速視覺與流程預覽。

## 目前預約規則

- Guest booking：顧客不用註冊或登入。
- 日期介面採日式中性風格的自訂月曆，不使用系統原生日期輸入作為主要體驗。
- 選擇想去日期後，同時顯示「前三天／當天／後三天」共 7 天空檔，手機可水平滑動比較。
- 時段以每 30 分鐘一格呈現。
- 目前所有服務暫定 `90 分鐘`。
- 另保留 `30 分鐘`整理／轉場時間，因此一筆預約總共占用 4 個半小時格（120 分鐘）。
- 例如選 `13:00`，會占用 `13:00 / 13:30 / 14:00 / 14:30`。
- 顧客剛送出、狀態仍為 `pending_confirmation` 時，上述四格繼續顯示但反灰為「保留中」。
- 77 後台確認後（`pending_payment` 或 `confirmed`），上述四格從顧客可預約清單移除。
- 取消預約後，時段重新釋出。
- Supabase schema 另外加入重疊預約保護，避免兩位顧客幾乎同時搶到相衝時段。

## 訂金規則

- 首次預約：77 確認後必須收訂金。
- 回訪顧客：由 77 在後台決定本次是否收訂金。
- 後台狀態流程：`待確認 → 待付款 → 已確認 → 已完成`，並保留 `取消 / 未到店`。

## Next.js 正式應用骨架

- 日式中性視覺，使用企劃五色：`#C5A070` / `#F9F6F0` / `#E6DFC8` / `#9B9B88` / `#3A3836`
- 七個獨立前台頁面：HOME / ABOUT / SERVICES / MENU / SPACE / COURSES / BOOKING
- Mobile-first 響應式前台與手機選單
- 獨立 `/booking` 四步驟預約流程，不使用彈跳視窗
- `/api/availability`：前後 7 天時段狀態
- `/api/bookings`：預約建立與衝突檢查
- `/admin/login`：單一管理者登入
- `/admin`：Desktop-first Dashboard 與預約操作
- Supabase：customers / services / bookings 與時段占用欄位
- `.github/workflows/next-build.yml`：每次 push 自動檢查 GitHub Pages JavaScript 與 Next.js build

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

並在 Supabase SQL Editor 執行或重新執行 `supabase/schema.sql`，讓現有資料表補上時段占用欄位與重疊保護。

## 尚待 77 提供

1. 最新服務價目與正式施作時間（目前全部暫定 90 分鐘）
2. 正式營業／可預約起迄時間與休假規則
3. LINE 官方帳號連結
4. Logo 正式檔
5. 品牌／空間／施作／成果照片
6. 課程價格、時數與內容
7. 正式取消、改期、訂金金額與付款方式

## 資料原則

企劃未提供的價格、地址、真實顧客評價與課程細節不自行杜撰。目前店名以「77美學工作室」呈現，網站畫面不直接顯示義一路地址。
