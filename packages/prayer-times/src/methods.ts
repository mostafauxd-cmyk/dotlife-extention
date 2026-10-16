import { assertNever } from "@dotlife/shared";

import type { MethodParams, PrayerCalcMethod, PrayerSettings } from "./types";

/**
 * Parameter sets per authority (same values as the widely used PrayTimes tables), except `tehran`:
 * the Institute of Geophysics publishes 17.7° / 4.5°, but against time.ir's official tables
 * (5 cities, 2026-10-04) 18° / 4.3° reproduces every fajr and maghrib to the minute while
 * 17.7° / 4.5° is 1–2 minutes late. Calibrated empirically — re-validate when a full-year table is available.
 */
const METHODS: Readonly<Record<Exclude<PrayerCalcMethod, "custom">, MethodParams>> = {
  tehran: { fajr: 18, isha: { angle: 14 }, maghrib: { angle: 4.3 }, midnight: "jafari" },
  jafari: { fajr: 16, isha: { angle: 14 }, maghrib: { angle: 4 }, midnight: "jafari" },
  mwl: { fajr: 18, isha: { angle: 17 }, maghrib: { minutes: 0 }, midnight: "standard" },
  isna: { fajr: 15, isha: { angle: 15 }, maghrib: { minutes: 0 }, midnight: "standard" },
  egypt: { fajr: 19.5, isha: { angle: 17.5 }, maghrib: { minutes: 0 }, midnight: "standard" },
  makkah: { fajr: 18.5, isha: { minutes: 90 }, maghrib: { minutes: 0 }, midnight: "standard" },
  karachi: { fajr: 18, isha: { angle: 18 }, maghrib: { minutes: 0 }, midnight: "standard" },
};

export function methodParams(settings: PrayerSettings): MethodParams {
  const m = settings.method;
  switch (m) {
    case "tehran":
    case "jafari":
    case "mwl":
    case "isna":
    case "egypt":
    case "makkah":
    case "karachi":
      return METHODS[m];
    case "custom":
      return { ...METHODS.tehran, ...settings.custom };
    default:
      return assertNever(m);
  }
}
