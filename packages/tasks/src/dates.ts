import { fromJdn, toJdn, weekdayOfJdn, type Jdn, type Weekday } from "@dotlife/calendar-core";

import type { LocalDate, LocalDateTime, LocalTime, TaskPoint } from "./models";

/** Local-date helpers on top of calendar-core. Everything is string in, string out — no `Date`. */

export function parseLocalDate(d: LocalDate): { year: number; month: number; day: number } {
  const [year, month, day] = d.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateToJdn(d: LocalDate): Jdn {
  return toJdn({ calendar: "gregorian", ...parseLocalDate(d) });
}

export function jdnToDate(jdn: Jdn): LocalDate {
  const g = fromJdn(jdn, "gregorian");
  return formatLocalDate(g.year, g.month, g.day);
}

export function addDays(d: LocalDate, days: number): LocalDate {
  return jdnToDate(dateToJdn(d) + days);
}

export function weekdayOf(d: LocalDate): Weekday {
  return weekdayOfJdn(dateToJdn(d));
}

export function timeToMinutes(t: LocalTime): number {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function minutesToTime(minutes: number): LocalTime {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes since an arbitrary epoch — total order over local date-times. All-day points count as 00:00. */
export function pointKey(p: TaskPoint): number {
  return dateToJdn(p.date) * 1440 + (p.time === undefined ? 0 : timeToMinutes(p.time));
}

/** Same as {@link pointKey} but an all-day point counts as the *end* of its day (23:59) — for deadlines. */
export function pointEndKey(p: TaskPoint): number {
  return dateToJdn(p.date) * 1440 + (p.time === undefined ? 1439 : timeToMinutes(p.time));
}

export function nowKey(now: LocalDateTime): number {
  return dateToJdn(now.date) * 1440 + timeToMinutes(now.time);
}

/** Shift a point by whole days, keeping its time. */
export function shiftPoint(p: TaskPoint, days: number): TaskPoint {
  return p.time === undefined
    ? { date: addDays(p.date, days) }
    : { date: addDays(p.date, days), time: p.time };
}

/** Add minutes to a point that has a time (crossing midnight moves the date). */
export function addMinutes(p: LocalDateTime, minutes: number): LocalDateTime {
  const total = timeToMinutes(p.time) + minutes;
  const dayShift = Math.floor(total / 1440);
  return { date: addDays(p.date, dayShift), time: minutesToTime(total - dayShift * 1440) };
}

/**
 * The wall-clock "now" in an IANA time zone — the only place this package looks at a real instant.
 * Day boundaries therefore follow the task's own zone, which is what makes DST and travel behave (PLAN §15).
 */
export function localNow(timeZone: string, instant: Date = new Date()): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}
