"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10_000;

export function AdminAutoRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const enabled =
    pathname === "/admin" ||
    pathname.startsWith("/admin/bookings") ||
    pathname.startsWith("/admin/calendar");

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, router]);

  return null;
}
