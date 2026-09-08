"use client";

import { FormEvent, useMemo, useState } from "react";
import { bookingServices } from "@/lib/site-data";

type FormState = {
  service: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  lineId: string;
  firstVisit: string;
  note: string;
  privacy: boolean;
};

const initial: FormState = {
  service: "",
  date: "",
  time: "",
  name: "",
  phone: "",
  lineId: "",
  firstVisit: "yes",
  note: "",
  privacy: false,
};

export function BookingWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const minDate = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);
  const update = (key: keyof FormState, value: string | boolean) => setForm((s) => ({ ...s, [key]: value }));

  const next = () => {
    if (step === 1 && !form.service) return setMessage("請先選擇服務。");
    if (step === 2 && (!form.date || !form.time)) return setMessage("請選擇日期與希望時段。");
    setMessage("");
    setStep((s) => Math.min(4, s + 1));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.privacy) {
      setMessage("請填寫姓名、手機並勾選隱私同意。");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "送出失敗");
      setSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "預約送出失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="booking-success">
        <span className="eyebrow">BOOKING REQUEST RECEIVED</span>
        <h2>預約需求已送出</h2>
        <p>目前不是自動成立。77 確認服務與時段後，才會通知妳是否正式成立。</p>
        <div className="notice-box">
          <strong>訂金規則</strong>
          <p>首次預約：77 確認後需支付訂金。回訪顧客：由 77 在後台依該次預約決定是否需要訂金。</p>
        </div>
        <button className="button secondary" onClick={() => { setForm(initial); setStep(1); setSent(false); }}>再建立一筆預約</button>
      </div>
    );
  }

  return (
    <div className="booking-shell">
      <div className="booking-progress" aria-label="預約進度">
        {["服務", "日期", "資料", "確認"].map((label, i) => (
          <div key={label} className={step >= i + 1 ? "progress-item active" : "progress-item"}>
            <span>{i + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        {step === 1 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 01</span>
            <h2>今天想預約什麼？</h2>
            <p className="muted">不確定也沒關係，可以直接選「想先請 77 建議」。</p>
            <div className="choice-grid">
              {bookingServices.map((service) => (
                <button type="button" key={service} className={form.service === service ? "choice-card selected" : "choice-card"} onClick={() => update("service", service)}>{service}</button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 02</span>
            <h2>選擇希望日期與時段</h2>
            <div className="field-grid two">
              <label>希望日期<input type="date" min={minDate} value={form.date} onChange={(e) => update("date", e.target.value)} /></label>
              <label>希望時段<select value={form.time} onChange={(e) => update("time", e.target.value)}><option value="">請選擇</option><option>10:00 - 12:00</option><option>12:00 - 14:00</option><option>14:00 - 16:00</option><option>16:00 - 18:00</option><option>18:00 - 20:00</option></select></label>
            </div>
            <div className="notice-box"><strong>第一版提醒</strong><p>目前採「預約需求」模式，送出後由 77 後台確認是否有空檔；之後可升級成真正即時空檔鎖定。</p></div>
          </section>
        )}

        {step === 3 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 03</span>
            <h2>留下聯絡資料</h2>
            <div className="field-grid two">
              <label>姓名 *<input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="怎麼稱呼妳／你" /></label>
              <label>手機 *<input inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="09xx-xxx-xxx" /></label>
              <label>LINE ID<input value={form.lineId} onChange={(e) => update("lineId", e.target.value)} placeholder="可稍後補" /></label>
              <label>第一次來店？<select value={form.firstVisit} onChange={(e) => update("firstVisit", e.target.value)}><option value="yes">是，第一次</option><option value="no">不是，我來過</option></select></label>
            </div>
            <label>想先告訴 77 的事<textarea value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="例如：第一次很緊張、近期有刮毛、想先詢問適合的項目…" /></label>
          </section>
        )}

        {step === 4 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 04</span>
            <h2>確認預約需求</h2>
            <dl className="summary-list">
              <div><dt>服務</dt><dd>{form.service}</dd></div>
              <div><dt>日期</dt><dd>{form.date}</dd></div>
              <div><dt>時段</dt><dd>{form.time}</dd></div>
              <div><dt>姓名</dt><dd>{form.name || "尚未填寫"}</dd></div>
              <div><dt>首次來店</dt><dd>{form.firstVisit === "yes" ? "是" : "否"}</dd></div>
            </dl>
            <label className="check-row"><input type="checkbox" checked={form.privacy} onChange={(e) => update("privacy", e.target.checked)} /><span>我同意 77美學工作室為處理本次預約而使用我填寫的聯絡資料。</span></label>
            <div className="notice-box"><strong>預約不是送出即成立</strong><p>送出後狀態為「待確認」。首次預約由 77 確認後通知訂金支付；回訪顧客則由 77 決定該次是否需要訂金。</p></div>
          </section>
        )}

        {message && <p className="form-message">{message}</p>}
        <div className="booking-actions">
          {step > 1 && <button type="button" className="button text" onClick={() => { setMessage(""); setStep((s) => s - 1); }}>上一步</button>}
          {step < 4 ? <button type="button" className="button primary" onClick={next}>下一步</button> : <button type="submit" className="button primary" disabled={loading}>{loading ? "送出中…" : "送出預約需求"}</button>}
        </div>
      </form>
    </div>
  );
}
