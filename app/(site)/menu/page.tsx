import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { serviceGroups } from "@/lib/site-data";

export default function MenuPage() {
  return (
    <>
      <PageHero eyebrow="MENU" title="價格透明，正式價目補上後直接在這裡查。" description="企劃將價目頁定位為已知道需求、想快速確認預算的入口。目前尚未取得最新 IG 價目，因此第一版不自行杜撰價格。" />
      <section className="section">
        <div className="container narrow">
          <div className="notice-box"><strong>第一版資料狀態</strong><p>服務分類已完成；單項價格、施作時間與首次體驗方案待 77 最新價目表補上後更新。</p></div>
          <div className="menu-table">
            {serviceGroups.map((group) => (
              <div className="menu-row" key={group.title}>
                <strong>{group.title}</strong>
                <p className="muted">{group.items.join("・")}</p>
                <span className="price-placeholder">價格待補</span>
              </div>
            ))}
          </div>
          <div style={{marginTop: 30}}><Link href="/booking" className="button primary">先送出預約需求</Link></div>
        </div>
      </section>
    </>
  );
}
