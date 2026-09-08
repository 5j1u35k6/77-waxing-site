import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "顧客詳情｜管理後台" };

const statusLabels: Record<string, string> = {
  pending_confirmation: "待確認",
  pending_payment: "待付款",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到店",
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; error?: string }>;
}) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");

  const { id } = await params;
  const query = await searchParams;
  const db = getAdminFirestore();
  if (!db) redirect("/admin/customers?error=尚未連接Firebase");

  const ref = db.collection("customers").doc(id);
  const customerSnapshot = await ref.get();
  if (!customerSnapshot.exists) notFound();
  const customer = customerSnapshot.data() || {};

  const bookingSnapshot = await db.collection("bookings").where("customerId", "==", id).limit(100).get();
  const bookings = bookingSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, any>))
    .sort((a, b) => String(b.preferredDate || "").localeCompare(String(a.preferredDate || "")));

  return (
    <div className="admin-body">
      <div className="admin-shell">
        <AdminSidebar active="customers" />
        <main className="admin-main">
          <div className="admin-top">
            <div><a className="muted" href="/admin/customers">← 回顧客清單</a><h1>{String(customer.name || "未命名顧客")}</h1><p className="muted">顧客 ID：{id}</p></div>
            <span className="status">{String(customer.source || "admin")}</span>
          </div>

          {(query.saved || query.created) && <div className="notice-box"><strong>資料已儲存</strong><p>這份顧客資料已更新到 Firebase。</p></div>}
          {query.error && <p className="form-message">{query.error}</p>}

          <section className="admin-panel">
            <div className="admin-panel-head"><div><strong>基本資料</strong><div className="muted" style={{ fontSize: ".82rem" }}>紙本資料可以逐欄補進這裡，不需要一次全部完成。</div></div></div>
            <form className="admin-form" action="/api/admin/customers/update" method="post">
              <input type="hidden" name="customerId" value={id} />
              <input type="hidden" name="oldPhone" value={String(customer.phone || "")} />
              <label>姓名 *<input name="name" required defaultValue={String(customer.name || "")} /></label>
              <label>手機<input name="phone" inputMode="tel" defaultValue={String(customer.phone || "")} /></label>
              <label>LINE ID<input name="lineId" defaultValue={String(customer.lineId || "")} /></label>
              <label>Email<input name="email" type="email" defaultValue={String(customer.email || "")} /></label>
              <label>舊客編號<input name="legacyRef" defaultValue={String(customer.legacyRef || "")} /></label>
              <label>紙本編號<input name="paperRecordRef" defaultValue={String(customer.paperRecordRef || "")} /></label>
              <label>首次來店日期<input name="firstVisitDate" type="date" defaultValue={String(customer.firstVisitDate || "")} /></label>
              <label>最近來店日期<input name="lastVisitDate" type="date" defaultValue={String(customer.lastVisitDate || "")} /></label>
              <label>已完成來店次數<input name="visitCount" type="number" min="0" defaultValue={Number(customer.visitCount || 0)} /></label>
              <label>回訪預設訂金<select name="defaultDepositRequired" defaultValue={customer.defaultDepositRequired === true ? "yes" : customer.defaultDepositRequired === false ? "no" : "auto"}><option value="auto">每次決定</option><option value="yes">預設需要</option><option value="no">預設免收</option></select></label>
              <label className="admin-form-full">顧客備註<textarea name="notes" rows={6} defaultValue={String(customer.notes || "")} placeholder="例如：偏好、紙本備註、服務注意事項（只記錄營運必要資訊）" /></label>
              <div className="admin-form-full"><button className="button primary" type="submit">儲存顧客資料</button></div>
            </form>
          </section>

          <section className="admin-panel" style={{ marginTop: 20 }}>
            <div className="admin-panel-head"><div><strong>歷史預約</strong><div className="muted" style={{ fontSize: ".82rem" }}>最多顯示最近 100 筆。</div></div><span className="status">{bookings.length} 筆</span></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>日期</th><th>時間</th><th>服務</th><th>狀態</th><th>訂金</th><th>備註</th></tr></thead>
                <tbody>
                  {bookings.map((booking) => <tr key={String(booking.id)}>
                    <td>{String(booking.preferredDate || "—")}</td><td>{String(booking.preferredTime || "—")}</td><td>{String(booking.serviceName || "—")}</td>
                    <td>{statusLabels[String(booking.status || "")] || String(booking.status || "—")}</td>
                    <td>{booking.depositRequired === true ? "需收" : booking.depositRequired === false ? "免收" : "待決定"}</td>
                    <td>{String(booking.note || "—")}</td>
                  </tr>)}
                  {!bookings.length && <tr><td colSpan={6} className="muted">尚無預約紀錄。</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
