import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue, getAdminFirestore, stableDocId } from "@/lib/firebase-admin";

function back(request: Request, params?: Record<string, string>) {
  const url = new URL("/admin/services", request.url);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

const seedServices = [
  ["女性 VIO 私密處熱蠟", "女性熱蠟"],
  ["女性局部熱蠟", "女性熱蠟"],
  ["男士熱蠟", "男士熱蠟"],
  ["肌膚管理", "肌膚管理"],
  ["美胸保養", "美胸保養"],
  ["不確定，想先請 77 建議", "諮詢"],
] as const;

export async function POST(request: Request) {
  const token = process.env.ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();
  if (!token || cookieStore.get("admin_session")?.value !== token) return NextResponse.redirect(new URL("/admin/login", request.url), 303);

  const db = getAdminFirestore();
  if (!db) return back(request, { error: "尚未連接Firebase" });
  const form = await request.formData();
  const action = String(form.get("action") || "");

  if (action === "seed") {
    const batch = db.batch();
    seedServices.forEach(([name, category]) => {
      const ref = db.collection("services").doc(stableDocId("service", name));
      batch.set(ref, {
        name, category, price: null, durationMinutes: 90, bufferMinutes: 30, active: true,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
    return back(request, { seeded: "1" });
  }

  const name = String(form.get("name") || "").trim();
  const category = String(form.get("category") || "").trim();
  const price = numberOrNull(form.get("price"));
  const durationMinutes = numberOrNull(form.get("durationMinutes")) ?? 90;
  const bufferMinutes = numberOrNull(form.get("bufferMinutes")) ?? 30;
  const active = String(form.get("active") || "yes") !== "no";
  if (!name || !category) return back(request, { error: "服務名稱與分類為必填" });

  if (action === "create") {
    const ref = db.collection("services").doc(stableDocId("service", name));
    const existing = await ref.get();
    if (existing.exists) return back(request, { error: "同名服務已存在" });
    await ref.set({ name, category, price, durationMinutes, bufferMinutes, active, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return back(request, { saved: "1" });
  }

  if (action === "update") {
    const serviceId = String(form.get("serviceId") || "");
    if (!serviceId) return back(request, { error: "缺少服務ID" });
    await db.collection("services").doc(serviceId).set({ name, category, price, durationMinutes, bufferMinutes, active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return back(request, { saved: "1" });
  }

  return back(request, { error: "不支援的操作" });
}
