import { describe, expect, it } from "vitest";

import {
  addDays,
  compare,
  daysBetween,
  daysInMonth,
  fromJdn,
  isSameDay,
  isValid,
  monthName,
  toJdn,
  today,
  validate,
  weekdayOfJdn,
} from "../src";
import type { CalendarDate, CalendarSystem } from "../src";

const SYSTEMS: readonly CalendarSystem[] = ["solar-hijri", "gregorian", "hijri", "shahanshahi"];

// 1900-01-01 … 2100-12-31 — every single day
const JDN_FROM = toJdn({ calendar: "gregorian", year: 1900, month: 1, day: 1 });
const JDN_TO = toJdn({ calendar: "gregorian", year: 2100, month: 12, day: 31 });

describe("round-trip over every day 1900–2100", () => {
  it.each(SYSTEMS)("%s: fromJdn → toJdn is identity and dates are valid", (calendar) => {
    for (let jdn = JDN_FROM; jdn <= JDN_TO; jdn++) {
      const d = fromJdn(jdn, calendar);
      if (toJdn(d) !== jdn || !isValid(d)) {
        throw new Error(`${calendar}: jdn ${String(jdn)} → ${JSON.stringify(d)}`);
      }
    }
  });

  it.each(SYSTEMS)("%s: consecutive days are consecutive dates", (calendar) => {
    let prev = fromJdn(JDN_FROM, calendar);
    for (let jdn = JDN_FROM + 1; jdn <= JDN_TO; jdn++) {
      const cur = fromJdn(jdn, calendar);
      const sameMonth = cur.year === prev.year && cur.month === prev.month;
      const okWithinMonth = sameMonth && cur.day === prev.day + 1;
      const okNewMonth =
        !sameMonth &&
        cur.day === 1 &&
        prev.day === daysInMonth(calendar, prev.year, prev.month) &&
        ((cur.year === prev.year && cur.month === prev.month + 1) ||
          (cur.year === prev.year + 1 && cur.month === 1 && prev.month === 12));
      if (!okWithinMonth && !okNewMonth) {
        throw new Error(`${calendar}: ${JSON.stringify(prev)} → ${JSON.stringify(cur)}`);
      }
      prev = cur;
    }
  });
});

describe("month lengths", () => {
  it("Solar Hijri: 31×6, 30×5, Esfand 29/30", () => {
    for (let m = 1; m <= 6; m++) expect(daysInMonth("solar-hijri", 1405, m)).toBe(31);
    for (let m = 7; m <= 11; m++) expect(daysInMonth("solar-hijri", 1405, m)).toBe(30);
    expect(daysInMonth("solar-hijri", 1405, 12)).toBe(29);
    expect(daysInMonth("solar-hijri", 1403, 12)).toBe(30);
  });
  it("Hijri: alternating 30/29, Dhu al-Hijjah 30 in leap years; year is 354 or 355 days", () => {
    for (let y = 1400; y <= 1460; y++) {
      let total = 0;
      for (let m = 1; m <= 12; m++) total += daysInMonth("hijri", y, m);
      expect([354, 355]).toContain(total);
      expect(total).toBe(
        toJdn({ calendar: "hijri", year: y + 1, month: 1, day: 1 }) -
          toJdn({ calendar: "hijri", year: y, month: 1, day: 1 }),
      );
    }
  });
});

describe("validation", () => {
  it("rejects impossible dates", () => {
    expect(isValid({ calendar: "solar-hijri", year: 1405, month: 12, day: 30 })).toBe(false);
    expect(isValid({ calendar: "solar-hijri", year: 1403, month: 12, day: 30 })).toBe(true);
    expect(isValid({ calendar: "gregorian", year: 2026, month: 2, day: 29 })).toBe(false);
    expect(isValid({ calendar: "hijri", year: 1448, month: 2, day: 30 })).toBe(false);
    expect(isValid({ calendar: "gregorian", year: 2026, month: 13, day: 1 })).toBe(false);
    expect(isValid({ calendar: "gregorian", year: 2026, month: 1.5, day: 1 })).toBe(false);
    expect(() => {
      validate({ calendar: "gregorian", year: 2026, month: 0, day: 1 });
    }).toThrow(RangeError);
  });
  it("rejects Jalali years outside the supported range", () => {
    expect(isValid({ calendar: "solar-hijri", year: 3200, month: 1, day: 1 })).toBe(false);
  });
  it("rejects non-integer JDN", () => {
    expect(() => fromJdn(2461318.5, "gregorian")).toThrow(RangeError);
  });
});

describe("arithmetic helpers", () => {
  const a: CalendarDate = { calendar: "solar-hijri", year: 1405, month: 7, day: 12 };
  it("addDays crosses month and year boundaries", () => {
    expect(addDays(a, 19)).toEqual({ calendar: "solar-hijri", year: 1405, month: 8, day: 1 });
    expect(addDays(a, -12)).toEqual({ calendar: "solar-hijri", year: 1405, month: 6, day: 31 });
    expect(addDays({ calendar: "solar-hijri", year: 1405, month: 12, day: 29 }, 1)).toEqual({
      calendar: "solar-hijri",
      year: 1406,
      month: 1,
      day: 1,
    });
  });
  it("daysBetween / compare / isSameDay work across calendars", () => {
    const b: CalendarDate = { calendar: "gregorian", year: 2026, month: 10, day: 4 };
    expect(daysBetween(a, b)).toBe(0);
    expect(isSameDay(a, b)).toBe(true);
    expect(compare(a, addDays(b, 1))).toBe(-1);
    expect(compare(addDays(b, 1), a)).toBe(1);
    expect(compare(a, b)).toBe(0);
  });
  it("weekday cycles every 7 days", () => {
    const base = toJdn(a);
    for (let i = 0; i < 14; i++) expect(weekdayOfJdn(base + i)).toBe((1 + i) % 7);
  });
});

describe("today / names", () => {
  it("today() uses the host local date", () => {
    const now = new Date(2026, 9, 4, 23, 59); // local 2026-10-04
    expect(today("solar-hijri", now)).toEqual({
      calendar: "solar-hijri",
      year: 1405,
      month: 7,
      day: 12,
    });
    expect(today("hijri", now)).toEqual({ calendar: "hijri", year: 1448, month: 4, day: 21 });
  });
  it("month names are Persian", () => {
    expect(monthName({ calendar: "solar-hijri", year: 1405, month: 7, day: 12 })).toBe("مهر");
    expect(monthName({ calendar: "hijri", year: 1448, month: 4, day: 21 })).toBe("ربیع‌الثانی");
    expect(monthName({ calendar: "gregorian", year: 2026, month: 10, day: 4 })).toBe("اکتبر");
  });
});
