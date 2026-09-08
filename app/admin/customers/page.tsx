import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "顧客資料｜管理後台" };

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  visitCount: number;
  source: string;
  legacyRef: string | null;
  paperRecordRef: string | null;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  notes: string | null;
  updatedMs: number;
};

const sourceLabel: Record<string, string> = {
  online: "網站預約",
  admin: "後台建立",
  paper_import: "紙本匯入",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; imported?: string; updated?: string; skipped?: string; created?: string; error?: string }>;
}) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");

  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const db = getAdminFirestore();
  let rows: CustomerRow[] = [];
  let loadError = "";

  if (db) {
    try {
      const snapshot = await db.collection("customers").limit(300).get();
      rows = snapshot.docs.map((doc) => {
        const row = doc.data();
        return {
          id: doc.id,
          name: String(row.name || "未命名顧客"),
          phone: row.phone ? String(row.phone) : null,
          lineId: row.lineId ? String(row.lineId) : null,
          email: row.email ? String(row.email) : null,
          visitCount: Number(row.visitCount || 0),
          source: String(row.source || "admin"),
          legacyRef: row.legacyRef ? String(row.legacyRef) : null,
          paperRecordRef: row.paperRecordRef ? String(row.paperRecordRef) : null,
          firstVisitDate: row.firstVisitDate ? String(row.firstVisitDate) : null,
          lastVisitDate: row.lastVisitDate ? String(row.lastVisitDate) : null,
          notes: row.notes ? String(row.notes) : null,
          updatedMs: typeof row.updatedAt?.toMillis === "function" ? row.updatedAt.toMillis() : 0,
        };
      }).sort((a, b) => b.updatedMs - a.updatedMs);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "顧客資料讀取失敗";
    }
  }

  if (q) {
    rows = rows.filter((row) => [row.name, row.phone, row.lineId, row.email, row.legacyRef, row.paperRecordRef]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }

  return (
    <div className="admin-body">
      <div className="admin-shell">
        <AdminSidebar active="customers" />
        <main className="admin-main">
          <div className="admin-top">
            <div>
              <span className="eyebrow">CUSTOMER DATABASE</span>
              <h1>顧客電子資料</h1>
              <p className="muted">網站預約、後台新增與紙本舊客整合在同一份 Firestore 顧客資料庫。</p>
            </div>
            {!db && <div className="demo-banner">尚未連接 Firebase｜介面已完成，等待專案金鑰</div>}
          </div>

          {(params.imported || params.updated || params.skipped) && (
            <div className="notice-box"><strong>匯入完成</strong><p>新增 {params.imported || "0"} 筆、更新 {params.updated || "0"} 筆、略過 {params.skipped || "0"} 筆。</p></div>
          )}
          {params.created && <div className="notice-box"><strong>顧客已建立</strong><p>可以點進顧客名稱繼續補紙本資料。</p></div>}
          {(params.error || loadError) && <p className="form-message">{params.error || loadError}</p>}

          <section className="admin-panel">
            <div className="admin-panel-head">
              <div><strong>顧客清單</strong><div className="muted" style={{ fontSize: ".82rem" }}>最多顯示 300 筆，可搜尋姓名、手機、LINE、舊客編號或紙本編號。</div></div>
              <form method="get" action="/admin/customers" className="admin-search-form">
                <input name="q" defaultValue={params.q || ""} placeholder="搜尋顧客" />
                <button className="button secondary" type="submit">搜尋</button>
              </form>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>姓名</th><th>手機</th><th>LINE</th><th>回訪</th><th>首次</th><th>最近</th><th>來源</th><th>紙本／舊編號</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td><a className="admin-table-link" href={`/admin/customers/${row.id}`}><strong>{row.name}</strong></a>{row.email && <div className="muted" style={{ fontSize: ".76rem" }}>{row.email}</div>}</td>
                      <td>{row.phone || "—"}</td><td>{row.lineId || "—"}</td><td>{row.visitCount}</td>
                      <td>{row.firstVisitDate || "—"}</td><td>{row.lastVisitDate || "—"}</td>
                      <td>{sourceLabel[row.source] || row.source || "—"}</td><td>{row.paperRecordRef || row.legacyRef || "—"}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={8} className="muted">目前沒有可顯示的顧客資料。</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="admin-two-panel">
            <section className="admin-panel">
              <div className="admin-panel-head"><div><strong>手動建立顧客</strong><div className="muted" style={{ fontSize: ".82rem" }}>適合從紙本逐筆輸入，之後可再進顧客詳情補完整。</div></div></div>
              <form className="admin-form" action="/api/admin/customers/create" method="post">
                <label>姓名 *<input name="name" required /></label>
                <label>手機<input name="phone" inputMode="tel" /></label>
                <label>LINE ID<input name="lineId" /></label>
                <label>紙本編號<input name="paperRecordRef" /></label>
                <label>舊客編號<input name="legacyRef" /></label>
                <label className="admin-form-full">備註<textarea name="notes" rows={3} /></label>
                <div className="admin-form-full"><button className="button primary" type="submit" disabled={!db}>建立顧客</button></div>
              </form>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div><strong>紙本客資 CSV 匯入</strong><div className="muted" style={{ fontSize: ".82rem" }}>大量資料建議先整理成 CSV，再一次匯入。</div></div>
                <a className="button secondary" href="/customer-import-template.csv">CSV 範本</a>
              </div>
              <div style={{ padding: 20 }}>
                <form action="/api/admin/customers/import" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 14 }}>
                  <label>選擇 CSV 檔案<input type="file" name="file" accept=".csv,text/csv" required /></label>
                  <div className="notice-box" style={{ margin: 0 }}><strong>去重複規則</strong><p>優先比對手機，再比對舊客編號與紙本編號；不會自行猜測紙本沒有的資料。</p></div>
                  <div><button className="button primary" type="submit" disabled={!db}>開始匯入</button></div>
                </form>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
