import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import {
  ACTIVE_BLOCKING_STATUSES,
  TOTAL_BLOCK_MINUTES,
  addMinutesToTaipeiIso,
  allStartTimes,
  timeToMinutes,
  toTaipeiIso,
} from "@/lib/booking-config";

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
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

function nextCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const required = ["service", "date", "time", "name", "phone"];
  if (required.some((key) => !body[key]) || body.privacy !== true) {
    return NextResponse.json({ error: "預約資料不完整。" }, { status: 400 });
  }

  const date = String(body.date);
  const time = String(body.time).slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !allStartTimes().includes(time)) {
    return NextResponse.json({ error: "請重新選擇可預約的日期與時間。" }, { status: 400 });
  }

  const earliestDate = nextCalendarDate(taipeiToday());
  if (date < earliestDate) {
    return NextResponse.json({ error: "最早只能預約明天，請重新選擇日期。" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      demoMode: true,
      bookingId: `DEMO-${Date.now()}`,
      status: "pending_confirmation",
    });
  }

  const slotStart = new Date(toTaipeiIso(date, time)).toISOString();
  const slotEnd = addMinutesToTaipeiIso(date, time, TOTAL_BLOCK_MINUTES);

  const rangeCheck = await supabase
    .from("bookings")
    .select("id")
    .in("status", [...ACTIVE_BLOCKING_STATUSES])
    .lt("slot_start", slotEnd)
    .gt("slot_end", slotStart)
    .limit(1);

  let conflict = Boolean(rangeCheck.data?.length);

  if (rangeCheck.error) {
    const fallback = await supabase
      .from("bookings")
      .select("preferred_time, status")
      .eq("preferred_date", date)
      .in("status", [...ACTIVE_BLOCKING_STATUSES]);

    const requestedStart = timeToMinutes(time)!;
    const requestedEnd = requestedStart + TOTAL_BLOCK_MINUTES;
    conflict = (fallback.data || []).some((booking) => {
      const existingStart = timeToMinutes(String(booking.preferred_time || "").slice(0, 5));
      return existingStart !== null && rangesOverlap(
        requestedStart,
        requestedEnd,
        existingStart,
        existingStart + TOTAL_BLOCK_MINUTES,
      );
    });
  }

  if (conflict) {
    return NextResponse.json({ error: "這個時段剛被其他預約保留，請改選其他時間。" }, { status: 409 });
  }

  const normalizedPhone = String(body.phone).replace(/\s|-/g, "");
  let customerId: string | null = null;
  let visitCount = 0;

  const existing = await supabase
    .from("customers")
    .select("id, visit_count")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existing.data) {
    customerId = existing.data.id;
    visitCount = existing.data.visit_count || 0;
    await supabase
      .from("customers")
      .update({ name: body.name, line_id: body.lineId || null, updated_at: new Date().toISOString() })
      .eq("id", customerId);
  } else {
    const created = await supabase
      .from("customers")
      .insert({ name: body.name, phone: normalizedPhone, line_id: body.lineId || null, visit_count: 0 })
      .select("id")
      .single();
    if (created.error) return NextResponse.json({ error: "顧客資料建立失敗。" }, { status: 500 });
    customerId = created.data.id;
  }

  const serviceRecord = await supabase.from("services").select("id").eq("name", body.service).maybeSingle();

  const bookingPayload = {
    customer_id: customerId,
    service_id: serviceRecord.data?.id || null,
    service_name_snapshot: body.service,
    preferred_date: date,
    preferred_time: time,
    status: "pending_confirmation",
    is_first_visit: visitCount === 0,
    deposit_required: null,
    payment_status: "not_requested",
    duration_minutes: 90,
    buffer_minutes: 30,
    slot_start: slotStart,
    slot_end: slotEnd,
    note: body.note || null,
  };

  let booking = await supabase.from("bookings").insert(bookingPayload).select("id").single();

  if (booking.error && /slot_start|slot_end|duration_minutes|buffer_minutes/i.test(booking.error.message || "")) {
    const { slot_start: _start, slot_end: _end, duration_minutes: _duration, buffer_minutes: _buffer, ...legacyPayload } = bookingPayload;
    booking = await supabase.from("bookings").insert(legacyPayload).select("id").single();
  }

  if (booking.error) {
    if (booking.error.code === "23P01") {
      return NextResponse.json({ error: "這個時段剛被其他預約保留，請改選其他時間。" }, { status: 409 });
    }
    return NextResponse.json({ error: "預約建立失敗。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookingId: booking.data.id, status: "pending_confirmation" });
}