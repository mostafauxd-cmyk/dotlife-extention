import {
  daysInMonth,
  fromJdn,
  toJdn,
  type CalendarDate,
  type CalendarSystem,
  type Jdn,
  type Weekday,
} from "@dotlife/calendar-core";

import { addDays, dateToJdn, jdnToDate, shiftPoint, weekdayOf } from "./dates";
import type { LocalDate, Occurrence, Recurrence, Task, TaskSchedule } from "./models";

/**
 * Lazy, calendar-aware recurrence expansion (PLAN §15). Occurrences are generated only inside the
 * requested window; a "never"-ending series is never materialised in full.
 */

/** Hard cap on candidates walked per call (from the window, not the seed), so a pathological rule can never freeze the UI. */
export const MAX_OCCURRENCES = 1000;

type Window = { from: LocalDate; to: LocalDate };

function seedDate(s: Exclude<TaskSchedule, { kind: "none" }>): LocalDate {
  return s.kind === "due" ? s.due.date : s.start.date;
}

/**
 * Candidate dates of the rule in order, each with its 1-based number in the series (for `count`
 * ends). Daily and weekly rules start at the candidate just before `from` instead of walking from
 * the seed, so a series that began years ago costs no more than a new one.
 */
function* candidates(
  seed: LocalDate,
  r: Recurrence,
  from: LocalDate,
): Generator<[date: LocalDate, n: number]> {
  const gap = dateToJdn(from) - dateToJdn(seed);
  switch (r.freq) {
    case "daily": {
      const first = gap > 0 ? Math.floor(gap / r.interval) : 0;
      for (let i = first; ; i++) yield [addDays(seed, i * r.interval), i + 1];
    }
    case "weekly": {
      // a weekday listed twice would yield each date twice and count it twice against `count`
      const weekdays = [...new Set(r.byWeekday ?? [weekdayOf(seed)])].sort((a, b) => a - b);
      // start of the seed's week (Saturday); weekdays of that week before the seed are not in the series
      const weekStart = addDays(seed, -weekdayOf(seed));
      const before = weekdays.filter((wd) => addDays(weekStart, wd) < seed).length;
      const span = gap + weekdayOf(seed); // days from weekStart to `from`
      const first = span > 0 ? Math.floor(span / (7 * r.interval)) : 0;
      for (let w = first; ; w++) {
        const base = addDays(weekStart, w * 7 * r.interval);
        for (const [p, wd] of weekdays.entries()) {
          const d = addDays(base, wd);
          if (d >= seed) yield [d, w * weekdays.length + p - before + 1];
        }
      }
    }
    case "monthly": {
      let n = 0;
      for (const d of monthly(seed, r)) yield [d, ++n];
      return;
    }
    case "yearly": {
      let n = 0;
      for (const d of yearly(seed, r)) yield [d, ++n];
      return;
    }
  }
}

function* monthly(seed: LocalDate, r: Recurrence): Generator<LocalDate> {
  const cal: CalendarSystem = r.calendar;
  const seedJdn = dateToJdn(seed);
  const s = fromJdn(seedJdn, cal);
  if (r.monthlyBy === "nthWeekday") {
    const wd = weekdayOf(seed);
    const nth = Math.ceil(s.day / 7); // 1..5
    for (let i = 0; ; i++) {
      const { year, month } = addMonths(s.year, s.month, i * r.interval);
      const d = nthWeekdayOfMonth(cal, year, month, wd, nth);
      if (d !== null && d >= seedJdn) yield jdnToDate(d);
    }
  }
  for (let i = 0; ; i++) {
    const { year, month } = addMonths(s.year, s.month, i * r.interval);
    const day = Math.min(s.day, daysInMonth(cal, year, month)); // 31 Shahrivar → 30 Mehr etc.
    yield jdnToDate(toJdn({ calendar: cal, year, month, day }));
  }
}

function* yearly(seed: LocalDate, r: Recurrence): Generator<LocalDate> {
  const cal: CalendarSystem = r.calendar;
  const s = fromJdn(dateToJdn(seed), cal);
  for (let i = 0; ; i++) {
    const year = s.year + i * r.interval;
    const day = Math.min(s.day, daysInMonth(cal, year, s.month)); // 30 Esfand → 29 in common years
    yield jdnToDate(toJdn({ calendar: cal, year, month: s.month, day }));
  }
}

