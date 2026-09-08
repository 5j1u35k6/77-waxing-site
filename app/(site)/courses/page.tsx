import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { PlaceholderVisual } from "@/components/placeholder-visual";

export default function CoursesPage() {
  return (
    <>
      <PageHero eyebrow="COURSES" title="專業教學頁已保留，課程內容準備中。" description="企劃方向包含熱蠟創業全能班與 1 對 1 技術手法進修。第一版先讓此頁可以正常瀏覽與點擊，之後補上正式課程資料。" />
      <section className="section"><div className="container two-col"><PlaceholderVisual label="熱蠟教學與實作示意" /><div><span className="eyebrow">COMING SOON</span><h2>熱蠟創業全能班<br />1 對 1 技術進修</h2><p>未來會加入小班實操、真人模特、課後創業輔導、學員成果與專屬諮詢入口。</p><p className="muted">目前不顯示價格、時數或上課地點，以免與 77 尚未確認的正式課程方案混淆。</p><Link href="/booking" className="button secondary">先留下課程諮詢需求</Link></div></div></section>
    </>
  );
}
