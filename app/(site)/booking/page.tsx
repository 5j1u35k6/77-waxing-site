import { BookingWizardV2 } from "@/components/booking-wizard-v2";

export const metadata = { title: "預約" };

export default function BookingPage() {
  return (
    <section className="booking-page">
      <div className="container">
        <div className="narrow" style={{ marginBottom: 34 }}>
          <span className="eyebrow">24H BOOKING</span>
          <h1 style={{ fontSize: "clamp(2.4rem,6vw,4.8rem)", marginBottom: 14 }}>
            先挑想來的日期，<br />再像訂機票一樣比較前後空檔。
          </h1>
          <p className="muted">每 30 分鐘顯示一格；送出後先暫時保留，待 77 後台確認後才正式成立。</p>
        </div>
        <BookingWizardV2 />
      </div>
    </section>
  );
}
