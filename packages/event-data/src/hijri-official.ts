import { daysInMonth, fromJdn, toJdn, type CalendarDate, type Jdn } from "@dotlife/calendar-core";

import { HIJRI_MONTH_STARTS } from "./data/hijri-month-starts";

/**
 * Official Iranian Hijri date for a day.
 *
 * The official calendar is observational, so it can differ from calendar-core's arithmetic Hijri by ±1 day.
 * Where the month-start table covers the day, that table wins; outside the table the arithmetic calendar is used.
 */

const keyOf = (year: number, month: number): number => year * 12 + month;
const ymOf = (key: number): { year: number; month: number } => {
  const month = ((key - 1) % 12) + 1;
  return { year: (key - month) / 12, month };
};

type MonthStart = { year: number; month: number; jdn: Jdn; inferred?: true };

const KNOWN: readonly MonthStart[] = Object.entries(HIJRI_MONTH_STARTS)
  .map(([key, iso]) => {
    const [year, month] = key.split("/").map(Number) as [number, number];
    const [gy, gm, gd] = iso.split("-").map(Number) as [number, number, number];
    return { year, month, jdn: toJdn({ calendar: "gregorian", year: gy, month: gm, day: gd }) };
  })
  .sort((a, b) => a.jdn - b.jdn);

/**
 * Months missing between two known starts (the table has holes, e.g. 1445/7). Inside a hole the
 * arithmetic calendar's starts stand; only where that would make a month shorter than 29 days or
 * longer than 30 against a known start is the nearest one moved. Without this the fallback met the
 * table a day off — 1445/6/30 was followed by 1445/7/2, and 1449/9/1 came twice.
 */
function withGapsFilled(known: readonly MonthStart[]): MonthStart[] {
  const out: MonthStart[] = [];
  for (const [i, cur] of known.entries()) {
    out.push(cur);
    const next = known[i + 1];
    if (next === undefined) break;
    const first = keyOf(cur.year, cur.month);
    const months = keyOf(next.year, next.month) - first;
    const span = next.jdn - cur.jdn;
    if (months < 2 || span < 29 * months || span > 30 * months) continue;
    // starts[0] and starts[months] are known; the ones between begin as arithmetic
    const starts = Array.from({ length: months + 1 }, (_, k) => {
      if (k === 0) return cur.jdn;
      if (k === months) return next.jdn;
      const { year, month } = ymOf(first + k);
      return toJdn({ calendar: "hijri", year, month, day: 1 });
    });
    const at = (k: number): number => starts[k] ?? 0;
    for (let k = 1; k < months; k++) {
      starts[k] = Math.min(Math.max(at(k), at(k - 1) + 29), at(k - 1) + 30);
    }
    for (let k = months - 1; k >= 1; k--) {
      starts[k] = Math.min(Math.max(at(k), at(k + 1) - 30), at(k + 1) - 29);
    }
    for (let k = 1; k < months; k++) out.push({ ...ymOf(first + k), jdn: at(k), inferred: true });
  }
  return out;
}

const STARTS: readonly MonthStart[] = withGapsFilled(KNOWN);

/**
 * Before the table and after it the arithmetic calendar takes over, moved by however far it is
 * from the table's first and last known starts, so the two meet without a skipped or repeated day.
 */
const FIRST = STARTS[0] as MonthStart;
const LAST = STARTS[STARTS.length - 1] as MonthStart;
const offsetAt = (s: MonthStart): number =>
  s.jdn - toJdn({ calendar: "hijri", year: s.year, month: s.month, day: 1 });
const BEFORE_SHIFT = offsetAt(FIRST);
const AFTER_SHIFT = offsetAt(LAST);

function isNextMonth(a: MonthStart, b: MonthStart): boolean {
  return (
    (b.year === a.year && b.month === a.month + 1) ||
    (b.year === a.year + 1 && a.month === 12 && b.month === 1)
  );
}

/** Returns `{ start, end }` JDNs (end exclusive) of the official month containing `jdn`, or null if not covered. */
function officialMonthAt(
  jdn: Jdn,
): { year: number; month: number; start: Jdn; end: Jdn; inferred: boolean } | null {
  // binary search for the last start <= jdn
  let lo = 0;
  let hi = STARTS.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = STARTS[mid] as MonthStart;
    if (s.jdn <= jdn) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (idx < 0) return null;
  const cur = STARTS[idx] as MonthStart;
  const next = STARTS[idx + 1];
  // we only trust the month if we also know where it ends
  if (!next || !isNextMonth(cur, next)) return null;
  if (jdn >= next.jdn) return null;
  return {
    year: cur.year,
    month: cur.month,
    start: cur.jdn,
    end: next.jdn,
    inferred: cur.inferred === true,
  };
}

