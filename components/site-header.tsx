"use client";

import Link from "next/link";
import { useState } from "react";
import { brand, navItems } from "@/lib/site-data";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand-mark" onClick={() => setOpen(false)}>
          <span className="brand-77">77</span>waxing
        </Link>
        <button className="menu-toggle" aria-label="切換選單" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span />
          <span />
        </button>
        <nav className={open ? "site-nav is-open" : "site-nav"}>
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>
          ))}
          <Link href="/booking" className="nav-booking" onClick={() => setOpen(false)}>立即預約</Link>
        </nav>
      </div>
      <div className="mobile-brand-note">{brand.name}</div>
    </header>
  );
}
