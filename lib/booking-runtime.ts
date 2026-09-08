import {
  DEFAULT_SERVICE_DURATION_MINUTES,
  FIRST_START_TIME,
  LAST_START_TIME,
  TURNOVER_BUFFER_MINUTES,
} from "@/lib/booking-config";
import { getAdminFirestore, stableDocId } from "@/lib/firebase-admin";

export type BookingRuntimeConfig = {
  firstStartTime: string;
  lastStartTime: string;
  durationMinutes: number;
  bufferMinutes: number;
  firstVisitDepositAmount: number | null;
};

export async function getBookingRuntimeConfig(serviceName?: string): Promise<BookingRuntimeConfig> {
  const db = getAdminFirestore();
  if (!db) return {
    firstStartTime: FIRST_START_TIME,
    lastStartTime: LAST_START_TIME,
    durationMinutes: DEFAULT_SERVICE_DURATION_MINUTES,
    bufferMinutes: TURNOVER_BUFFER_MINUTES,
    firstVisitDepositAmount: null,
  };

  const [settingsSnapshot, serviceSnapshot] = await Promise.all([
    db.collection("settings").doc("general").get(),
    serviceName ? db.collection("services").doc(stableDocId("service", serviceName)).get() : Promise.resolve(null),
  ]);

  const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
  const service = serviceSnapshot?.exists ? serviceSnapshot.data() || {} : {};
  return {
    firstStartTime: String(settings.firstStartTime || FIRST_START_TIME),
    lastStartTime: String(settings.lastStartTime || LAST_START_TIME),
    durationMinutes: Number(service.durationMinutes || settings.defaultDurationMinutes || DEFAULT_SERVICE_DURATION_MINUTES),
    bufferMinutes: Number(service.bufferMinutes ?? settings.defaultBufferMinutes ?? TURNOVER_BUFFER_MINUTES),
    firstVisitDepositAmount: settings.firstVisitDepositAmount == null ? null : Number(settings.firstVisitDepositAmount),
  };
}
