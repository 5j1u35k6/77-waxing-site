import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

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
  if (!bookingId || !allowedActions.has(action)) {
    return back(request, { error: "invalid_action" });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return back(request, { demoAction: action });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, customer_id, status, is_first_visit, payment_status")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return back(request, { error: "booking_not_found" });
  }

  const now = new Date().toISOString();
  let update: Record<string, unknown> = { updated_at: now };

  if (action === "confirm_deposit") {
    if (booking.status !== "pending_confirmation") return back(request, { error: "invalid_status" });
    update = {
      ...update,
      deposit_required: true,
      payment_status: "pending",
      status: "pending_payment",
    };
  }

  if (action === "confirm_no_deposit") {
    if (booking.status !== "pending_confirmation") return back(request, { error: "invalid_status" });
    if (booking.is_first_visit) return back(request, { error: "first_visit_requires_deposit" });
    update = {
      ...update,
      deposit_required: false,
      payment_status: "not_requested",
      status: "confirmed",
      confirmed_at: now,
    };
  }

  if (action === "mark_paid") {
    if (booking.status !== "pending_payment") return back(request, { error: "invalid_status" });
    update = {
      ...update,
      deposit_required: true,
      payment_status: "paid",
      status: "confirmed",
      confirmed_at: now,
    };
  }

  if (action === "complete") {
    if (booking.status !== "confirmed") return back(request, { error: "invalid_status" });
    update = { ...update, status: "completed" };
  }

  if (action === "cancel") {
    if (["completed", "cancelled"].includes(booking.status)) return back(request, { error: "invalid_status" });
    update = { ...update, status: "cancelled" };
  }

  if (action === "no_show") {
    if (booking.status !== "confirmed") return back(request, { error: "invalid_status" });
    update = { ...update, status: "no_show" };
  }

  const { error: updateError } = await supabase.from("bookings").update(update).eq("id", bookingId);
  if (updateError) return back(request, { error: "update_failed" });

  if (action === "complete") {
    const { data: customer } = await supabase
      .from("customers")
      .select("visit_count")
      .eq("id", booking.customer_id)
      .single();
    if (customer) {
      await supabase
        .from("customers")
        .update({ visit_count: Number(customer.visit_count || 0) + 1, updated_at: now })
        .eq("id", booking.customer_id);
    }
  }

  return back(request, { updated: action });
}
