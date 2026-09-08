type AdminSection = "dashboard" | "bookings" | "calendar" | "customers" | "services" | "settings";

const items: Array<[AdminSection, string, string]> = [
  ["dashboard", "Dashboard", "/admin"],
  ["bookings", "預約管理", "/admin/bookings"],
  ["calendar", "預約行事曆", "/admin/calendar"],
  ["customers", "顧客資料", "/admin/customers"],
  ["services", "服務管理", "/admin/services"],
  ["settings", "網站設定", "/admin/settings"],
];

export function AdminSidebar({ active }: { active: AdminSection }) {
  return (
    <aside className="admin-sidebar">
      <div className="brand-mark"><span className="brand-77">77</span>waxing</div>
      <div className="admin-system-label">FIREBASE BACK OFFICE</div>
      <nav className="admin-nav">
        {items.map(([key, label, href]) => (
          <a key={key} className={active === key ? "active" : undefined} href={href}>{label}</a>
        ))}
        <form action="/api/admin/logout" method="post"><button type="submit">登出</button></form>
      </nav>
    </aside>
  );
}
