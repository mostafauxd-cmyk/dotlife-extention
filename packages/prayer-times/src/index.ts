import type { PrayerName, PrayerTimes } from "./types";

export type {
  AngleOrMinutes,
  CivilDate,
  HighLatitudeRule,
  Location,
  MethodParams,
  PrayerCalcMethod,
  PrayerName,
  PrayerSettings,
  PrayerTimes,
} from "./types";
export { DEFAULT_SETTINGS, METHOD_NAMES_FA, PRAYER_NAMES_FA } from "./types";
export { computePrayerTimes, type ComputeInput } from "./compute";
export { methodParams } from "./methods";
export { KAABA, distanceToKaabaKm, qiblaBearing } from "./qibla";

/** Iran has a single time zone and no DST (since 1401 / 2022). */
export const IRAN_UTC_OFFSET_HOURS = 3.5;

/** Minutes after midnight → "HH:MM" (24h, zero-padded, Latin digits — the UI localises digits). */
export function formatMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** The prayers shown by default in Iran, in day order (midnight belongs to the same day's night). */
export const IRAN_DISPLAY_ORDER: readonly PrayerName[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "sunset",
  "maghrib",
  "midnight",
];

/**
 * Next upcoming time of the day after `nowMinutes` (minutes after local midnight), among `names`.
 * Returns null when every listed time has already passed today.
 */
export function nextPrayer(
  times: PrayerTimes,
  nowMinutes: number,
  names: readonly PrayerName[] = IRAN_DISPLAY_ORDER,
): { name: PrayerName; minutes: number; remainingMinutes: number } | null {
  let best: { name: PrayerName; minutes: number } | null = null;
  for (const name of names) {
    const t = times[name];
    if (t === null || t <= nowMinutes) continue;
    if (best === null || t < best.minutes) best = { name, minutes: t };
  }
  return best === null ? null : { ...best, remainingMinutes: best.minutes - nowMinutes };
}
