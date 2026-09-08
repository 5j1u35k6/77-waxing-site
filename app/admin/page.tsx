import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoBookings } from "@/lib/demo-data";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理後台" };

type BookingRow = {
  id: string;
  time: string;
  customer: string;
  service: string;
  status: string;
  isNew: boolean;
  deposit: string;
};

async function loadBookings(): Promise<{ rows: BookingRow[]; demo: boolean }> {
  const supabase = getAdminSupabase();
  if (!supabase) return { rows: demoBookings, demo: true };
  const { data, error } = await supabase
    .from("bookings")
    .select("id, preferred_time, status, deposit_required, customers(name, visit_count), services(name)")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !data) return { rows: demoBookings, demo: true };
  const rows = data.map((row: any) => ({
    id: String(row.id).slice(0, 8),
    time: row.preferred_time || "待排",
    customer: row.customers?.name || "未命名顧客",
    service: row.services?.name || "待確認服務",
    status: row.status || "待確認",
    isNew: (row.customers?.visit_count || 0) === 0,
    deposit: row.deposit_required === true ? "需收" : row.deposit_required === false ? "免收" : "待決定",
  }));
  return { rows, demo: false };
}

export default async function AdminPage() {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");
  const { rows, demo } = await loadBookings();
  const pending = rows.filter((r) => r.status.includes("待確認")).length;
  const payment = rows.filter((r) => r.status.includes("付款")).length;

  return (
    <div className="admin-body">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="brand-mark"><span className="brand-77">77</span>waxing</div>
          <nav className="admin-nav">
            <a className="active" href="/admin">Dashboard</a>
            <a href="#bookings">預約管理</a>
            <a href="#calendar">預約行事曆</a>
            <a href="#customers">顧客資料</a>
            <a href="#services">服務管理</a>
            <a href="#prices">價格管理</a>
            <a href="#settings">網站設定</a>
            <form action="/api/admin/logout" method="post"><button type="submit">登出</button></form>
          </nav>
        </aside>
        <main className="admin-main">
          <div className="admin-top">
            <div><h1>早安，77</h1><p className="muted">這裡先處理今天最需要確認的預約。</p></div>
            {demo && <div className="demo-banner">DEMO DATA｜尚未連接 Supabase</div>}
          </div>
          <section className="metrics">
            <article className="metric-card"><span className="muted">待確認</span><strong>{pending}</strong></article>
            <article className="metric-card"><span className="muted">待付款</span><strong>{payment}</strong></article>
            <article className="metric-card"><span className="muted">今日預約</span><strong>{rows.length}</strong></article>
            <article className="metric-card"><span className="muted">新客</span><strong>{rows.filter((r) => r.isNew).length}</strong></article>
          </section>
          <section className="admin-panel" id="bookings">
            <div className="admin-panel-head"><div><strong>最近預約</strong><div className="muted" style={{fontSize: ".82rem"}}>首次預約確認後必須收訂金；回訪客由後台決定。</div></div><button className="button secondary">＋ 新增預約</button></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>時間</th><th>顧客</th><th>服務</th><th>新／舊客</th><th>訂金</th><th>狀態</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.id}><td>{row.time}</td><td>{row.customer}</td><td>{row.service}</td><td>{row.isNew ? "新客" : "回訪"}</td><td>{row.deposit}</td><td><span className={row.status.includes("付款") ? "status payment" : row.status.includes("待確認") ? "status pending" : "status"}>{row.status}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <div className="card-grid" style={{marginTop: 20}}>
            <article className="card" id="customers"><span className="eyebrow">CUSTOMERS</span><h3>顧客資料</h3><p className="muted">姓名、電話、LINE、首次來店、回訪次數與歷史預約。第二版可加入搜尋與顧客詳情頁。</p></article>
            <article className="card" id="services"><span className="eyebrow">SERVICES</span><h3>服務與價格管理</h3><p className="muted">目前先完成介面位置，待最新價目補上後建立正式可編輯資料。</p></article>
            <article className="card" id="calendar"><span className="eyebrow">CALENDAR</span><h3>行事曆</h3><p className="muted">第一版先以預約列表為核心，後續加入日／週／月檢視與可預約時段設定。</p></article>
          </div>
        </main>
      </div>
    </div>
  );
}
