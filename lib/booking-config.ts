export const BOOKING_TIMEZONE = "Asia/Taipei";
export const SLOT_INTERVAL_MINUTES = 30;
export const DEFAULT_SERVICE_DURATION_MINUTES = 90;
export const TURNOVER_BUFFER_MINUTES = 30;
export const TOTAL_BLOCK_MINUTES = DEFAULT_SERVICE_DURATION_MINUTES + TURNOVER_BUFFER_MINUTES;
export const FIRST_START_TIME = "10:00";
export const LAST_START_TIME = "20:00";

export const ACTIVE_BLOCKING_STATUSES = ["pending_confirmation", "pending_payment", "confirmed"] as const;
export const CONFIRMED_HIDDEN_STATUSES = ["pending_payment", "confirmed"] as const;

export function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesToTime(total: number) {
  const normalized = ((total % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function allStartTimes(firstTime = FIRST_START_TIME, lastTime = LAST_START_TIME) {
  const first = timeToMinutes(firstTime);
  const last = timeToMinutes(lastTime);
  if (first === null || last === null || first > last) return [];
  const result: string[] = [];
  for (let minute = first; minute <= last; minute += SLOT_INTERVAL_MINUTES) result.push(minutesToTime(minute));
  return result;
}

export function blockedTimesFromStart(startTime: string, blockMinutes = TOTAL_BLOCK_MINUTES) {
  const start = timeToMinutes(startTime);
  if (start === null) return [];
  const slotCount = Math.max(1, Math.ceil(blockMinutes / SLOT_INTERVAL_MINUTES));
  return Array.from({ length: slotCount }, (_, index) => minutesToTime(start + index * SLOT_INTERVAL_MINUTES));
}

export function toTaipeiIso(date: string, time: string) {
  return `${date}T${time}:00+08:00`;
}

export function addMinutesToTaipeiIso(date: string, time: string, minutes: number) {
  const start = new Date(toTaipeiIso(date, time));
  return new Date(start.getTime() + minutes * 60_000).toISOString();
}
