import { PageHero } from "@/components/page-hero";
import { PlaceholderVisual } from "@/components/placeholder-visual";
import { promises } from "@/lib/site-data";

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="ABOUT 77" title="從香港到台灣，把細心變成一間有溫度的工作室。" description="77waxing 的品牌故事不是要把距離拉遠，而是讓第一次來的人知道：這裡有人願意耐心陪妳把緊張說完。" />
      <section className="section">
        <div className="container two-col">
          <div>
            <span className="eyebrow">BRAND STORY</span>
            <h2>香港女孩移居台灣的創業故事</h2>
            <p>企劃把 77 的個人 IP 與創業故事視為品牌最重要的信任來源之一。第一版網站先保留完整故事區塊，等正式訪談文案補上後即可替換，不需要重新設計頁面。</p>
            <p className="muted">目前先以企劃內容為基礎，不額外杜撰搬遷年份、學習歷程或個人經歷。</p>
          </div>
          <PlaceholderVisual label="77 個人品牌形象照" />
        </div>
      </section>
      <section className="section soft">
        <div className="container">
          <span className="eyebrow">OUR PROMISE</span><h2>職人 4 大承諾</h2>
          <div className="promise-grid">
            {promises.map(([n,t,d]) => <article className="promise-card" key={n}><span>{n}</span><h3>{t}</h3><p className="muted">{d}</p></article>)}
          </div>
        </div>
      </section>
    </>
  );
}
