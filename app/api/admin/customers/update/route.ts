import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue, getAdminFirestore, phoneIndexId } from "@/lib/firebase-admin";

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "").trim();
}

function normalizedBoolean(value: string) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export async function POST(request: Request) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const db = getAdminFirestore();
  if (!db) return NextResponse.redirect(new URL("/admin/customers?error=尚未連接Firebase", request.url), 303);

  const form = await request.formData();
  const customerId = String(form.get("customerId") || "").trim();
  const name = String(form.get("name") || "").trim();
  const phone = normalizePhone(String(form.get("phone") || ""));
  const oldPhone = normalizePhone(String(form.get("oldPhone") || ""));
  const visitCountText = String(form.get("visitCount") || "0");
  const visitCount = /^\d+$/.test(visitCountText) ? Number(visitCountText) : 0;

  if (!customerId || !name) return NextResponse.redirect(new URL(`/admin/customers/${customerId}?error=姓名為必填`, request.url), 303);
  const customerRef = db.collection("customers").doc(customerId);
  if (!(await customerRef.get()).exists) return NextResponse.redirect(new URL("/admin/customers?error=找不到顧客", request.url), 303);

  if (phone && phone !== oldPhone) {
    const indexRef = db.collection("customerPhoneIndex").doc(phoneIndexId(phone));
    const indexSnapshot = await indexRef.get();
    const existingCustomerId = indexSnapshot.exists ? String(indexSnapshot.data()?.customerId || "") : "";
    if (existingCustomerId && existingCustomerId !== customerId) {
      return NextResponse.redirect(new URL(`/admin/customers/${customerId}?error=新手機號碼已被另一位顧客使用`, request.url), 303);
    }
  }

  const batch = db.batch();
  batch.set(customerRef, {
    name,
    phone: phone || null,
    phoneNormalized: phone || null,
    lineId: String(form.get("lineId") || "").trim() || null,
    email: String(form.get("email") || "").trim() || null,
    legacyRef: String(form.get("legacyRef") || "").trim() || null,
    paperRecordRef: String(form.get("paperRecordRef") || "").trim() || null,
    firstVisitDate: String(form.get("firstVisitDate") || "").trim() || null,
    lastVisitDate: String(form.get("lastVisitDate") || "").trim() || null,
    visitCount,
    defaultDepositRequired: normalizedBoolean(String(form.get("defaultDepositRequired") || "auto")),
    notes: String(form.get("notes") || "").trim() || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (oldPhone && oldPhone !== phone) batch.delete(db.collection("customerPhoneIndex").doc(phoneIndexId(oldPhone)));
  if (phone) {
    batch.set(db.collection("customerPhoneIndex").doc(phoneIndexId(phone)), {
      customerId,
      phone,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  return NextResponse.redirect(new URL(`/admin/customers/${customerId}?saved=1`, request.url), 303);
}
