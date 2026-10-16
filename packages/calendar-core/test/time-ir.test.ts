import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { convert, daysBetween, toJdn } from "../src";
import type { CalendarDate, CalendarSystem } from "../src";

/**
 * Reference data scraped from time.ir (the de-facto official Iranian calendar site) on 1405/07/12:
 * 72 months between Dey 1401 and Tir 1408 (not contiguous) with their Gregorian and official Hijri dates.
 * The official Hijri calendar is observational, so it may contain dates (e.g. 30 Sha'ban 1445) that do
 * not exist in the tabular calendar — it is therefore compared via "first of month + day" only.
 */
const FIXTURE = fileURLToPath(new URL("./fixtures/time-ir.txt", import.meta.url));

type Row = { jalali: CalendarDate; gregorian: CalendarDate; hijri: CalendarDate };

function parse(calendar: CalendarSystem, s: string): CalendarDate {
  const [year, month, day] = s.split("-").map(Number) as [number, number, number];
  return { calendar, year, month, day };
}

const ROWS = 2192;

const rows: Row[] = readFileSync(FIXTURE, "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [j, g, h] = l.split("|") as [string, string, string];
    return {
      jalali: parse("solar-hijri", j),
      gregorian: parse("gregorian", g),
      hijri: parse("hijri", h),
    };
  });

describe("time.ir reference data (72 months, 1401–1408)", () => {
  it("has the expected size", () => {
    expect(rows.length).toBe(ROWS);
  });

  it("Solar Hijri ⇄ Gregorian matches time.ir on every single day", () => {
    const bad = rows.filter(
      (r) =>
        daysBetween(r.jalali, r.gregorian) !== 0 ||
        JSON.stringify(convert(r.gregorian, "solar-hijri")) !== JSON.stringify(r.jalali),
    );
    expect(bad.map((r) => JSON.stringify(r)).slice(0, 5)).toEqual([]);
  });

  it("tabular Hijri is within ±1 day of the official observational Hijri on every day", () => {
    const offsets = new Map<number, number>();
    for (const r of rows) {
      const tabular = toJdn(convert(r.gregorian, "hijri"));
      const official = toJdn({ ...r.hijri, day: 1 }) + (r.hijri.day - 1);
      const off = tabular - official;
      offsets.set(off, (offsets.get(off) ?? 0) + 1);
    }
    expect([...offsets.keys()].sort()).toEqual([-1, 0, 1]);
    // the majority of days agree exactly; the rest is the ±1 moon-sighting difference
    expect((offsets.get(0) ?? 0) / rows.length).toBeGreaterThan(0.5);
  });

  it("official Hijri months are 29 or 30 days", () => {
    // only months fully covered by the sample (sample is not contiguous)
    const days = new Map<string, Set<number>>();
    for (const r of rows) {
      const k = `${String(r.hijri.year)}/${String(r.hijri.month)}`;
      if (!days.has(k)) days.set(k, new Set());
      days.get(k)?.add(r.hijri.day);
    }
    let complete = 0;
    for (const [k, set] of days) {
      if (!set.has(1) || !set.has(29)) continue;
      complete++;
      expect([29, 30], k).toContain(set.size);
    }
    expect(complete).toBeGreaterThan(50);
  });
});
