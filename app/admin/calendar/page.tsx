import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { allStartTimes, blockedTimesFromStart } from "@/lib/booking-config";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "預約行事曆｜管理後台" };

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const statusLabels: Record<string, string> = {
  pending_confirmation: "待確認",
  pending_payment: "待付款",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到店",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");
  const params = await searchParams;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date || "") ? String(params.date) : taipeiToday();
  const db = getAdminFirestore();

  const rows: Array<Record<string, any>> = [];
  if (db) {
    const snapshot = await db.collection("bookings").where("preferredDate", "==", selectedDate).get();
    snapshot.docs.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
    rows.sort((a, b) => String(a.preferredTime || "").localeCompare(String(b.preferredTime || "")));
  }

  const occupancy = new Map<string, Record<string, any>>();
  rows.filter((row) => ["pending_confirmation", "pending_payment", "confirmed"].includes(String(row.status))).forEach((row) => {
    for (const time of blockedTimesFromStart(String(row.preferredTime || ""))) occupancy.set(time, row);
  });

  return <div className="admin-body"><div className="admin-shell">
    <AdminSidebar active="calendar" />
    <main className="admin-main">
      <div className="admin-top"><div><span className="eyebrow">CALENDAR</span><h1>預約行事曆</h1><p className="muted">一天一格查看 30 分鐘時段；目前服務以 90 分鐘＋30 分鐘整理時間鎖定。</p></div>{!db && <div className="demo-banner">尚未連接 Firebase</div>}</div>

      <section className="admin-panel">
        <div className="admin-panel-head admin-calendar-toolbar">
          <a className="button secondary" href={`/admin/calendar?date=${addDays(selectedDate, -1)}`}>← 前一天</a>
          <form method="get"><input name="date" type="date" defaultValue={selectedDate} /><button className="button secondary" type="submit">前往</button></form>
          <a className="button secondary" href={`/admin/calendar?date=${addDays(selectedDate, 1)}`}>後一天 →</a>
        </div>
        <div className="admin-calendar-day">
          <div className="admin-calendar-date"><small>SELECTED DATE</small><strong>{selectedDate}</strong><span>{rows.length} 筆預約紀錄</span></div>
          <div className="admin-time-grid">
            {allStartTimes().map((time) => {
              const booking = occupancy.get(time);
              const start = booking && String(booking.preferredTime) === time;
              const status = booking ? String(booking.status || "") : "";
              return <div key={time} className={`admin-time-cell${booking ? " occupied" : ""}${status === "pending_confirmation" ? " held" : ""}`}>
                <span className="admin-time-label">{time}</span>
                {booking ? <div className="admin-time-booking">
                  {start ? <><strong>{String(booking.customerName || "未命名顧客")}</strong><span>{String(booking.serviceName || "")}</span><small>{statusLabels[status] || status}</small></> : <small>延續占用</small>}
                </div> : <span className="muted">可排</span>}
              </div>;
            })}
          </div>
        </div>
      </section>
    </main>
  </div></div>;
}
