"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { brand, navItems } from "@/lib/site-data";

const englishLabels: Record<string, string> = {
  "/about": "ABOUT",
  "/services": "SERVICES",
  "/menu": "MENU",
  "/space": "SPACE",
  "/courses": "COURSES",
  "/booking": "BOOKING",
};

function NavLabel({ zh, en }: { zh: string; en: string }) {
  return (
    <span className="nav-label">
      <strong className="nav-zh">{zh}</strong>
      <small className="nav-en">{en}</small>
    </span>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const moveIndicator = useCallback((target: HTMLElement | null) => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator || !target) {
      if (indicator) indicator.style.opacity = "0";
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    indicator.style.width = `${targetRect.width}px`;
    indicator.style.height = `${targetRect.height}px`;
    indicator.style.transform = `translate3d(${targetRect.left - navRect.left}px, ${targetRect.top - navRect.top}px, 0)`;
    indicator.style.opacity = "1";
  }, []);

  const moveToCurrent = useCallback(() => {
    const key = pathname === "/booking" ? "/booking-cta" : pathname;
    moveIndicator(linkRefs.current[key] || null);
  }, [moveIndicator, pathname]);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.innerWidth > 900 || open) moveToCurrent();
    });
    const onResize = () => {
      if (window.innerWidth > 900 || open) moveToCurrent();
      else if (indicatorRef.current) indicatorRef.current.style.opacity = "0";
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [moveToCurrent, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeMenu]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand-mark" onClick={closeMenu}>
          <span className="brand-77">77</span>waxing
        </Link>
        <button
          className={open ? "menu-toggle is-open" : "menu-toggle"}
          aria-label={open ? "關閉選單" : "開啟選單"}
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
        {open && <button className="site-nav-backdrop" aria-label="關閉選單" onClick={closeMenu} />}
        <nav
          id="primary-navigation"
          ref={navRef}
          className={open ? "site-nav is-open" : "site-nav"}
          onMouseLeave={moveToCurrent}
        >
          <span ref={indicatorRef} className="nav-motion-indicator" aria-hidden="true" />
          {navItems.filter(([, href]) => href !== "/booking").map(([label, href]) => (
            <Link
              key={href}
              href={href}
              ref={(node) => { linkRefs.current[href] = node; }}
              className={pathname === href ? "nav-current" : undefined}
              onMouseEnter={(event) => moveIndicator(event.currentTarget)}
              onFocus={(event) => moveIndicator(event.currentTarget)}
              onClick={closeMenu}
            >
              <NavLabel zh={label} en={englishLabels[href] || ""} />
            </Link>
          ))}
          <Link
            href="/booking"
            ref={(node) => { linkRefs.current["/booking-cta"] = node; }}
            className={pathname === "/booking" ? "nav-booking nav-current" : "nav-booking"}
            onMouseEnter={(event) => moveIndicator(event.currentTarget)}
            onFocus={(event) => moveIndicator(event.currentTarget)}
            onClick={closeMenu}
          >
            <NavLabel zh="立即預約" en="BOOKING" />
          </Link>
        </nav>
      </div>
      <div className="mobile-brand-note">{brand.name}</div>
    </header>
  );
}
