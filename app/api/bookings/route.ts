import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();
  const required = ["service", "date", "time", "name", "phone"];
  if (required.some((key) => !body[key]) || body.privacy !== true) return NextResponse.json({ error: "預約資料不完整。" }, { status: 400 });

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, demoMode: true, bookingId: `DEMO-${Date.now()}`, status: "pending_confirmation" });
  }

  const normalizedPhone = String(body.phone).replace(/\s|-/g, "");
  let customerId: string | null = null;
  let visitCount = 0;
  const existing = await supabase.from("customers").select("id, visit_count").eq("phone", normalizedPhone).maybeSingle();
  if (existing.data) {
    customerId = existing.data.id;
    visitCount = existing.data.visit_count || 0;
    await supabase.from("customers").update({ name: body.name, line_id: body.lineId || null, updated_at: new Date().toISOString() }).eq("id", customerId);
  } else {
    const created = await supabase.from("customers").insert({ name: body.name, phone: normalizedPhone, line_id: body.lineId || null, visit_count: 0 }).select("id").single();
    if (created.error) return NextResponse.json({ error: "顧客資料建立失敗。" }, { status: 500 });
    customerId = created.data.id;
  }

  const serviceRecord = await supabase.from("services").select("id").eq("name", body.service).maybeSingle();
  const depositRequired = visitCount === 0 ? null : null;
  const booking = await supabase.from("bookings").insert({
    customer_id: customerId,
    service_id: serviceRecord.data?.id || null,
    service_name_snapshot: body.service,
    preferred_date: body.date,
    preferred_time: body.time,
    status: "pending_confirmation",
    is_first_visit: visitCount === 0,
    deposit_required: depositRequired,
    payment_status: "not_requested",
    note: body.note || null,
  }).select("id").single();
  if (booking.error) return NextResponse.json({ error: "預約建立失敗。" }, { status: 500 });
  return NextResponse.json({ ok: true, bookingId: booking.data.id, status: "pending_confirmation" });
}
