import Link from "next/link";

export const metadata = { title: "後台登入" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; setup?: string }> }) {
  const params = await searchParams;
  return (
    <div className="admin-body">
      <main className="admin-login">
        <section className="login-card">
          <span className="eyebrow">77WAXING ADMIN</span>
          <h1 style={{fontSize: "2.2rem", marginBottom: 8}}>管理後台</h1>
          <p className="muted">第一版為單一管理者登入。前台顧客不需要建立帳號。</p>
          {params.setup && <p className="form-message">尚未設定 ADMIN_PASSWORD / ADMIN_SESSION_TOKEN，請先完成環境變數。</p>}
          {params.error && <p className="form-message">密碼不正確，請再試一次。</p>}
          <form method="post" action="/api/admin/login">
            <label>管理密碼<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="button primary" type="submit">登入後台</button>
          </form>
          <div style={{marginTop: 18}}><Link href="/" className="muted">← 回前台網站</Link></div>
        </section>
      </main>
    </div>
  );
}
