"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type SlotState = "available" | "held";
type AvailabilityDay = {
  date: string;
  isPast: boolean;
  slots: { time: string; state: SlotState }[];
};
type AvailabilityResponse = {
  anchor: string;
  earliestDate: string;
  startDate: string;
  endDate: string;
  demoMode: boolean;
  durationMinutes: number;
  turnoverBufferMinutes: number;
  blockMinutes: number;
  days: AvailabilityDay[];
};

const emptyForm: Omit<FormState, "date"> = {
  service: "",
  time: "",
  name: "",
  phone: "",
  lineId: "",
  firstVisit: "yes",
  note: "",
  privacy: false,
};

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatCalendarDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date);
}

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function moveMonth(value: string, offset: number) {
  const date = parseCalendarDate(value);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return formatCalendarDate(date);
}

function calendarCells(monthValue: string) {
  const first = parseCalendarDate(monthStart(monthValue));
  const firstWeekday = first.getUTCDay();
  const nextMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
  const daysInMonth = Math.round((nextMonth.getTime() - first.getTime()) / 86_400_000);
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(value: string) {
  const date = parseCalendarDate(value);
  return `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月`;
}

function shortDateLabel(value: string) {
  const date = parseCalendarDate(value);
  return {
    weekday: `週${weekdays[date.getUTCDay()]}`,
    date: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
    day: String(date.getUTCDate()),
  };
}

export function BookingWizardV2() {
  const today = useMemo(() => taipeiToday(), []);
  const earliestDate = useMemo(() => addDays(today, 1), [today]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...emptyForm, date: earliestDate });
  const [anchorDate, setAnchorDate] = useState(earliestDate);
  const [calendarMonth, setCalendarMonth] = useState(monthStart(earliestDate));
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const cells = useMemo(() => calendarCells(calendarMonth), [calendarMonth]);
  const selectedAvailabilityDay = useMemo(
    () => availability?.days.find((day) => day.date === form.date) || availability?.days[0] || null,
    [availability, form.date],
  );

  const update = (key: keyof FormState, value: string | boolean) => {
    setForm((state) => ({ ...state, [key]: value }));
  };

  useEffect(() => {
    if (!anchorDate) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ anchor: anchorDate });
    if (form.service) params.set("service", form.service);

    setAvailabilityLoading(true);
    fetch(`/api/availability?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "讀取空檔失敗");
        setAvailability(data);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "目前無法讀取空檔。");
      })
      .finally(() => setAvailabilityLoading(false));

    return () => controller.abort();
  }, [anchorDate, form.service, availabilityRefresh]);

  const chooseService = (service: string) => {
    setForm((state) => ({ ...state, service, time: "" }));
    setMessage("");
  };

  const chooseAnchorDate = (date: string) => {
    if (date < earliestDate) return;
    setAnchorDate(date);
    setForm((state) => ({ ...state, date, time: "" }));
    setCalendarMonth(monthStart(date));
    setMessage("");
  };

  const chooseWindowDate = (date: string) => {
    setForm((state) => ({ ...state, date, time: "" }));
    setMessage("");
  };

  const chooseSlot = (date: string, time: string) => {
    setForm((state) => ({ ...state, date, time }));
    setMessage("");
  };

  const next = () => {
    if (step === 1 && !form.service) return setMessage("請先選擇服務。");
    if (step === 2 && (!form.date || !form.time)) return setMessage("請選擇日期與可預約的半小時時段。");
    setMessage("");
    setStep((current) => Math.min(4, current + 1));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name || !form.phone || !form.privacy) {
      setMessage("請填寫姓名、手機並勾選隱私同意。");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setStep(2);
          setForm((state) => ({ ...state, time: "" }));
          setAvailabilityRefresh((value) => value + 1);
        }
        throw new Error(data.error || "送出失敗");
      }
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
        <p>這筆預約現在會先保留對應時段，所有服務都會同步反映這段時間。77 確認後，重疊時段會從可預約清單移除。</p>
        <div className="notice-box">
          <strong>訂金規則</strong>
          <p>首次預約：77 確認後需支付訂金。回訪顧客：由 77 在後台依該次預約決定是否需要訂金。</p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            const nextDate = addDays(taipeiToday(), 1);
            setForm({ ...emptyForm, date: nextDate });
            setAnchorDate(nextDate);
            setCalendarMonth(monthStart(nextDate));
            setAvailabilityRefresh((value) => value + 1);
            setStep(1);
            setSent(false);
          }}
        >
          再建立一筆預約
        </button>
      </div>
    );
  }

  const renderSlots = (day: AvailabilityDay, mobile = false) => (
    <div className={mobile ? "mobile-slot-grid" : "slot-list"}>
      {day.slots.map((slot) => {
        const held = slot.state === "held";
        const selectedSlot = form.date === day.date && form.time === slot.time;
        return (
          <button
            type="button"
            key={`${day.date}-${slot.time}`}
            disabled={held}
            className={`time-slot${held ? " held" : ""}${selectedSlot ? " selected" : ""}`}
            onClick={() => chooseSlot(day.date, slot.time)}
          >
            <span>{slot.time}</span>
            {held && <small>保留中</small>}
          </button>
        );
      })}
      {!day.slots.length && <p className="no-slots">目前無可顯示時段</p>}
    </div>
  );

  return (
    <div className="booking-shell">
      <div className="booking-progress" aria-label="預約進度">
        {["服務", "日期時段", "資料", "確認"].map((label, index) => (
          <div key={label} className={step >= index + 1 ? "progress-item active" : "progress-item"}>
            <span>{index + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        {step === 1 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 01</span>
            <h2>今天想預約什麼？</h2>
            <p className="muted">不確定也沒關係，可以直接選「想先請 77 建議」。目前所有項目先以 90 分鐘服務時間設定。</p>
            <div className="choice-grid">
              {bookingServices.map((service) => (
                <button
                  type="button"
                  key={service}
                  className={form.service === service ? "choice-card selected" : "choice-card"}
                  onClick={() => chooseService(service)}
                >
                  {service}
                  <small>目前預估 90 分鐘</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="booking-step booking-time-step">
            <span className="eyebrow">STEP 02</span>
            <h2>先選想來的日期，再看前後空檔</h2>
            <p className="muted">最早只能預約明天。日曆選定後，下方 7 天範圍會固定；若要更換基準日期，請回到月曆重新選擇。</p>

            <div className="booking-calendar">
              <div className="calendar-toolbar">
                <button type="button" className="calendar-arrow" aria-label="上個月" onClick={() => setCalendarMonth((value) => moveMonth(value, -1))}>←</button>
                <strong>{monthLabel(calendarMonth)}</strong>
                <button type="button" className="calendar-arrow" aria-label="下個月" onClick={() => setCalendarMonth((value) => moveMonth(value, 1))}>→</button>
              </div>
              <div className="calendar-weekdays">
                {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="calendar-grid">
                {cells.map((date, index) => {
                  if (!date) return <span key={`empty-${index}`} className="calendar-empty" />;
                  const day = parseCalendarDate(date).getUTCDate();
                  const unavailable = date < earliestDate;
                  const selected = date === anchorDate;
                  return (
                    <button
                      type="button"
                      key={date}
                      disabled={unavailable}
                      className={`calendar-day${selected ? " selected" : ""}${date === today ? " today" : ""}`}
                      onClick={() => chooseAnchorDate(date)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="calendar-min-note">目前 7 天基準日為 {shortDateLabel(anchorDate).date}；今天不開放當日預約，最早可選 {shortDateLabel(earliestDate).date}。</p>
            </div>

            <div className="availability-legend" aria-label="時段狀態說明">
              <span><i className="legend-dot available" />可選</span>
              <span><i className="legend-dot held" />已有預約需求，暫時保留</span>
              <span><i className="legend-dot selected" />你目前選擇</span>
            </div>

            {availabilityLoading && <div className="availability-loading">正在讀取固定 7 天空檔…</div>}

            {!availabilityLoading && availability && (
              <>
                {availability.demoMode && <div className="demo-banner booking-demo-banner">DEMO DATA｜13:00–14:30 先用灰色保留示範</div>}

                <div className="desktop-seven-day">
                  <div className="seven-day-scroll">
                    <div className="seven-day-grid">
                      {availability.days.map((day) => {
                        const label = shortDateLabel(day.date);
                        const selectedDay = day.date === form.date;
                        return (
                          <article key={day.date} className={`availability-day${selectedDay ? " selected-day" : ""}`}>
                            <button type="button" className="availability-day-head" onClick={() => chooseWindowDate(day.date)}>
                              <small>{label.weekday}</small>
                              <strong>{label.date}</strong>
                              {selectedDay && <span>想去這天</span>}
                            </button>
                            {renderSlots(day)}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mobile-booking-flow">
                  <div className="mobile-date-strip" aria-label="固定前後七天日期">
                    {availability.days.map((day) => {
                      const label = shortDateLabel(day.date);
                      const selectedDay = day.date === form.date;
                      return (
                        <button
                          type="button"
                          key={day.date}
                          className={`mobile-date-chip${selectedDay ? " selected" : ""}`}
                          onClick={() => chooseWindowDate(day.date)}
                        >
                          <small>{label.weekday}</small>
                          <strong>{label.day}</strong>
                          <span>{parseCalendarDate(day.date).getUTCMonth() + 1}月</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedAvailabilityDay && (
                    <div className="mobile-slot-panel">
                      <div className="mobile-slot-heading">
                        <div>
                          <small>已選日期</small>
                          <strong>{shortDateLabel(selectedAvailabilityDay.date).date} {shortDateLabel(selectedAvailabilityDay.date).weekday}</strong>
                        </div>
                        <span>請選時段</span>
                      </div>
                      {renderSlots(selectedAvailabilityDay, true)}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="notice-box booking-rule-note">
              <strong>目前時段規則</strong>
              <p>77 目前為單一操作者，所以所有服務共用同一條時間軸。任何項目只要已有預約或待確認，其他項目只要會與該時段重疊也會同步顯示保留中或不可選。每 30 分鐘顯示一格；目前服務暫定 90 分鐘，另保留 30 分鐘整理緩衝。</p>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 03</span>
            <h2>留下聯絡資料</h2>
            <p className="muted">不用登入，也不用先建立會員帳號。</p>
            <div className="field-grid two">
              <label>姓名 *<input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="怎麼稱呼妳／你" /></label>
              <label>手機 *<input inputMode="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="09xx-xxx-xxx" /></label>
              <label>LINE ID<input value={form.lineId} onChange={(event) => update("lineId", event.target.value)} placeholder="可稍後補" /></label>
              <label>第一次來店？<select value={form.firstVisit} onChange={(event) => update("firstVisit", event.target.value)}><option value="yes">是，第一次</option><option value="no">不是，我來過</option></select></label>
            </div>
            <label>想先告訴 77 的事<textarea value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="例如：第一次很緊張、近期有刮毛、想先詢問適合的項目…" /></label>
          </section>
        )}

        {step === 4 && (
          <section className="booking-step">
            <span className="eyebrow">STEP 04</span>
            <h2>確認預約需求</h2>
            <dl className="summary-list">
              <div><dt>服務</dt><dd>{form.service}</dd></div>
              <div><dt>日期</dt><dd>{form.date}</dd></div>
              <div><dt>開始時間</dt><dd>{form.time}</dd></div>
              <div><dt>預留</dt><dd>{availability ? `${availability.durationMinutes} 分鐘服務＋${availability.turnoverBufferMinutes} 分鐘整理緩衝` : "依目前服務設定"}</dd></div>
              <div><dt>姓名</dt><dd>{form.name || "尚未填寫"}</dd></div>
              <div><dt>首次來店</dt><dd>{form.firstVisit === "yes" ? "是" : "否"}</dd></div>
            </dl>
            <label className="check-row">
              <input type="checkbox" checked={form.privacy} onChange={(event) => update("privacy", event.target.checked)} />
              <span>我同意 77美學工作室為處理本次預約而使用我填寫的聯絡資料。</span>
            </label>
            <div className="notice-box">
              <strong>預約不是送出即成立</strong>
              <p>送出後會先暫時保留時段並同步占用所有服務的共用時間。77 確認後，重疊時段會從其他顧客的可預約清單移除；首次預約確認後再通知訂金支付。</p>
            </div>
          </section>
        )}

        {message && <p className="form-message">{message}</p>}
        <div className="booking-actions">
          {step > 1 && (
            <button type="button" className="button text" onClick={() => { setMessage(""); setStep((current) => current - 1); }}>
              上一步
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="button primary" onClick={next}>下一步</button>
          ) : (
            <button type="submit" className="button primary" disabled={loading}>{loading ? "送出中…" : "送出預約需求"}</button>
          )}
        </div>
      </form>
    </div>
  );
}
