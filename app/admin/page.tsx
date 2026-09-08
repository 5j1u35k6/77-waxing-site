import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoBookings } from "@/lib/demo-data";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理後台" };

type BookingRow = {
  id: string;
  date: string;
  time: string;
  customer: string;
  service: string;
  status: string;
  isNew: boolean;
  deposit: string;
};

const statusLabel = (status: string) => ({
  pending_confirmation: "待確認",
  pending_payment: "待付款",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到店",
}[status] || status);

const isStatus = (status: string, code: string, zh: string) => status === code || status.includes(zh);

async function loadBookings(): Promise<{ rows: BookingRow[]; demo: boolean }> {
  const supabase = getAdminSupabase();
  if (!supabase) return { rows: demoBookings, demo: true };

  const { data, error } = await supabase
    .from("bookings")
    .select("id, preferred_date, preferred_time, status, deposit_required, is_first_visit, customers(name), services(name)")
    .order("preferred_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return { rows: demoBookings, demo: true };

  const rows = data.map((row: any) => ({
    id: String(row.id),
    date: row.preferred_date || "待排",
    time: row.preferred_time || "待排",
    customer: row.customers?.name || "未命名顧客",
    service: row.services?.name || "待確認服務",
    status: row.status || "pending_confirmation",
    isNew: Boolean(row.is_first_visit),
    deposit: row.deposit_required === true ? "需收" : row.deposit_required === false ? "免收" : "待決定",
  }));

  return { rows, demo: false };
}

function BookingActions({ row }: { row: BookingRow }) {
  const formStyle = { display: "inline" } as const;
  const buttonStyle = { padding: "7px 10px", fontSize: ".76rem", margin: "2px" } as const;

  const Action = ({ action, children }: { action: string; children: React.ReactNode }) => (
    <form action="/api/admin/bookings/action" method="post" style={formStyle}>
      <input type="hidden" name="bookingId" value={row.id} />
      <input type="hidden" name="action" value={action} />
      <button className="button secondary" style={buttonStyle} type="submit">{children}</button>
    </form>
  );

  if (isStatus(row.status, "pending_confirmation", "待確認")) {
    return <>
      <Action action="confirm_deposit">確認＋收訂金</Action>
      {!row.isNew && <Action action="confirm_no_deposit">確認免訂金</Action>}
      <Action action="cancel">取消</Action>
    </>;
  }

  if (isStatus(row.status, "pending_payment", "待付款")) {
    return <><Action action="mark_paid">標記已付款</Action><Action action="cancel">取消</Action></>;
  }

  if (isStatus(row.status, "confirmed", "已確認")) {
    return <><Action action="complete">完成服務</Action><Action action="no_show">未到店</Action><Action action="cancel">取消</Action></>;
  }

  return <span className="muted">—</span>;
}

export default async function AdminPage() {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");

  const { rows, demo } = await loadBookings();
  const pending = rows.filter((r) => isStatus(r.status, "pending_confirmation", "待確認")).length;
  const payment = rows.filter((r) => isStatus(r.status, "pending_payment", "待付款")).length;
  const confirmed = rows.filter((r) => isStatus(r.status, "confirmed", "已確認")).length;

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
            <div><h1>早安，77</h1><p className="muted">先處理待確認與待付款，再看今天已成立的預約。</p></div>
            {demo && <div className="demo-banner">DEMO DATA｜尚未連接 Supabase</div>}
          </div>

          <section className="metrics">
            <article className="metric-card"><span className="muted">待確認</span><strong>{pending}</strong></article>
            <article className="metric-card"><span className="muted">待付款</span><strong>{payment}</strong></article>
            <article className="metric-card"><span className="muted">已確認</span><strong>{confirmed}</strong></article>
            <article className="metric-card"><span className="muted">新客預約</span><strong>{rows.filter((r) => r.isNew).length}</strong></article>
          </section>

          <section className="admin-panel" id="bookings">
            <div className="admin-panel-head">
              <div>
                <strong>最近預約</strong>
                <div className="muted" style={{ fontSize: ".82rem" }}>首次預約確認後必須收訂金；回訪客可由後台選擇收訂金或免訂金。</div>
              </div>
              <button className="button secondary">＋ 新增預約</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>日期</th><th>時段</th><th>顧客</th><th>服務</th><th>新／舊客</th><th>訂金</th><th>狀態</th><th>操作</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{row.time}</td>
                      <td>{row.customer}</td>
                      <td>{row.service}</td>
                      <td>{row.isNew ? "新客" : "回訪"}</td>
                      <td>{row.deposit}</td>
                      <td><span className={isStatus(row.status, "pending_payment", "待付款") ? "status payment" : isStatus(row.status, "pending_confirmation", "待確認") ? "status pending" : "status"}>{statusLabel(row.status)}</span></td>
                      <td style={{ minWidth: 210 }}><BookingActions row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="card-grid" style={{ marginTop: 20 }}>
            <article className="card" id="customers"><span className="eyebrow">CUSTOMERS</span><h3>顧客資料</h3><p className="muted">姓名、電話、LINE、首次來店、回訪次數與歷史預約。下一階段加入搜尋、顧客詳情與「回訪是否預設收訂金」。</p></article>
            <article className="card" id="services"><span className="eyebrow">SERVICES</span><h3>服務與價格管理</h3><p className="muted">待最新價目補上後，建立正式可編輯服務、時間與價格。</p></article>
            <article className="card" id="calendar"><span className="eyebrow">CALENDAR</span><h3>行事曆</h3><p className="muted">後續加入日／週／月檢視、休假與可預約時段設定。</p></article>
          </div>
        </main>
      </div>
    </div>
  );
}
