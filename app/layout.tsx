import type { Metadata } from "next";
import "./globals.css";
import "./booking-calendar.css";
import "./booking-v3.css";
import "./header-motion.css";

export const metadata: Metadata = {
  title: { default: "77美學工作室｜77waxing", template: "%s｜77waxing" },
  description: "77美學工作室品牌官網第一版。熱蠟除毛、肌膚管理、美胸保養與專業教學，提供第一次也能安心理解的服務與預約動線。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
