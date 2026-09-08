import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FieldValue,
  customerIdFromLegacyRef,
  customerIdFromPaperRef,
  customerIdFromPhone,
  getAdminFirestore,
  phoneIndexId,
  stableDocId,
} from "@/lib/firebase-admin";

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "").trim();
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
  const name = String(form.get("name") || "").trim();
  const phone = normalizePhone(String(form.get("phone") || ""));
  const lineId = String(form.get("lineId") || "").trim();
  const paperRecordRef = String(form.get("paperRecordRef") || "").trim();
  const legacyRef = String(form.get("legacyRef") || "").trim();
  const notes = String(form.get("notes") || "").trim();

  if (!name) return NextResponse.redirect(new URL("/admin/customers?error=姓名為必填", request.url), 303);

  if (phone) {
    const indexSnapshot = await db.collection("customerPhoneIndex").doc(phoneIndexId(phone)).get();
    if (indexSnapshot.exists) {
      const customerId = String(indexSnapshot.data()?.customerId || "");
      if (customerId) return NextResponse.redirect(new URL(`/admin/customers/${customerId}?error=此手機已存在顧客資料`, request.url), 303);
    }
  }

  let docId = "";
  if (phone) docId = customerIdFromPhone(phone);
  else if (legacyRef) docId = customerIdFromLegacyRef(legacyRef);
  else if (paperRecordRef) docId = customerIdFromPaperRef(paperRecordRef);
  else docId = stableDocId("customer-manual", `${name}:${Date.now()}`);

  const ref = db.collection("customers").doc(docId);
  const existing = await ref.get();
  if (existing.exists) return NextResponse.redirect(new URL(`/admin/customers/${ref.id}?error=顧客可能已存在`, request.url), 303);

  const batch = db.batch();
  batch.set(ref, {
    name,
    phone: phone || null,
    phoneNormalized: phone || null,
    lineId: lineId || null,
    email: null,
    visitCount: 0,
    defaultDepositRequired: null,
    legacyRef: legacyRef || null,
    paperRecordRef: paperRecordRef || null,
    firstVisitDate: null,
    lastVisitDate: null,
    notes: notes || null,
    source: "admin",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (phone) {
    batch.set(db.collection("customerPhoneIndex").doc(phoneIndexId(phone)), {
      customerId: ref.id,
      phone,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return NextResponse.redirect(new URL(`/admin/customers/${ref.id}?created=1`, request.url), 303);
}
