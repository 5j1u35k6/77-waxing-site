import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "預約管理｜管理後台" };

const statusLabels: Record<string, string> = {
  pending_confirmation: "待確認",
  pending_payment: "待付款",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到店",
};

type Row = {
  id: string;
  customerName: string;
  customerPhone: string;
  preferredDate: string;
  preferredTime: string;
  serviceName: string;
  status: string;
  isFirstVisit: boolean;
  depositRequired: boolean | null;
  paymentStatus: string;
  note: string;
};

function Actions({ row }: { row: Row }) {
  const Action = ({ action, children }: { action: string; children: React.ReactNode }) => (
    <form action="/api/admin/bookings/action" method="post" style={{ display: "inline" }}>
      <input type="hidden" name="bookingId" value={row.id} /><input type="hidden" name="action" value={action} />
      <button className="button secondary admin-mini-button" type="submit">{children}</button>
    </form>
  );
  if (row.status === "pending_confirmation") return <><Action action="confirm_deposit">確認＋收訂金</Action>{!row.isFirstVisit && <Action action="confirm_no_deposit">確認免訂金</Action>}<Action action="cancel">取消</Action></>;
  if (row.status === "pending_payment") return <><Action action="mark_paid">標記已付款</Action><Action action="cancel">取消</Action></>;
  if (row.status === "confirmed") return <><Action action="complete">完成服務</Action><Action action="no_show">未到店</Action><Action action="cancel">取消</Action></>;
  return <span className="muted">—</span>;
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; date?: string; error?: string; updated?: string }> }) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");
  const params = await searchParams;
  const db = getAdminFirestore();
  let rows: Row[] = [];

  if (db) {
    const snapshot = await db.collection("bookings").limit(300).get();
    rows = snapshot.docs.map((doc) => {
      const value = doc.data();
      return {
        id: doc.id,
        customerName: String(value.customerName || "未命名顧客"),
        customerPhone: String(value.customerPhone || ""),
        preferredDate: String(value.preferredDate || ""),
        preferredTime: String(value.preferredTime || ""),
        serviceName: String(value.serviceName || ""),
        status: String(value.status || "pending_confirmation"),
        isFirstVisit: Boolean(value.isFirstVisit),
        depositRequired: value.depositRequired === true ? true : value.depositRequired === false ? false : null,
        paymentStatus: String(value.paymentStatus || "not_requested"),
        note: String(value.note || ""),
      };
    }).sort((a, b) => `${a.preferredDate} ${a.preferredTime}`.localeCompare(`${b.preferredDate} ${b.preferredTime}`));
  }

  const q = (params.q || "").trim().toLowerCase();
  if (q) rows = rows.filter((row) => [row.customerName, row.customerPhone, row.serviceName, row.note].some((value) => value.toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((row) => row.status === params.status);
  if (params.date) rows = rows.filter((row) => row.preferredDate === params.date);

  return <div className="admin-body"><div className="admin-shell">
    <AdminSidebar active="bookings" />
    <main className="admin-main">
      <div className="admin-top"><div><span className="eyebrow">BOOKINGS</span><h1>預約管理</h1><p className="muted">待確認、訂金、已確認、完成、取消與未到店都在這裡處理。</p></div>{!db && <div className="demo-banner">尚未連接 Firebase</div>}</div>
      {params.updated && <div className="notice-box"><strong>預約已更新</strong><p>時段鎖定狀態也已同步更新。</p></div>}
      {params.error && <p className="form-message">{params.error}</p>}

      <section className="admin-panel">
        <div className="admin-panel-head admin-filter-head">
          <div><strong>全部預約</strong><div className="muted" style={{ fontSize: ".82rem" }}>最多載入 300 筆。</div></div>
          <form className="admin-filter-form" method="get">
            <input name="q" placeholder="姓名／手機／服務" defaultValue={params.q || ""} />
            <input name="date" type="date" defaultValue={params.date || ""} />
            <select name="status" defaultValue={params.status || ""}><option value="">全部狀態</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <button className="button secondary" type="submit">篩選</button>
          </form>
        </div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>日期</th><th>顧客</th><th>服務</th><th>狀態</th><th>訂金</th><th>付款</th><th>備註</th><th>操作</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}>
            <td><strong>{row.preferredDate || "—"}</strong><div className="muted">{row.preferredTime || "—"}</div></td>
            <td><strong>{row.customerName}</strong><div className="muted">{row.customerPhone || "—"}</div><small>{row.isFirstVisit ? "新客" : "回訪"}</small></td>
            <td>{row.serviceName || "—"}</td><td>{statusLabels[row.status] || row.status}</td>
            <td>{row.depositRequired === true ? "需收" : row.depositRequired === false ? "免收" : "待決定"}</td><td>{row.paymentStatus}</td><td>{row.note || "—"}</td>
            <td className="admin-action-cell"><Actions row={row} /></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={8} className="muted">目前沒有符合條件的預約。</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  </div></div>;
}
