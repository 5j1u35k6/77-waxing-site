import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  FieldValue,
  customerIdFromLegacyRef,
  customerIdFromPaperRef,
  customerIdFromPhone,
  getAdminFirestore,
  phoneIndexId,
} from "@/lib/firebase-admin";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalizePhone(value: string) {
  const normalized = value.replace(/[\s()-]/g, "").trim();
  return normalized || null;
}

function normalizeDate(value: string) {
  const text = value.trim();
  if (!text) return null;
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const db = getAdminFirestore();
  if (!db) return NextResponse.redirect(new URL("/admin/customers?error=尚未連接Firebase", request.url), 303);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.redirect(new URL("/admin/customers?error=請選擇CSV檔案", request.url), 303);
  if (file.size > 1_000_000) return NextResponse.redirect(new URL("/admin/customers?error=CSV請控制在1MB以內", request.url), 303);

  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  if (rows.length < 2) return NextResponse.redirect(new URL("/admin/customers?error=CSV沒有可匯入資料", request.url), 303);
  if (rows.length > 501) return NextResponse.redirect(new URL("/admin/customers?error=每次最多匯入500筆", request.url), 303);

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const get = (row: string[], key: string) => row[headers.indexOf(key)]?.trim() || "";
  if (!headers.includes("name")) return NextResponse.redirect(new URL("/admin/customers?error=CSV至少需要name欄位", request.url), 303);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const name = get(row, "name");
    const phone = normalizePhone(get(row, "phone"));
    const legacyRef = get(row, "legacy_ref") || null;
    const paperRecordRef = get(row, "paper_record_ref") || null;
    if (!name || (!phone && !legacyRef && !paperRecordRef)) { skipped += 1; continue; }

    try {
      let targetRef = null as FirebaseFirestore.DocumentReference | null;
      let existing = null as FirebaseFirestore.DocumentSnapshot | null;

      if (phone) {
        const indexSnapshot = await db.collection("customerPhoneIndex").doc(phoneIndexId(phone)).get();
        const indexedId = indexSnapshot.exists ? String(indexSnapshot.data()?.customerId || "") : "";
        targetRef = db.collection("customers").doc(indexedId || customerIdFromPhone(phone));
        existing = await targetRef.get();
      }

      if ((!existing || !existing.exists) && legacyRef) {
        const match = await db.collection("customers").where("legacyRef", "==", legacyRef).limit(1).get();
        if (!match.empty) { existing = match.docs[0]; targetRef = match.docs[0].ref; }
      }
      if ((!existing || !existing.exists) && paperRecordRef) {
        const match = await db.collection("customers").where("paperRecordRef", "==", paperRecordRef).limit(1).get();
        if (!match.empty) { existing = match.docs[0]; targetRef = match.docs[0].ref; }
      }
      if (!targetRef) {
        targetRef = legacyRef
          ? db.collection("customers").doc(customerIdFromLegacyRef(legacyRef))
          : db.collection("customers").doc(customerIdFromPaperRef(paperRecordRef!));
        existing = await targetRef.get();
      }

      const previous = existing?.exists ? existing.data() || {} : {};
      const visitCountText = get(row, "visit_count");
      const visitCount = visitCountText && /^\d+$/.test(visitCountText) ? Number(visitCountText) : Number(previous.visitCount || 0);
      const payload: Record<string, unknown> = {
        name,
        phone,
        phoneNormalized: phone,
        lineId: get(row, "line_id") || null,
        email: get(row, "email") || null,
        visitCount,
        legacyRef,
        paperRecordRef,
        firstVisitDate: normalizeDate(get(row, "first_visit_date")),
        lastVisitDate: normalizeDate(get(row, "last_visit_date")),
        notes: get(row, "notes") || null,
        source: previous.source || "paper_import",
        importedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!existing?.exists) payload.createdAt = FieldValue.serverTimestamp();

      const batch = db.batch();
      batch.set(targetRef, payload, { merge: true });
      if (phone) {
        batch.set(db.collection("customerPhoneIndex").doc(phoneIndexId(phone)), {
          customerId: targetRef.id,
          phone,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();

      if (existing?.exists) updated += 1;
      else imported += 1;
    } catch (error) {
      console.error("customer-import-row", error);
      skipped += 1;
    }
  }

  await db.collection("customerImportBatches").add({
    filename: file.name,
    rowCount: rows.length - 1,
    importedCount: imported,
    updatedCount: updated,
    skippedCount: skipped,
    createdAt: FieldValue.serverTimestamp(),
  });

  const url = new URL("/admin/customers", request.url);
  url.searchParams.set("imported", String(imported));
  url.searchParams.set("updated", String(updated));
  url.searchParams.set("skipped", String(skipped));
  return NextResponse.redirect(url, 303);
}