function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** JDN of the nth `weekday` of a month in `cal`, or null when the month has no nth one. */
function nthWeekdayOfMonth(
  cal: CalendarSystem,
  year: number,
  month: number,
  weekday: Weekday,
  nth: number,
): Jdn | null {
  const first: CalendarDate = { calendar: cal, year, month, day: 1 };
  const firstJdn = toJdn(first);
  const offset = (weekday - weekdayOf(jdnToDate(firstJdn)) + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  if (day > daysInMonth(cal, year, month)) return null;
  return firstJdn + day - 1;
}

function shiftSchedule(
  s: Exclude<TaskSchedule, { kind: "none" }>,
  days: number,
): Exclude<TaskSchedule, { kind: "none" }> {
  return s.kind === "due"
    ? { kind: "due", due: shiftPoint(s.due, days) }
    : { kind: "range", start: shiftPoint(s.start, days), end: shiftPoint(s.end, days) };
}

/** The dates on which a schedule is "present" (for window overlap). */
function scheduleSpan(s: Exclude<TaskSchedule, { kind: "none" }>): [LocalDate, LocalDate] {
  return s.kind === "due" ? [s.due.date, s.due.date] : [s.start.date, s.end.date];
}

/**
 * All occurrences of `task` that overlap `[from, to]` (inclusive, by date), applying overrides.
 * A non-recurring task yields at most one occurrence. Cancelled occurrences are omitted.
 */
export function expandOccurrences(task: Task, window: Window): Occurrence[] {
  if (task.deletedAt !== undefined || task.schedule.kind === "none") return [];
  const seedSchedule = task.schedule;

  if (!task.recurrence) {
    const occ = makeOccurrence(
      task,
      seedSchedule.kind === "due" ? seedSchedule.due.date : seedSchedule.start.date,
      seedSchedule,
      false,
    );
    return overlaps(occ.schedule, window) ? [occ] : [];
  }

  const r = task.recurrence;
  const seed = seedDate(seedSchedule);
  const seedJdn = dateToJdn(seed);
  const overrides = new Map((task.overrides ?? []).map((o) => [o.originalDate, o]));
  // the earliest candidate that can still reach the window: one whose span ends inside it.
  // Occurrences an override moved in from outside are found apart, below — walking back to an old
  // move's date would spend the step cap long before the window (a daily task moved once in 2023
  // showed nothing in 2026).
  const [spanStart, spanEnd] = scheduleSpan(seedSchedule);
  const reach = addDays(window.from, dateToJdn(spanStart) - dateToJdn(spanEnd));
  const out: Occurrence[] = [];
  const walked = new Set<LocalDate>();
  let steps = 0;

  for (const [date, n] of candidates(seed, r, reach)) {
    steps++;
    if (r.end.kind === "count" && n > r.end.count) break;
    if (r.end.kind === "until" && date > r.end.date) break;
    if (steps > MAX_OCCURRENCES) break;
    // the span of a range task extends past `date`; stop only once even the start is past the window
    if (date > window.to) break;

    walked.add(date);
    const delta = dateToJdn(date) - seedJdn;
    const ov = overrides.get(date);
    if (ov?.cancelled === true) continue;
    const schedule =
      ov?.schedule !== undefined && ov.schedule.kind !== "none"
        ? ov.schedule
        : shiftSchedule(seedSchedule, delta);
    const occ: Occurrence = {
      taskId: task.id,
      originalDate: date,
      title: ov?.title ?? task.title,
      schedule,
      status: ov?.status ?? "todo",
      recurring: true,
    };
    if (overlaps(schedule, window)) out.push(occ);
  }

  // moved into the window from a date the walk did not pass: before it, or after the window
  for (const ov of overrides.values()) {
    if (walked.has(ov.originalDate) || ov.cancelled === true) continue;
    if (ov.schedule === undefined || ov.schedule.kind === "none") continue;
    if (!overlaps(ov.schedule, window) || !isInSeries(seed, r, ov.originalDate)) continue;
    out.push({
      taskId: task.id,
      originalDate: ov.originalDate,
      title: ov.title ?? task.title,
      schedule: ov.schedule,
      status: ov.status ?? "todo",
      recurring: true,
    });
  }
  return out.sort((a, b) =>
    a.originalDate < b.originalDate ? -1 : a.originalDate > b.originalDate ? 1 : 0,
  );
}

/** Whether `date` is one of the series' own dates, inside its end (an override can outlive a rule edit). */
function isInSeries(seed: LocalDate, r: Recurrence, date: LocalDate): boolean {
  let steps = 0;
  for (const [d, n] of candidates(seed, r, date)) {
    if (++steps > MAX_OCCURRENCES) return false;
    if (d < date) continue;
    if (d > date) return false;
    if (r.end.kind === "count" && n > r.end.count) return false;
    if (r.end.kind === "until" && d > r.end.date) return false;
    return true;
  }
  return false;
}

/**
 * How many of the series' occurrences fall before `date`, cancelled ones included: what a split at
 * `date` has used of a `count` end. Counted by the rule itself, not over a guessed span of days.
 */
export function occurrencesBefore(task: Task, date: LocalDate): number {
  if (!task.recurrence || task.schedule.kind === "none") return 0;
  const r = task.recurrence;
  let steps = 0;
  let before = 0;
  for (const [d, n] of candidates(seedDate(task.schedule), r, date)) {
    if (++steps > MAX_OCCURRENCES) break;
    if (d >= date) return n - 1;
    before = n;
  }
  return before;
}

function makeOccurrence(
  task: Task,
  originalDate: LocalDate,
  schedule: Exclude<TaskSchedule, { kind: "none" }>,
  recurring: boolean,
): Occurrence {
  return {
    taskId: task.id,
    originalDate,
    title: task.title,
    schedule,
    status: task.status,
    recurring,
  };
}

function overlaps(s: Exclude<TaskSchedule, { kind: "none" }>, w: Window): boolean {
  const [a, b] = scheduleSpan(s);
  return a <= w.to && b >= w.from;
}
