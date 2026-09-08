import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "服務管理｜管理後台" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ saved?: string; seeded?: string; error?: string }> }) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");
  const params = await searchParams;
  const db = getAdminFirestore();
  const services: Array<Record<string, any>> = [];

  if (db) {
    const snapshot = await db.collection("services").get();
    snapshot.docs.forEach((doc) => services.push({ id: doc.id, ...doc.data() }));
    services.sort((a, b) => String(a.category || "").localeCompare(String(b.category || ""), "zh-Hant") || String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
  }

  return <div className="admin-body"><div className="admin-shell">
    <AdminSidebar active="services" />
    <main className="admin-main">
      <div className="admin-top"><div><span className="eyebrow">SERVICES</span><h1>服務管理</h1><p className="muted">正式價目、施作時間、整理時間與是否開放預約都集中管理。</p></div>{!db && <div className="demo-banner">尚未連接 Firebase</div>}</div>
      {(params.saved || params.seeded) && <div className="notice-box"><strong>服務資料已更新</strong><p>資料已寫入 Firebase。</p></div>}
      {params.error && <p className="form-message">{params.error}</p>}

      <section className="admin-panel">
        <div className="admin-panel-head"><div><strong>新增服務</strong><div className="muted" style={{ fontSize: ".82rem" }}>價格可先留白；目前預約占用邏輯預設 90＋30 分鐘。</div></div>
          {db && services.length === 0 && <form action="/api/admin/services/action" method="post"><input type="hidden" name="action" value="seed" /><button className="button secondary" type="submit">建立目前預設服務</button></form>}
        </div>
        <form className="admin-form" action="/api/admin/services/action" method="post">
          <input type="hidden" name="action" value="create" />
          <label>服務名稱 *<input name="name" required /></label><label>分類 *<input name="category" required placeholder="女性熱蠟" /></label>
          <label>價格（NT$）<input name="price" type="number" min="0" /></label><label>施作分鐘<input name="durationMinutes" type="number" min="30" step="30" defaultValue="90" /></label>
          <label>整理緩衝分鐘<input name="bufferMinutes" type="number" min="0" step="30" defaultValue="30" /></label><label>開放預約<select name="active" defaultValue="yes"><option value="yes">是</option><option value="no">否</option></select></label>
          <div className="admin-form-full"><button className="button primary" type="submit" disabled={!db}>新增服務</button></div>
        </form>
      </section>

      <section className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-head"><div><strong>現有服務</strong><div className="muted" style={{ fontSize: ".82rem" }}>停用服務不會刪除過去預約紀錄。</div></div><span className="status">{services.length} 項</span></div>
        <div className="admin-service-list">
          {services.map((service) => <form key={String(service.id)} className="admin-service-row" action="/api/admin/services/action" method="post">
            <input type="hidden" name="action" value="update" /><input type="hidden" name="serviceId" value={String(service.id)} />
            <label>名稱<input name="name" defaultValue={String(service.name || "")} required /></label>
            <label>分類<input name="category" defaultValue={String(service.category || "")} required /></label>
            <label>價格<input name="price" type="number" min="0" defaultValue={service.price ?? ""} /></label>
            <label>施作<input name="durationMinutes" type="number" min="30" step="30" defaultValue={Number(service.durationMinutes || 90)} /></label>
            <label>緩衝<input name="bufferMinutes" type="number" min="0" step="30" defaultValue={Number(service.bufferMinutes ?? 30)} /></label>
            <label>狀態<select name="active" defaultValue={service.active === false ? "no" : "yes"}><option value="yes">開放</option><option value="no">停用</option></select></label>
            <button className="button secondary" type="submit">儲存</button>
          </form>)}
          {!services.length && <div className="admin-empty">尚無服務資料。連接 Firebase 後可先按「建立目前預設服務」。</div>}
        </div>
      </section>
    </main>
  </div></div>;
}
