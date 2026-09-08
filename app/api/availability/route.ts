import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { allStartTimes, blockedTimesFromStart } from "@/lib/booking-config";

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
  const requestedAnchor = url.searchParams.get("anchor") || addDays(taipeiToday(), 1);
  if (!parseCalendarDate(requestedAnchor)) {
    return NextResponse.json({ error: "日期格式不正確。" }, { status: 400 });
  }

  const earliestDate = addDays(taipeiToday(), 1);
  const anchor = requestedAnchor < earliestDate ? earliestDate : requestedAnchor;
  const naturalStart = addDays(anchor, -3);
  const startDate = naturalStart < earliestDate ? earliestDate : naturalStart;
  const endDate = addDays(startDate, 6);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
  const allSlots = allStartTimes();
  const stateByDate = new Map<string, Map<string, "held" | "hidden">>();

  const db = getAdminFirestore();
  let demoMode = false;

  if (db) {
    const snapshot = await db.collection("availabilityLocks")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    for (const doc of snapshot.docs) {
      const lock = doc.data();
      const date = String(lock.date || "");
      const time = String(lock.time || "").slice(0, 5);
      if (!date || !/^\d{2}:\d{2}$/.test(time)) continue;
      const dayMap = stateByDate.get(date) || new Map<string, "held" | "hidden">();
      dayMap.set(time, lock.state === "confirmed" ? "hidden" : "held");
      stateByDate.set(date, dayMap);
    }
  } else {
    demoMode = true;
    const dayMap = new Map<string, "held" | "hidden">();
    for (const time of blockedTimesFromStart("13:00")) dayMap.set(time, "held");
    stateByDate.set(anchor, dayMap);
  }

  const days = dates.map((date) => {
    const dayMap = stateByDate.get(date) || new Map<string, "held" | "hidden">();
    const slots = allSlots
      .filter((time) => dayMap.get(time) !== "hidden")
      .map((time) => ({
        time,
        state: (dayMap.get(time) === "held" ? "held" : "available") as AvailabilityState,
      }));
    return { date, isPast: false, slots };
  });

  return NextResponse.json({
    anchor,
    earliestDate,
    startDate,
    endDate,
    demoMode,
    durationMinutes: 90,
    turnoverBufferMinutes: 30,
    blockMinutes: 120,
    days,
  });
}