/** The official (or, outside the table, arithmetic) date before any correction of the user's. */
function tableHijri(jdn: Jdn): CalendarDate {
  const m = officialMonthAt(jdn);
  if (m) return { calendar: "hijri", year: m.year, month: m.month, day: jdn - m.start + 1 };
  return fromJdn(jdn - (jdn < FIRST.jdn ? BEFORE_SHIFT : AFTER_SHIFT), "hijri");
}

const START_OF = new Map(STARTS.map((s) => [s.year * 12 + s.month, s.jdn]));

/** First day of a month: the table's when it has it, else the first day the calendar above gives it. */
function tableStart(year: number, month: number): Jdn {
  const known = START_OF.get(year * 12 + month);
  if (known !== undefined) return known;
  const guess = toJdn({ calendar: "hijri", year, month, day: 1 });
  for (let j = guess - 3; j <= guess + 3; j++) {
    const d = tableHijri(j);
    if (d.year === year && d.month === month) return j;
  }
  return guess;
}

/**
 * The user's correction (2026-10-11): the official calendar is published in advance, and the moon
 * is sometimes seen a day off the forecast. The correction moves one month's first day by a day; a
 * month can only be 29 or 30 days, so where that would break the next month, it moves too.
 */
export type HijriCorrection = { year: number; month: number; shift: -1 | 1 };

let correction: HijriCorrection | null = null;
/** Month key → days its first day moves, for the corrected month and any it pushes along. */
let moved = new Map<number, number>();

export function setHijriCorrection(c: HijriCorrection | null): void {
  correction = c;
  moved = new Map();
  if (c === null) return;
  let key = keyOf(c.year, c.month);
  moved.set(key, c.shift);
  // a month can only be 29 or 30 days: push the following starts until one has room
  for (let i = 0; i < 12; i++) {
    const cur = ymOf(key);
    const next = ymOf(key + 1);
    const len = tableStart(next.year, next.month) - (tableStart(cur.year, cur.month) + c.shift);
    if (len >= 29 && len <= 30) break;
    key += 1;
    moved.set(key, c.shift);
  }
}

export const hijriCorrection = (): HijriCorrection | null => correction;

/**
 * The one way a month's start can be off: after a 29-day month (moon forecast as seen on the 29th)
 * it can only start a day later; after a 30-day month, only a day earlier.
 */
export function possibleHijriShift(year: number, month: number): -1 | 1 {
  const prev = ymOf(keyOf(year, month) - 1);
  return tableStart(year, month) - tableStart(prev.year, prev.month) <= 29 ? 1 : -1;
}

const startOf = (key: number): Jdn => {
  const { year, month } = ymOf(key);
  return tableStart(year, month) + (moved.get(key) ?? 0);
};

export function officialHijri(jdn: Jdn): CalendarDate {
  const base = tableHijri(jdn);
  let key = keyOf(base.year, base.month);
  if (!moved.has(key) && !moved.has(key + 1)) return base;
  // the day sits in its table month or, after a move, one either side of it
  if (jdn < startOf(key)) key -= 1;
  else if (jdn >= startOf(key + 1)) key += 1;
  const { year, month } = ymOf(key);
  return { calendar: "hijri", year, month, day: jdn - startOf(key) + 1 };
}

/** Length of an official Hijri month (29 or 30); falls back to the arithmetic calendar when unknown. */
export function officialHijriDaysInMonth(year: number, month: number): number {
  const key = keyOf(year, month);
  if (moved.has(key) || moved.has(key + 1)) return startOf(key + 1) - startOf(key);
  const i = STARTS.findIndex((s) => s.year === year && s.month === month);
  const cur = STARTS[i];
  const next = STARTS[i + 1];
  if (cur && next && isNextMonth(cur, next)) return next.jdn - cur.jdn;
  return daysInMonth("hijri", year, month);
}

/** First day of an official Hijri month, after the user's correction. */
export const officialHijriStart = (year: number, month: number): Jdn => startOf(keyOf(year, month));

/** First day of a month as the official calendar has it, before any correction. */
export const tableHijriStart = (year: number, month: number): Jdn => tableStart(year, month);

/** True when the official table covers this day (otherwise the arithmetic fallback was used). */
export function isOfficialHijriKnown(jdn: Jdn): boolean {
  const m = officialMonthAt(jdn);
  return m !== null && !m.inferred;
}
