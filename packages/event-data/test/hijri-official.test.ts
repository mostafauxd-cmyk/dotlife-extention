import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fromJdn, toJdn } from "@dotlife/calendar-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  isOfficialHijriKnown,
  officialHijri,
  officialHijriDaysInMonth,
  officialHijriStart,
  possibleHijriShift,
  setHijriCorrection,
  tableHijriStart,
} from "../src";

const FIXTURE = fileURLToPath(
  new URL("../../calendar-core/test/fixtures/time-ir.txt", import.meta.url),
);

const rows = readFileSync(FIXTURE, "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [, g, h] = l.split("|") as [string, string, string];
    const [gy, gm, gd] = g.split("-").map(Number) as [number, number, number];
    const [hy, hm, hd] = h.split("-").map(Number) as [number, number, number];
    return { jdn: toJdn({ calendar: "gregorian", year: gy, month: gm, day: gd }), hy, hm, hd };
  });

describe("officialHijri (table-corrected)", () => {
  it("reproduces time.ir exactly on every covered day of the fixture", () => {
    let covered = 0;
    for (const r of rows) {
      if (!isOfficialHijriKnown(r.jdn)) continue;
      covered++;
      const d = officialHijri(r.jdn);
      expect([d.year, d.month, d.day], String(r.jdn)).toEqual([r.hy, r.hm, r.hd]);
    }
    // the table covers almost the whole sample (edges and the gaps in the sample are excluded)
    expect(covered / rows.length).toBeGreaterThan(0.9);
  });

  it("handles 30-day months that the arithmetic calendar considers 29 days", () => {
    // Sha'ban 1445 had 30 days in the official calendar
    expect(officialHijriDaysInMonth(1445, 8)).toBe(30);
    const d = officialHijri(toJdn({ calendar: "gregorian", year: 2024, month: 3, day: 11 }));
    expect([d.year, d.month, d.day]).toEqual([1445, 8, 30]);
  });

  it("falls back to the arithmetic calendar outside the table", () => {
    const jdn = toJdn({ calendar: "gregorian", year: 1990, month: 1, day: 1 });
    expect(isOfficialHijriKnown(jdn)).toBe(false);
    expect(officialHijri(jdn)).toEqual(fromJdn(jdn, "hijri"));
  });
});

describe("officialHijri across the table's holes and edges", () => {
  it("moves exactly one day at a time, 2020–2035: no skipped day 1, no repeated day", () => {
    const from = toJdn({ calendar: "gregorian", year: 2020, month: 1, day: 1 });
    const to = toJdn({ calendar: "gregorian", year: 2035, month: 12, day: 31 });
    let prev = officialHijri(from);
    for (let j = from + 1; j <= to; j++) {
      const d = officialHijri(j);
      const sameMonth = d.year === prev.year && d.month === prev.month;
      const nextMonth =
        d.day === 1 &&
        prev.day >= 29 &&
        prev.day <= 30 &&
        d.year * 12 + d.month === prev.year * 12 + prev.month + 1;
      expect(
        sameMonth ? d.day === prev.day + 1 : nextMonth,
        `${String(j)}: ${JSON.stringify([prev, d])}`,
      ).toBe(true);
      prev = d;
    }
  });

  it("does not call an inferred month official", () => {
    // 1445/7 is missing from the published table
    const start = officialHijriStart(1445, 7);
    expect(officialHijri(start)).toMatchObject({ year: 1445, month: 7, day: 1 });
    expect(isOfficialHijriKnown(start)).toBe(false);
  });
});

describe("the user's correction", () => {
  const ramadan = { year: 1447, month: 9 };
  const start = tableHijriStart(ramadan.year, ramadan.month);
  const len = (y: number, m: number): number => officialHijriDaysInMonth(y, m);
  afterEach(() => {
    setHijriCorrection(null);
  });

  it("only the one possible move is offered: later after 29 days, earlier after 30", () => {
    expect(possibleHijriShift(1447, 9)).toBe(len(1447, 8) === 29 ? 1 : -1);
  });

  it("moves the first day; the old first day (or the day before) changes month", () => {
    const shift = possibleHijriShift(1447, 9);
    setHijriCorrection({ ...ramadan, shift });
    expect(officialHijriStart(1447, 9)).toBe(start + shift);
    expect(officialHijri(start + shift)).toMatchObject({ year: 1447, month: 9, day: 1 });
    if (shift === 1) expect(officialHijri(start)).toMatchObject({ month: 8, day: 30 });
    else expect(len(1447, 8)).toBe(29);
  });

  it("across the table, every month stays 29 or 30 days and days run on without a gap", () => {
    for (let y = 1445; y <= 1450; y++) {
      for (let m = 1; m <= 12; m++) {
        const shift = possibleHijriShift(y, m);
        setHijriCorrection({ year: y, month: m, shift });
        const s0 = tableHijriStart(y, m);
        // only where the table itself runs on (it has a few months missing)
        let whole = true;
        for (let j = s0 - 35; j <= s0 + 100; j++) whole &&= isOfficialHijriKnown(j);
        if (!whole) continue;
        for (let j = s0 - 35; j < s0 + 100; j++) {
          const a = officialHijri(j);
          const b = officialHijri(j + 1);
          const at = `${String(y)}/${String(m)} ${String(j)}`;
          if (b.day !== 1) expect(b.day, at).toBe(a.day + 1);
          else {
            expect(a.day, at).toBe(len(a.year, a.month));
            expect(a.day, at).toBeGreaterThanOrEqual(29);
            expect(a.day, at).toBeLessThanOrEqual(30);
          }
        }
      }
    }
  });

  it("off, nothing moves", () => {
    setHijriCorrection(null);
    expect(officialHijri(start)).toMatchObject({ year: 1447, month: 9, day: 1 });
  });
});
