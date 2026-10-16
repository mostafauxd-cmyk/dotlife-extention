import { describe, expect, it } from "vitest";

import {
  computePrayerTimes,
  formatMinutes,
  IRAN_UTC_OFFSET_HOURS,
  type Location,
  type PrayerName,
} from "../src";

/**
 * Reference: time.ir «اوقات شرعی به افق شهرها» on 12 Mehr 1405 (2026-10-04), read on that day.
 * time.ir publishes the Institute of Geophysics tables; the app's acceptance tolerance is 1 minute (PLAN §14).
 */
type Ref = { name: string; location: Location; times: Record<string, string> };

const REFS: Ref[] = [
  {
    name: "تهران",
    location: { latitude: 35.6892, longitude: 51.389 },
    times: {
      fajr: "04:37",
      sunrise: "06:01",
      dhuhr: "11:53",
      sunset: "17:44",
      maghrib: "18:01",
      midnight: "23:11",
    },
  },
  {
    name: "مشهد",
    location: { latitude: 36.2605, longitude: 59.6168 },
    times: {
      fajr: "04:03",
      sunrise: "05:29",
      dhuhr: "11:20",
      sunset: "17:11",
      maghrib: "17:29",
      midnight: "22:38",
    },
  },
  {
    name: "تبریز",
    location: { latitude: 38.08, longitude: 46.2919 },
    times: {
      fajr: "04:55",
      sunrise: "06:23",
      dhuhr: "12:14",
      sunset: "18:04",
      maghrib: "18:21",
      midnight: "23:30",
    },
  },
  {
    name: "بندرعباس",
    location: { latitude: 27.1865, longitude: 56.2808 },
    times: {
      fajr: "04:22",
      sunrise: "05:39",
      dhuhr: "11:34",
      sunset: "17:28",
      maghrib: "17:44",
      midnight: "22:55",
    },
  },
  {
    name: "زاهدان",
    location: { latitude: 29.4963, longitude: 60.8629 },
    times: {
      fajr: "04:02",
      sunrise: "05:21",
      dhuhr: "11:15",
      sunset: "17:09",
      maghrib: "17:25",
      midnight: "22:36",
    },
  },
];

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

describe("Tehran method vs time.ir, 2026-10-04", () => {
  it.each(REFS)("$name: every published time within 1 minute", ({ location, times }) => {
    const t = computePrayerTimes({
      date: { year: 2026, month: 10, day: 4 },
      location,
      utcOffsetHours: IRAN_UTC_OFFSET_HOURS,
    });
    for (const [name, expected] of Object.entries(times)) {
      const got = t[name as PrayerName];
      expect(got, name).not.toBeNull();
      const diff = Math.abs((got as number) - toMinutes(expected));
      expect(
        diff,
        `${name}: got ${formatMinutes(got as number)} expected ${expected}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("most times match exactly (not just within tolerance)", () => {
    let exact = 0;
    let total = 0;
    for (const { location, times } of REFS) {
      const t = computePrayerTimes({
        date: { year: 2026, month: 10, day: 4 },
        location,
        utcOffsetHours: IRAN_UTC_OFFSET_HOURS,
      });
      for (const [name, expected] of Object.entries(times)) {
        total++;
        if (t[name as PrayerName] === toMinutes(expected)) exact++;
      }
    }
    expect(exact / total).toBeGreaterThan(0.5);
  });
});
