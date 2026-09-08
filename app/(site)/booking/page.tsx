import { BookingWizard } from "@/components/booking-wizard";

export const metadata = { title: "預約" };

export default function BookingPage() {
  return (
    <section className="booking-page">
      <div className="container">
        <div className="narrow" style={{marginBottom: 34}}><span className="eyebrow">24H BOOKING</span><h1 style={{fontSize: "clamp(2.4rem,6vw,4.8rem)", marginBottom: 14}}>不用先私訊問空檔，<br />直接告訴 77 妳想來的時間。</h1><p className="muted">第一版採「送出預約需求 → 77 後台確認」；不是送出即自動成立。</p></div>
        <BookingWizard />
      </div>
    </section>
  );
}
