import { createHash } from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

let cachedDb: ReturnType<typeof getFirestore> | null | undefined;

function normalizeEnvValue(value: string | undefined) {
  if (!value) return "";
  let normalized = value.trim();
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.trim();
}

export function getAdminFirestore() {
  if (cachedDb !== undefined) return cachedDb;

  const projectId = normalizeEnvValue(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizeEnvValue(process.env.FIREBASE_PRIVATE_KEY)
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "");

  if (!projectId || !clientEmail || !privateKey) {
    cachedDb = null;
    return cachedDb;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  cachedDb = getFirestore();
  cachedDb.settings({ ignoreUndefinedProperties: true });
  return cachedDb;
}

export function stableDocId(namespace: string, value: string) {
  return createHash("sha256").update(`${namespace}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 40);
}

export function customerIdFromPhone(phone: string) {
  return stableDocId("customer-phone", phone);
}

export function phoneIndexId(phone: string) {
  return stableDocId("customer-phone-index", phone);
}

export function customerIdFromLegacyRef(value: string) {
  return stableDocId("customer-legacy", value);
}

export function customerIdFromPaperRef(value: string) {
  return stableDocId("customer-paper", value);
}

export function availabilityLockId(date: string, time: string) {
  return `${date}_${time.replace(":", "")}`;
}

export { FieldValue, Timestamp };
