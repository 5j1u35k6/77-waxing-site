import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue, getAdminFirestore } from "@/lib/firebase-admin";

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function isHalfHourTime(value: string) {
  return /^([01]\d|2[0-3]):(00|30)$/.test(value);
}

export async function POST(request: Request) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  const db = getAdminFirestore();
  if (!db) return NextResponse.redirect(new URL("/admin/settings?error=尚未連接Firebase", request.url), 303);

  const form = await request.formData();
  const firstStartTime = String(form.get("firstStartTime") || "10:00");
  const lastStartTime = String(form.get("lastStartTime") || "20:00");
  if (!isHalfHourTime(firstStartTime) || !isHalfHourTime(lastStartTime) || firstStartTime > lastStartTime) {
    return NextResponse.redirect(new URL("/admin/settings?error=營業開始與結束時間格式不正確", request.url), 303);
  }

  await db.collection("settings").doc("general").set({
    businessName: String(form.get("businessName") || "77美學工作室").trim() || "77美學工作室",
    lineOfficialUrl: String(form.get("lineOfficialUrl") || "").trim() || null,
    firstStartTime,
    lastStartTime,
    slotIntervalMinutes: 30,
    minBookingDaysAhead: 1,
    defaultDurationMinutes: numberOrNull(form.get("defaultDurationMinutes")) ?? 90,
    defaultBufferMinutes: numberOrNull(form.get("defaultBufferMinutes")) ?? 30,
    firstVisitDepositAmount: numberOrNull(form.get("firstVisitDepositAmount")),
    bookingNotice: String(form.get("bookingNotice") || "").trim() || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.redirect(new URL("/admin/settings?saved=1", request.url), 303);
}
