import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "網站設定｜管理後台" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");
  const params = await searchParams;
  const db = getAdminFirestore();
  const snapshot = db ? await db.collection("settings").doc("general").get() : null;
  const settings = snapshot?.exists ? snapshot.data() || {} : {};

  return <div className="admin-body"><div className="admin-shell">
    <AdminSidebar active="settings" />
    <main className="admin-main">
      <div className="admin-top"><div><span className="eyebrow">SETTINGS</span><h1>網站與預約設定</h1><p className="muted">把之後會常調整的營運資料放進後台，不必每次改程式。</p></div>{!db && <div className="demo-banner">尚未連接 Firebase</div>}</div>
      {params.saved && <div className="notice-box"><strong>設定已儲存</strong><p>正式網站部署後會從 Firebase 讀取這些營運設定。</p></div>}
      {params.error && <p className="form-message">{params.error}</p>}

      <section className="admin-panel">
        <div className="admin-panel-head"><div><strong>基本與預約規則</strong><div className="muted" style={{ fontSize: ".82rem" }}>「最早明天」固定為目前規則；不開放當日預約。</div></div></div>
        <form className="admin-form" action="/api/admin/settings" method="post">
          <label>店名<input name="businessName" defaultValue={String(settings.businessName || "77美學工作室")} /></label>
          <label>LINE 官方帳號網址<input name="lineOfficialUrl" type="url" defaultValue={String(settings.lineOfficialUrl || "")} placeholder="之後補" /></label>
          <label>每日第一個開始時間<input name="firstStartTime" type="time" step="1800" defaultValue={String(settings.firstStartTime || "10:00")} /></label>
          <label>每日最後一個開始時間<input name="lastStartTime" type="time" step="1800" defaultValue={String(settings.lastStartTime || "20:00")} /></label>
          <label>預設施作分鐘<input name="defaultDurationMinutes" type="number" min="30" step="30" defaultValue={Number(settings.defaultDurationMinutes || 90)} /></label>
          <label>預設整理緩衝分鐘<input name="defaultBufferMinutes" type="number" min="0" step="30" defaultValue={Number(settings.defaultBufferMinutes ?? 30)} /></label>
          <label>首次預約訂金金額<input name="firstVisitDepositAmount" type="number" min="0" defaultValue={settings.firstVisitDepositAmount ?? ""} placeholder="尚未決定可留白" /></label>
          <label>最早可預約<input value="明天（固定）" disabled /></label>
          <label className="admin-form-full">預約確認說明<textarea name="bookingNotice" rows={5} defaultValue={String(settings.bookingNotice || "送出預約需求後，需等待 77 確認；首次預約確認後再支付訂金。")} /></label>
          <div className="admin-form-full"><button className="button primary" type="submit" disabled={!db}>儲存設定</button></div>
        </form>
      </section>

      <section className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-head"><div><strong>系統狀態</strong><div className="muted" style={{ fontSize: ".82rem" }}>Firebase 專案連接後，這裡會作為正式營運設定來源。</div></div></div>
        <div className="settings-status-grid">
          <div><small>Database</small><strong>{db ? "Firebase Firestore" : "尚未連接"}</strong></div>
          <div><small>Same-day booking</small><strong>OFF</strong></div>
          <div><small>Slot interval</small><strong>30 min</strong></div>
          <div><small>Manager</small><strong>Single admin</strong></div>
        </div>
      </section>
    </main>
  </div></div>;
}
