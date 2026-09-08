import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { demoBookings } from "@/lib/demo-data";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理後台" };

type BookingRow = {
  id: string;
  date: string;
  time: string;
  customer: string;
  phone?: string;
  service: string;
  status: string;
  isNew: boolean;
  deposit: string;
};

const statusLabels: Record<string, string> = {
  pending_confirmation: "待確認",
  pending_payment: "待付款",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到店",
};
const statusLabel = (status: string) => statusLabels[status] || status;
const isStatus = (status: string, code: string, zh: string) => status === code || status.includes(zh);

async function loadDashboard(): Promise<{ rows: BookingRow[]; demo: boolean; customerCount: number }> {
  const db = getAdminFirestore();
  if (!db) return { rows: demoBookings, demo: true, customerCount: 0 };

  const [bookingSnapshot, customerCountSnapshot] = await Promise.all([
    db.collection("bookings").orderBy("preferredDate", "asc").limit(50).get(),
    db.collection("customers").count().get(),
  ]);

  const rows = bookingSnapshot.docs.map((doc) => {
    const row = doc.data();
    return {
      id: doc.id,
      date: String(row.preferredDate || "待排"),
      time: String(row.preferredTime || "待排"),
      customer: String(row.customerName || "未命名顧客"),
      phone: row.customerPhone ? String(row.customerPhone) : undefined,
      service: String(row.serviceName || "待確認服務"),
      status: String(row.status || "pending_confirmation"),
      isNew: Boolean(row.isFirstVisit),
      deposit: row.depositRequired === true ? "需收" : row.depositRequired === false ? "免收" : "待決定",
    } satisfies BookingRow;
  });

  return { rows, demo: false, customerCount: customerCountSnapshot.data().count };
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

  if (isStatus(row.status, "pending_confirmation", "待確認")) return <>
    <Action action="confirm_deposit">確認＋收訂金</Action>
    {!row.isNew && <Action action="confirm_no_deposit">確認免訂金</Action>}
    <Action action="cancel">取消</Action>
  </>;
  if (isStatus(row.status, "pending_payment", "待付款")) return <><Action action="mark_paid">標記已付款</Action><Action action="cancel">取消</Action></>;
  if (isStatus(row.status, "confirmed", "已確認")) return <><Action action="complete">完成服務</Action><Action action="no_show">未到店</Action><Action action="cancel">取消</Action></>;
  return <span className="muted">—</span>;
}

export default async function AdminPage() {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");

  const { rows, demo, customerCount } = await loadDashboard();
  const pending = rows.filter((r) => isStatus(r.status, "pending_confirmation", "待確認")).length;
  const payment = rows.filter((r) => isStatus(r.status, "pending_payment", "待付款")).length;
  const confirmed = rows.filter((r) => isStatus(r.status, "confirmed", "已確認")).length;

  return (
    <div className="admin-body">
      <div className="admin-shell">
        <AdminSidebar active="dashboard" />
        <main className="admin-main">
          <div className="admin-top">
            <div><span className="eyebrow">OPERATIONS</span><h1>早安，77</h1><p className="muted">先處理待確認與待付款，再查看即將到店的顧客。</p></div>
            {demo ? <div className="demo-banner">尚未連接 Firebase｜目前顯示 DEMO DATA</div> : <div className="status firebase-ready">Firebase 已連線</div>}
          </div>

          <section className="metrics">
            <article className="metric-card"><span className="muted">待確認</span><strong>{pending}</strong></article>
            <article className="metric-card"><span className="muted">待付款</span><strong>{payment}</strong></article>
            <article className="metric-card"><span className="muted">已確認</span><strong>{confirmed}</strong></article>
            <article className="metric-card"><span className="muted">顧客總數</span><strong>{demo ? "—" : customerCount}</strong></article>
          </section>

          <section className="admin-panel" id="bookings">
            <div className="admin-panel-head">
              <div>
                <strong>近期預約</strong>
                <div className="muted" style={{ fontSize: ".82rem" }}>新客確認後必須收訂金；回訪客可由後台決定是否收訂金。</div>
              </div>
              <a className="button secondary" href="/admin/bookings">完整預約管理</a>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>日期</th><th>時段</th><th>顧客</th><th>服務</th><th>新／舊客</th><th>訂金</th><th>狀態</th><th>操作</th></tr></thead>
                <tbody>
                  {rows.slice(0, 20).map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td><td>{row.time}</td>
                      <td><strong>{row.customer}</strong>{row.phone && <div className="muted" style={{ fontSize: ".75rem" }}>{row.phone}</div>}</td>
                      <td>{row.service}</td><td>{row.isNew ? "新客" : "回訪"}</td><td>{row.deposit}</td>
                      <td><span className={isStatus(row.status, "pending_payment", "待付款") ? "status payment" : isStatus(row.status, "pending_confirmation", "待確認") ? "status pending" : "status"}>{statusLabel(row.status)}</span></td>
                      <td style={{ minWidth: 210 }}><BookingActions row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="card-grid" style={{ marginTop: 20 }}>
            <a className="card admin-link-card" href="/admin/customers"><span className="eyebrow">CUSTOMERS</span><h3>顧客電子資料</h3><p className="muted">搜尋顧客、紙本客資匯入、回訪次數與歷史資料。</p></a>
            <a className="card admin-link-card" href="/admin/calendar"><span className="eyebrow">CALENDAR</span><h3>預約行事曆</h3><p className="muted">以日期查看預約、保留時段與已確認行程。</p></a>
            <a className="card admin-link-card" href="/admin/services"><span className="eyebrow">SERVICES</span><h3>服務管理</h3><p className="muted">服務名稱、價格、施作時間與是否開放預約。</p></a>
          </div>
        </main>
      </div>
    </div>
  );
}
