import Link from "next/link";
import { brand, navItems } from "@/lib/site-data";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand"><span>77</span>waxing</div>
          <p>{brand.name}</p>
          <p className="muted">把第一次的緊張，交給 77 的細心與溫柔。</p>
        </div>
        <div>
          <h3>網站導覽</h3>
          <div className="footer-links">
            {navItems.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
        </div>
        <div>
          <h3>聯絡 77</h3>
          <a href={brand.instagram} target="_blank" rel="noreferrer">Instagram {brand.handle}</a>
          <a href={brand.mapUrl} target="_blank" rel="noreferrer">Google Maps｜77美學工作室</a>
          <p className="muted">LINE 官方帳號｜即將補上</p>
        </div>
      </div>
      <div className="container footer-bottom">© {new Date().getFullYear()} 77waxing. First edition website.</div>
    </footer>
  );
}
