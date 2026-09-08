import { PageHero } from "@/components/page-hero";
import { PlaceholderVisual } from "@/components/placeholder-visual";
import { faqs } from "@/lib/site-data";

export default function SpacePage() {
  const flow = [
    ["找到 77美學工作室", "正式地址暫不顯示；第一版保留 Google Maps 導航入口。"],
    ["獨立空間接待", "進到空間後先確認今天的服務與身體狀況。"],
    ["諮詢", "第一次、不確定、怕痛或害羞都可以在施作前說。"],
    ["溫和施作", "每一步先說明，過程中可以隨時反映感受。"],
    ["術後衛教", "離開前確認當次適合的居家照護與下次建議。"],
  ];
  return (
    <>
      <PageHero eyebrow="SPACE & EXPERIENCE" title="看見空間，也先知道第一次會發生什麼。" description="空間頁的目的不是只展示裝潢，而是降低怕痛、害羞與尷尬的不安全感。" />
      <section className="section">
        <div className="container two-col">
          <PlaceholderVisual label="獨立包廂高畫質照片" />
          <div><span className="eyebrow">FIRST VISIT</span><h2>第一次來店流程</h2><div className="flow-list">{flow.map(([t,d]) => <div className="flow-item" key={t}><div><strong>{t}</strong><p className="muted">{d}</p></div></div>)}</div></div>
        </div>
      </section>
      <section className="section soft">
        <div className="container narrow"><span className="eyebrow">BEFORE & AFTER CARE</span><h2>小白衛教指南</h2><div className="faq-list">{faqs.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>
      </section>
    </>
  );
}
