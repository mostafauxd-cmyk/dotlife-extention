import { describe, expect, it } from "vitest";

import { convert, isLeapYear, toJdn, weekday } from "../src";
import type { CalendarDate } from "../src";

const g = (year: number, month: number, day: number): CalendarDate => ({
  calendar: "gregorian",
  year,
  month,
  day,
});
const j = (year: number, month: number, day: number): CalendarDate => ({
  calendar: "solar-hijri",
  year,
  month,
  day,
});
const h = (year: number, month: number, day: number): CalendarDate => ({
  calendar: "hijri",
  year,
  month,
  day,
});

describe("Gregorian ↔ JDN", () => {
  it("matches published Julian Day Numbers", () => {
    expect(toJdn(g(2000, 1, 1))).toBe(2451545);
    expect(toJdn(g(1970, 1, 1))).toBe(2440588);
    expect(toJdn(g(1858, 11, 17))).toBe(2400001); // Modified Julian Date epoch
    expect(toJdn(g(2026, 10, 4))).toBe(2461318);
  });
});

describe("Solar Hijri anchors (official Iranian calendar)", () => {
  it.each([
    // Nowruz of recent years, including the 1403 leap year
    [j(1400, 1, 1), g(2021, 3, 21)],
    [j(1401, 1, 1), g(2022, 3, 21)],
    [j(1402, 1, 1), g(2023, 3, 21)],
    [j(1403, 1, 1), g(2024, 3, 20)],
    [j(1404, 1, 1), g(2025, 3, 21)],
    [j(1405, 1, 1), g(2026, 3, 21)],
    // last day of the year
    [j(1402, 12, 29), g(2024, 3, 19)],
    [j(1403, 12, 30), g(2025, 3, 20)],
    // mid-year
    [j(1405, 7, 1), g(2026, 9, 23)],
    [j(1405, 7, 12), g(2026, 10, 4)],
    [j(1358, 8, 30), g(1979, 11, 21)],
    [j(1357, 11, 22), g(1979, 2, 11)],
    // far dates covered by the break table
    [j(1, 1, 1), g(622, 3, 22)],
    [j(1500, 1, 1), g(2121, 3, 21)],
  ])("%o ⇄ %o", (jalali, gregorian) => {
    expect(convert(jalali, "gregorian")).toEqual(gregorian);
    expect(convert(gregorian, "solar-hijri")).toEqual(jalali);
  });

  it("knows the leap years around now", () => {
    const leap = [1395, 1399, 1403, 1408];
    for (let y = 1395; y <= 1410; y++) {
      expect(isLeapYear("solar-hijri", y), `year ${String(y)}`).toBe(leap.includes(y));
    }
  });
});

describe("Hijri (tabular) anchors", () => {
  it("epoch is 1 Muharram 1 AH = 19 July 622 (proleptic Gregorian)", () => {
    expect(convert(h(1, 1, 1), "gregorian")).toEqual(g(622, 7, 19));
  });
  it.each([
    [h(1400, 1, 1), g(1979, 11, 21)],
    [h(1446, 9, 1), g(2025, 3, 1)],
    [h(1446, 1, 9), g(2024, 7, 16)],
    [h(1448, 4, 21), g(2026, 10, 4)],
  ])("%o ⇄ %o", (hijri, gregorian) => {
    expect(convert(hijri, "gregorian")).toEqual(gregorian);
    expect(convert(gregorian, "hijri")).toEqual(hijri);
  });
});

describe("Shahanshahi", () => {
  it("is Solar Hijri + 1180 with the same months", () => {
    expect(convert(j(1405, 7, 12), "shahanshahi")).toEqual({
      calendar: "shahanshahi",
      year: 2585,
      month: 7,
      day: 12,
    });
    expect(convert({ calendar: "shahanshahi", year: 2585, month: 1, day: 1 }, "gregorian")).toEqual(
      g(2026, 3, 21),
    );
    expect(isLeapYear("shahanshahi", 1403 + 1180)).toBe(true);
  });
});

describe("weekday (Saturday = 0)", () => {
  it.each([
    [g(2026, 10, 4), 1, "Sunday"],
    [g(2026, 3, 21), 0, "Saturday"],
    [g(2025, 3, 21), 6, "Friday"],
    [g(2000, 1, 1), 0, "Saturday"],
    [j(1405, 7, 1), 4, "Wednesday"],
  ])("%o → %i (%s)", (date, expected) => {
    expect(weekday(date)).toBe(expected);
  });
});
