import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
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

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL("/admin/customers?error=尚未連接Supabase", request.url), 303);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL("/admin/customers?error=請選擇CSV檔案", request.url), 303);
  }

  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return NextResponse.redirect(new URL("/admin/customers?error=CSV沒有可匯入資料", request.url), 303);
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const get = (row: string[], key: string) => row[headers.indexOf(key)]?.trim() || "";
  const requiredHeader = ["name"];
  if (requiredHeader.some((key) => !headers.includes(key))) {
    return NextResponse.redirect(new URL("/admin/customers?error=CSV至少需要name欄位", request.url), 303);
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const name = get(row, "name");
    const phone = normalizePhone(get(row, "phone"));
    const legacyRef = get(row, "legacy_ref") || null;
    const paperRecordRef = get(row, "paper_record_ref") || null;
    if (!name || (!phone && !legacyRef && !paperRecordRef)) {
      skipped += 1;
      continue;
    }

    const visitCountText = get(row, "visit_count");
    const visitCount = visitCountText && /^\d+$/.test(visitCountText) ? Number(visitCountText) : null;
    const payload: Record<string, unknown> = {
      name,
      phone,
      line_id: get(row, "line_id") || null,
      email: get(row, "email") || null,
      legacy_ref: legacyRef,
      paper_record_ref: paperRecordRef,
      first_visit_date: normalizeDate(get(row, "first_visit_date")),
      last_visit_date: normalizeDate(get(row, "last_visit_date")),
      notes: get(row, "notes") || null,
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (visitCount !== null) payload.visit_count = visitCount;

    let existing: any = null;
    if (phone) {
      const result = await supabase.from("customers").select("id,source").eq("phone", phone).maybeSingle();
      existing = result.data;
    }
    if (!existing && legacyRef) {
      const result = await supabase.from("customers").select("id,source").eq("legacy_ref", legacyRef).maybeSingle();
      existing = result.data;
    }
    if (!existing && paperRecordRef) {
      const result = await supabase.from("customers").select("id,source").eq("paper_record_ref", paperRecordRef).maybeSingle();
      existing = result.data;
    }

    if (existing) {
      payload.source = existing.source || "paper_import";
      const result = await supabase.from("customers").update(payload).eq("id", existing.id);
      if (result.error) skipped += 1;
      else updated += 1;
    } else {
      payload.source = "paper_import";
      const result = await supabase.from("customers").insert(payload);
      if (result.error) skipped += 1;
      else imported += 1;
    }
  }

  await supabase.from("customer_import_batches").insert({
    filename: file.name,
    row_count: rows.length - 1,
    imported_count: imported,
    updated_count: updated,
    skipped_count: skipped,
  });

  const url = new URL("/admin/customers", request.url);
  url.searchParams.set("imported", String(imported));
  url.searchParams.set("updated", String(updated));
  url.searchParams.set("skipped", String(skipped));
  return NextResponse.redirect(url, 303);
}
