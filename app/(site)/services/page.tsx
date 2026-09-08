import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { serviceGroups } from "@/lib/site-data";

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="SERVICES" title="不是先看價格，而是先找到適合自己的服務。" description="依需求與情境選擇女性熱蠟、男士熱蠟、肌膚管理或美胸保養。第一次不確定項目，也可以在預約時直接請 77 建議。" />
      <section className="section">
        <div className="container service-stack">
          {serviceGroups.map((group, i) => (
            <article className="service-row" key={group.title}>
              <div><span className="eyebrow">0{i + 1}</span><h2>{group.title}</h2></div>
              <div><p>{group.subtitle}</p><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul><span className="pain-pill">痛感／舒適度：{group.pain}</span></div>
            </article>
          ))}
          <div style={{marginTop: 24}}><Link href="/booking" className="button primary">不確定也可以直接預約</Link></div>
        </div>
      </section>
    </>
  );
}
