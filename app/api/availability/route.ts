import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import {
  ACTIVE_BLOCKING_STATUSES,
  CONFIRMED_HIDDEN_STATUSES,
  allStartTimes,
  blockedTimesFromStart,
} from "@/lib/booking-config";

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCalendarDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = parseCalendarDate(value);
  if (!date) return value;
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

type AvailabilityState = "available" | "held";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const anchor = url.searchParams.get("anchor") || taipeiToday();
  if (!parseCalendarDate(anchor)) {
    return NextResponse.json({ error: "日期格式不正確。" }, { status: 400 });
  }

  const startDate = addDays(anchor, -3);
  const endDate = addDays(anchor, 3);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(anchor, index - 3));
  const allSlots = allStartTimes();
  const stateByDate = new Map<string, Map<string, "held" | "hidden">>();

  const supabase = getAdminSupabase();
  let demoMode = false;

  if (supabase) {
    const { data } = await supabase
      .from("bookings")
      .select("preferred_date, preferred_time, status")
      .gte("preferred_date", startDate)
      .lte("preferred_date", endDate)
      .in("status", [...ACTIVE_BLOCKING_STATUSES]);

    for (const booking of data || []) {
      const date = String(booking.preferred_date || "");
      const start = String(booking.preferred_time || "").slice(0, 5);
      if (!date || !/^\d{2}:\d{2}$/.test(start)) continue;
      const dayMap = stateByDate.get(date) || new Map<string, "held" | "hidden">();
      const nextState = (CONFIRMED_HIDDEN_STATUSES as readonly string[]).includes(String(booking.status)) ? "hidden" : "held";
      for (const time of blockedTimesFromStart(start)) dayMap.set(time, nextState);
      stateByDate.set(date, dayMap);
    }
  } else {
    demoMode = true;
    const dayMap = new Map<string, "held" | "hidden">();
    for (const time of blockedTimesFromStart("13:00")) dayMap.set(time, "held");
    stateByDate.set(anchor, dayMap);
  }

  const today = taipeiToday();
  const days = dates.map((date) => {
    const dayMap = stateByDate.get(date) || new Map<string, "held" | "hidden">();
    const slots = allSlots
      .filter((time) => dayMap.get(time) !== "hidden")
      .map((time) => ({
        time,
        state: (dayMap.get(time) === "held" ? "held" : "available") as AvailabilityState,
      }));
    return { date, isPast: date < today, slots };
  });

  return NextResponse.json({
    anchor,
    startDate,
    endDate,
    demoMode,
    durationMinutes: 90,
    turnoverBufferMinutes: 30,
    blockMinutes: 120,
    days,
  });
}
