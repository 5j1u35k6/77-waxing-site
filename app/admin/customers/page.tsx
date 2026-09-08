import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "顧客資料｜管理後台" };

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  line_id: string | null;
  email: string | null;
  visit_count: number;
  source: string;
  legacy_ref: string | null;
  paper_record_ref: string | null;
  first_visit_date: string | null;
  last_visit_date: string | null;
  notes: string | null;
};

const sourceLabel: Record<string, string> = {
  online: "網站預約",
  admin: "後台建立",
  paper_import: "紙本匯入",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; imported?: string; updated?: string; skipped?: string; error?: string }>;
}) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) redirect("/admin/login");

  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const supabase = getAdminSupabase();
  let rows: CustomerRow[] = [];
  let loadError = "";

  if (supabase) {
    const result = await supabase
      .from("customers")
      .select("id,name,phone,line_id,email,visit_count,source,legacy_ref,paper_record_ref,first_visit_date,last_visit_date,notes")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (result.error) loadError = result.error.message;
    else rows = (result.data || []) as CustomerRow[];
  }

  if (q) {
    rows = rows.filter((row) => [row.name, row.phone, row.line_id, row.email, row.legacy_ref, row.paper_record_ref]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }

  return (
    <div className="admin-body">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="brand-mark"><span className="brand-77">77</span>waxing</div>
          <nav className="admin-nav">
            <a href="/admin">Dashboard</a>
            <a href="/admin#bookings">預約管理</a>
            <a className="active" href="/admin/customers">顧客資料</a>
            <a href="/admin#services">服務管理</a>
            <a href="/admin#calendar">預約行事曆</a>
            <form action="/api/admin/logout" method="post"><button type="submit">登出</button></form>
          </nav>
        </aside>

        <main className="admin-main">
          <div className="admin-top">
            <div>
              <span className="eyebrow">CUSTOMER DATABASE</span>
              <h1>顧客電子資料</h1>
              <p className="muted">網站預約與紙本舊客會逐步整合到同一份顧客資料庫，以電話、舊客編號或紙本編號協助避免重複。</p>
            </div>
            {!supabase && <div className="demo-banner">尚未連接 Supabase｜目前只完成資料結構與匯入介面</div>}
          </div>

          {(params.imported || params.updated || params.skipped) && (
            <div className="notice-box">
              <strong>匯入完成</strong>
              <p>新增 {params.imported || "0"} 筆、更新 {params.updated || "0"} 筆、略過 {params.skipped || "0"} 筆。</p>
            </div>
          )}
          {(params.error || loadError) && <p className="form-message">{params.error || loadError}</p>}

          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <strong>顧客清單</strong>
                <div className="muted" style={{ fontSize: ".82rem" }}>目前最多顯示最近更新的 300 筆。</div>
              </div>
              <form method="get" action="/admin/customers" style={{ display: "flex", gap: 8 }}>
                <input name="q" defaultValue={params.q || ""} placeholder="搜尋姓名／手機／LINE／舊編號" style={{ minWidth: 260 }} />
                <button className="button secondary" type="submit">搜尋</button>
              </form>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>姓名</th><th>手機</th><th>LINE</th><th>回訪</th><th>首次</th><th>最近</th><th>來源</th><th>紙本／舊編號</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.name}</strong>{row.email && <div className="muted" style={{ fontSize: ".76rem" }}>{row.email}</div>}</td>
                      <td>{row.phone || "—"}</td>
                      <td>{row.line_id || "—"}</td>
                      <td>{row.visit_count || 0}</td>
                      <td>{row.first_visit_date || "—"}</td>
                      <td>{row.last_visit_date || "—"}</td>
                      <td>{sourceLabel[row.source] || row.source || "—"}</td>
                      <td>{row.paper_record_ref || row.legacy_ref || "—"}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={8} className="muted">目前沒有可顯示的顧客資料。</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-panel" style={{ marginTop: 20 }}>
            <div className="admin-panel-head">
              <div>
                <strong>紙本客資匯入</strong>
                <div className="muted" style={{ fontSize: ".82rem" }}>先整理成 CSV，再由後台匯入；不會自行猜測紙本沒有的欄位。</div>
              </div>
              <a className="button secondary" href="/customer-import-template.csv">下載 CSV 範本</a>
            </div>
            <div style={{ padding: 20 }}>
              <form action="/api/admin/customers/import" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 14 }}>
                <label>選擇 CSV 檔案<input type="file" name="file" accept=".csv,text/csv" required /></label>
                <div className="notice-box" style={{ margin: 0 }}>
                  <strong>目前可承接欄位</strong>
                  <p>姓名、手機、LINE ID、Email、回訪次數、舊客編號、紙本編號、首次來店日期、最近來店日期、備註。至少需有姓名，以及手機／舊客編號／紙本編號其中一項，才會匯入。</p>
                </div>
                <div><button className="button primary" type="submit" disabled={!supabase}>開始匯入紙本客資</button></div>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
