import { describe, expect, it } from "vitest";

import {
  computePrayerTimes,
  distanceToKaabaKm,
  formatMinutes,
  IRAN_UTC_OFFSET_HOURS,
  methodParams,
  nextPrayer,
  qiblaBearing,
  DEFAULT_SETTINGS,
  type PrayerCalcMethod,
} from "../src";

const TEHRAN = { latitude: 35.6892, longitude: 51.389 };
const DATE = { year: 2026, month: 10, day: 4 };
const base = { date: DATE, location: TEHRAN, utcOffsetHours: IRAN_UTC_OFFSET_HOURS };

describe("calculation methods", () => {
  it("every method is a parameter set and produces a full, ordered day", () => {
    const methods: PrayerCalcMethod[] = [
      "tehran",
      "jafari",
      "mwl",
      "isna",
      "egypt",
      "makkah",
      "karachi",
      "custom",
    ];
    for (const method of methods) {
      const t = computePrayerTimes({ ...base, settings: { method } });
      const order = [
        "imsak",
        "fajr",
        "sunrise",
        "dhuhr",
        "asr",
        "sunset",
        "maghrib",
        "isha",
      ] as const;
      for (let i = 1; i < order.length; i++) {
        const a = t[order[i - 1] as (typeof order)[number]];
        const b = t[order[i] as (typeof order)[number]];
        expect(a, method).not.toBeNull();
        expect(b, method).not.toBeNull();
        expect(
          (b as number) >= (a as number),
          `${method}: ${order[i - 1] ?? ""} <= ${order[i] ?? ""}`,
        ).toBe(true);
      }
    }
  });

  it("a smaller fajr angle gives a later fajr (jafari 16° vs tehran 17.7°)", () => {
    const tehran = computePrayerTimes({ ...base, settings: { method: "tehran" } });
    const jafari = computePrayerTimes({ ...base, settings: { method: "jafari" } });
    expect(jafari.fajr as number).toBeGreaterThan(tehran.fajr as number);
  });

  it("minute-based isha (makkah) is exactly 90 minutes after maghrib", () => {
    const t = computePrayerTimes({ ...base, settings: { method: "makkah" } });
    expect((t.isha as number) - (t.maghrib as number)).toBe(90);
    expect(methodParams({ ...DEFAULT_SETTINGS, method: "makkah" }).isha).toEqual({ minutes: 90 });
  });

  it("custom method falls back to tehran values for anything not given", () => {
    const p = methodParams({ ...DEFAULT_SETTINGS, method: "custom", custom: { fajr: 18 } });
    expect(p.fajr).toBe(18);
    expect(p.maghrib).toEqual({ angle: 4.3 });
  });

  it("hanafi asr is later than standard asr", () => {
    const s = computePrayerTimes({ ...base, settings: { asrJuristic: "standard" } });
    const h = computePrayerTimes({ ...base, settings: { asrJuristic: "hanafi" } });
    expect(h.asr as number).toBeGreaterThan(s.asr as number);
  });

  it("manual adjustments shift a single time", () => {
    const t = computePrayerTimes({ ...base, settings: { adjustmentsMinutes: { dhuhr: 3 } } });
    const t0 = computePrayerTimes(base);
    expect((t.dhuhr as number) - (t0.dhuhr as number)).toBe(3);
    expect(t.fajr).toBe(t0.fajr);
  });

  it("imsak is imsakMinutes before fajr", () => {
    const t = computePrayerTimes({ ...base, settings: { imsakMinutes: 10 } });
    expect((t.fajr as number) - (t.imsak as number)).toBe(10);
  });

  it("midnight: jafari (sunset→fajr) is earlier than standard (sunset→sunrise)", () => {
    const j = computePrayerTimes({ ...base, settings: { method: "tehran" } });
    const s = computePrayerTimes({ ...base, settings: { method: "mwl" } });
    expect(j.midnight as number).toBeLessThan(s.midnight as number);
  });
});

describe("high latitudes", () => {
  // Oslo at midsummer: the sun sets, but never gets 18° below the horizon
  const oslo = { latitude: 59.91, longitude: 10.75 };
  const midsummer = {
    date: { year: 2026, month: 6, day: 21 },
    location: oslo,
    utcOffsetHours: 2,
  };
  it("without a rule, fajr/isha are null when the sun never gets low enough", () => {
    const t = computePrayerTimes({ ...midsummer, settings: { highLatitudeRule: "none" } });
    expect(t.fajr).toBeNull();
    expect(t.isha).toBeNull();
  });
  it("night-middle rule always yields a time", () => {
    const t = computePrayerTimes({ ...midsummer, settings: { highLatitudeRule: "night-middle" } });
    expect(t.fajr).not.toBeNull();
    expect(t.isha).not.toBeNull();
  });
});

describe("helpers", () => {
  it("formatMinutes pads and wraps", () => {
    expect(formatMinutes(278)).toBe("04:38");
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(1440 + 5)).toBe("00:05");
  });
  it("nextPrayer picks the first upcoming time of the Iranian display set", () => {
    const t = computePrayerTimes(base); // dhuhr 11:53, sunset 17:44
    const n = nextPrayer(t, 11 * 60 + 30);
    expect(n?.name).toBe("dhuhr");
    expect(n?.remainingMinutes).toBe((t.dhuhr as number) - (11 * 60 + 30));
    expect(nextPrayer(t, 12 * 60)?.name).toBe("sunset");
    expect(nextPrayer(t, 23 * 60 + 59)).toBeNull();
  });
});

describe("qibla", () => {
  it("Tehran faces south-west (~218°)", () => {
    expect(qiblaBearing(TEHRAN)).toBeCloseTo(218.4, 0);
  });
  it("Mashhad is further west than Tehran (larger bearing), Jakarta faces west", () => {
    expect(qiblaBearing({ latitude: 36.2605, longitude: 59.6168 })).toBeGreaterThan(220);
    expect(qiblaBearing({ latitude: -6.2, longitude: 106.8 })).toBeCloseTo(295, -1);
  });
  it("distance Tehran → Kaaba ≈ 1950 km", () => {
    expect(distanceToKaabaKm(TEHRAN)).toBeGreaterThan(1900);
    expect(distanceToKaabaKm(TEHRAN)).toBeLessThan(2000);
  });
});
