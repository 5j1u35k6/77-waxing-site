import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  cta?: boolean;
};

export function PageHero({ eyebrow, title, description, cta = true }: Props) {
  return (
    <section className="page-hero">
      <div className="container narrow">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {cta && <Link href="/booking" className="button primary">前往預約</Link>}
      </div>
    </section>
  );
}
