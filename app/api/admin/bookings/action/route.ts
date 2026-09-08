import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue, getAdminFirestore } from "@/lib/firebase-admin";

const allowedActions = new Set([
  "confirm_deposit",
  "confirm_no_deposit",
  "mark_paid",
  "complete",
  "cancel",
  "no_show",
]);

function back(request: Request, params?: Record<string, string>) {
  const url = new URL("/admin", request.url);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!sessionToken || cookieStore.get("admin_session")?.value !== sessionToken) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const form = await request.formData();
  const bookingId = String(form.get("bookingId") || "");
  const action = String(form.get("action") || "");
  if (!bookingId || !allowedActions.has(action)) return back(request, { error: "invalid_action" });

  const db = getAdminFirestore();
  if (!db) return back(request, { demoAction: action });

  const bookingRef = db.collection("bookings").doc(bookingId);

  try {
    await db.runTransaction(async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      if (!bookingSnapshot.exists) throw new Error("BOOKING_NOT_FOUND");
      const booking = bookingSnapshot.data() || {};
      const status = String(booking.status || "");
      const isFirstVisit = Boolean(booking.isFirstVisit);
      const lockIds = Array.isArray(booking.lockIds) ? booking.lockIds.map(String) : [];
      const customerId = String(booking.customerId || "");

      let customerSnapshot: FirebaseFirestore.DocumentSnapshot | null = null;
      let customerRef: FirebaseFirestore.DocumentReference | null = null;
      if (action === "complete" && customerId) {
        customerRef = db.collection("customers").doc(customerId);
        customerSnapshot = await transaction.get(customerRef);
      }

      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      let lockState: "held" | "confirmed" | "release" | null = null;

      if (action === "confirm_deposit") {
        if (status !== "pending_confirmation") throw new Error("INVALID_STATUS");
        Object.assign(update, {
          depositRequired: true,
          paymentStatus: "pending",
          status: "pending_payment",
          confirmedAt: FieldValue.serverTimestamp(),
        });
        lockState = "confirmed";
      }

      if (action === "confirm_no_deposit") {
        if (status !== "pending_confirmation") throw new Error("INVALID_STATUS");
        if (isFirstVisit) throw new Error("FIRST_VISIT_REQUIRES_DEPOSIT");
        Object.assign(update, {
          depositRequired: false,
          paymentStatus: "not_requested",
          status: "confirmed",
          confirmedAt: FieldValue.serverTimestamp(),
        });
        lockState = "confirmed";
      }

      if (action === "mark_paid") {
        if (status !== "pending_payment") throw new Error("INVALID_STATUS");
        Object.assign(update, {
          depositRequired: true,
          paymentStatus: "paid",
          status: "confirmed",
          confirmedAt: booking.confirmedAt || FieldValue.serverTimestamp(),
        });
        lockState = "confirmed";
      }

      if (action === "complete") {
        if (status !== "confirmed") throw new Error("INVALID_STATUS");
        Object.assign(update, { status: "completed", completedAt: FieldValue.serverTimestamp() });
        lockState = "release";
      }

      if (action === "cancel") {
        if (["completed", "cancelled"].includes(status)) throw new Error("INVALID_STATUS");
        Object.assign(update, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
        lockState = "release";
      }

      if (action === "no_show") {
        if (status !== "confirmed") throw new Error("INVALID_STATUS");
        Object.assign(update, { status: "no_show", noShowAt: FieldValue.serverTimestamp() });
        lockState = "release";
      }

      transaction.update(bookingRef, update);

      for (const lockId of lockIds) {
        const lockRef = db.collection("availabilityLocks").doc(lockId);
        if (lockState === "release") transaction.delete(lockRef);
        if (lockState === "confirmed") {
          transaction.set(lockRef, {
            state: "confirmed",
            bookingId,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }

      if (action === "complete" && customerRef) {
        const customer = customerSnapshot?.exists ? customerSnapshot.data() || {} : {};
        const preferredDate = String(booking.preferredDate || "");
        transaction.set(customerRef, {
          visitCount: FieldValue.increment(1),
          firstVisitDate: customer.firstVisitDate || preferredDate || null,
          lastVisitDate: preferredDate || customer.lastVisitDate || null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UPDATE_FAILED";
    const mapped: Record<string, string> = {
      BOOKING_NOT_FOUND: "booking_not_found",
      INVALID_STATUS: "invalid_status",
      FIRST_VISIT_REQUIRES_DEPOSIT: "first_visit_requires_deposit",
    };
    console.error("admin-booking-action", error);
    return back(request, { error: mapped[code] || "update_failed" });
  }

  return back(request, { updated: action });
}
