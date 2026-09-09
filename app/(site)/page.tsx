import Link from "next/link";
import { PlaceholderVisual } from "@/components/placeholder-visual";
import { brand, faqs, promises, serviceGroups } from "@/lib/site-data";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">77WAXING・KEELUNG BEAUTY STUDIO</span>
            <h1>{brand.slogan}</h1>
            <p>怕痛、害羞、不知道第一次要準備什麼，都不用先變成專家。這裡把服務、流程與預約拆開說清楚，讓妳在決定以前就先感到安心。</p>
            <div className="hero-actions">
              <Link className="button primary" href="/booking">預約時段讓自己更好</Link>
              <Link className="button secondary" href="/services">77waxing提供的服務</Link>
            </div>
          </div>
          <div className="hero-art" aria-label="日式暖木質品牌視覺示意"><div className="hero-orb" /></div>
        </div>
      </section>

      <section className="section soft">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">START HERE</span><h2>第一次，不需要一次懂全部。</h2></div>
            <p className="muted">先選妳最在意的方向。服務頁協助判斷需求，價目頁之後會補上完整透明價格；預約則是獨立流程，不用私訊來回猜空檔。</p>
          </div>
          <div className="card-grid">
            {serviceGroups.slice(0,3).map((group, index) => (
              <article className="card" key={group.title}>
                <div className="number">0{index + 1}</div>
                <h3>{group.title}</h3><p>{group.subtitle}</p>
                <Link href="/services">了解服務 →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <PlaceholderVisual label="獨立包廂與空間氛圍" />
          <div>
            <span className="eyebrow">SAFE SPACE</span>
            <h2>把「會不會尷尬」先放下。</h2>
            <p>77美學工作室的第一版網站不只放漂亮照片，而是把第一次來店會發生什麼、如何準備、怎麼被照顧，直接寫在妳看得到的地方。</p>
            <div className="flow-list">
              <div className="flow-item"><div><strong>抵達與接待</strong><p className="muted">進入獨立空間，先確認今天的需求。</p></div></div>
              <div className="flow-item"><div><strong>諮詢與評估</strong><p className="muted">不確定服務也沒關係，先把擔心說出來。</p></div></div>
              <div className="flow-item"><div><strong>溫和施作與衛教</strong><p className="muted">每個步驟先說明，完成後帶走照護提醒。</p></div></div>
            </div>
            <Link className="button secondary" href="/space">看看第一次來店流程</Link>
          </div>
        </div>
      </section>

      <section className="section sage">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">77 PROMISE</span><h2>安心不是一句話，是每個細節。</h2></div></div>
          <div className="promise-grid">
            {promises.map(([n,t,d]) => <article className="promise-card" key={n}><span>{n}</span><h3>{t}</h3><p className="muted">{d}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section soft">
        <div className="container narrow">
          <span className="eyebrow">FAQ FOR FIRST-TIMERS</span><h2>小白最常先問的事</h2>
          <div className="faq-list">
            {faqs.slice(0,5).map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
          <div style={{marginTop: 28}}><Link className="button primary" href="/booking">還有疑問也可以直接預約諮詢</Link></div>
        </div>
      </section>
    </>
  );
}
