import { NextResponse } from "next/server";
import {
  FieldValue,
  availabilityLockId,
  customerIdFromPhone,
  getAdminFirestore,
  phoneIndexId,
} from "@/lib/firebase-admin";
import {
  TOTAL_BLOCK_MINUTES,
  addMinutesToTaipeiIso,
  allStartTimes,
  blockedTimesFromStart,
  toTaipeiIso,
} from "@/lib/booking-config";

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

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "").trim();
}

export async function POST(request: Request) {
  const body = await request.json();
  const required = ["service", "date", "time", "name", "phone"];
  if (required.some((key) => !body[key]) || body.privacy !== true) {
    return NextResponse.json({ error: "預約資料不完整。" }, { status: 400 });
  }

  const date = String(body.date);
  const time = String(body.time).slice(0, 5);
  const normalizedPhone = normalizePhone(String(body.phone));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !allStartTimes().includes(time) || !normalizedPhone) {
    return NextResponse.json({ error: "請重新確認日期、時間與手機資料。" }, { status: 400 });
  }

  const earliestDate = nextCalendarDate(taipeiToday());
  if (date < earliestDate) {
    return NextResponse.json({ error: "最早只能預約明天，請重新選擇日期。" }, { status: 400 });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ ok: true, demoMode: true, bookingId: `DEMO-${Date.now()}`, status: "pending_confirmation" });
  }

  const bookingRef = db.collection("bookings").doc();
  const phoneIndexRef = db.collection("customerPhoneIndex").doc(phoneIndexId(normalizedPhone));
  const blockedTimes = blockedTimesFromStart(time);
  const lockRefs = blockedTimes.map((blockedTime) => db.collection("availabilityLocks").doc(availabilityLockId(date, blockedTime)));
  const slotStart = new Date(toTaipeiIso(date, time)).toISOString();
  const slotEnd = addMinutesToTaipeiIso(date, time, TOTAL_BLOCK_MINUTES);

  try {
    await db.runTransaction(async (transaction) => {
      const lockSnapshots = [];
      for (const lockRef of lockRefs) lockSnapshots.push(await transaction.get(lockRef));
      if (lockSnapshots.some((snapshot) => snapshot.exists)) throw new Error("SLOT_CONFLICT");

      const phoneIndexSnapshot = await transaction.get(phoneIndexRef);
      const indexedCustomerId = phoneIndexSnapshot.exists ? String(phoneIndexSnapshot.data()?.customerId || "") : "";
      const customerRef = db.collection("customers").doc(indexedCustomerId || customerIdFromPhone(normalizedPhone));
      const customerSnapshot = await transaction.get(customerRef);
      const existingCustomer = customerSnapshot.exists ? customerSnapshot.data() || {} : {};
      const visitCount = Number(existingCustomer.visitCount || 0);
      const isFirstVisit = !customerSnapshot.exists || visitCount === 0;

      const customerPayload: Record<string, unknown> = {
        name: String(body.name).trim(),
        phone: normalizedPhone,
        phoneNormalized: normalizedPhone,
        lineId: body.lineId ? String(body.lineId).trim() : null,
        visitCount,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!customerSnapshot.exists) {
        customerPayload.source = "online";
        customerPayload.createdAt = FieldValue.serverTimestamp();
        customerPayload.defaultDepositRequired = null;
      }
      transaction.set(customerRef, customerPayload, { merge: true });
      transaction.set(phoneIndexRef, {
        customerId: customerRef.id,
        phone: normalizedPhone,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.set(bookingRef, {
        customerId: customerRef.id,
        customerName: String(body.name).trim(),
        customerPhone: normalizedPhone,
        customerLineId: body.lineId ? String(body.lineId).trim() : null,
        serviceName: String(body.service),
        preferredDate: date,
        preferredTime: time,
        status: "pending_confirmation",
        isFirstVisit,
        depositRequired: null,
        depositAmount: null,
        paymentStatus: "not_requested",
        durationMinutes: 90,
        bufferMinutes: 30,
        slotStart,
        slotEnd,
        lockIds: lockRefs.map((ref) => ref.id),
        note: body.note ? String(body.note).trim() : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      lockRefs.forEach((lockRef, index) => {
        transaction.set(lockRef, {
          bookingId: bookingRef.id,
          date,
          time: blockedTimes[index],
          state: "held",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_CONFLICT") {
      return NextResponse.json({ error: "這個時段剛被其他預約保留，請改選其他時間。" }, { status: 409 });
    }
    console.error("booking-create", error);
    return NextResponse.json({ error: "預約建立失敗，請稍後再試。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookingId: bookingRef.id, status: "pending_confirmation" });
}
