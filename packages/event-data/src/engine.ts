import { assertNever } from "@dotlife/shared";
import {
  daysInMonth,
  fromJdn,
  toJdn,
  weekdayOfJdn,
  type CalendarDate,
  type Jdn,
} from "@dotlife/calendar-core";

import { officialHijri, officialHijriDaysInMonth } from "./hijri-official";
import type { CalendarEvent, EventRule, Occurrence, PackId, RuleCalendar } from "./types";

/** All three calendar views of one day, computed once per day. */
type DayContext = {
  jdn: Jdn;
  solar: CalendarDate;
  gregorian: CalendarDate;
  hijri: CalendarDate;
  hijriMonthLength: number;
};

function contextOf(jdn: Jdn): DayContext {
  const hijri = officialHijri(jdn);
  return {
    jdn,
    solar: fromJdn(jdn, "solar-hijri"),
    gregorian: fromJdn(jdn, "gregorian"),
    hijri,
    hijriMonthLength: officialHijriDaysInMonth(hijri.year, hijri.month),
  };
}

function dateIn(ctx: DayContext, calendar: RuleCalendar): CalendarDate {
  switch (calendar) {
    case "solar-hijri":
      return ctx.solar;
    case "gregorian":
      return ctx.gregorian;
    case "hijri":
      return ctx.hijri;
    default:
      return assertNever(calendar);
  }
}

function monthLength(ctx: DayContext, calendar: RuleCalendar): number {
  if (calendar === "hijri") return ctx.hijriMonthLength;
  const d = dateIn(ctx, calendar);
  return daysInMonth(calendar, d.year, d.month);
}

function matches(rule: EventRule, ctx: DayContext): boolean {
  if (
    rule.kind === "last-weekday-of-month" &&
    rule.offsetDays !== undefined &&
    rule.offsetDays !== 0
  ) {
    // the anchor weekday is `offsetDays` away from the day we are looking at
    const { offsetDays, ...anchor } = rule;
    return matches(anchor, contextOf(ctx.jdn - offsetDays));
  }
  const d = dateIn(ctx, rule.calendar);
  if (d.month !== rule.month) return false;
  switch (rule.kind) {
    case "fixed": {
      if (d.day === rule.day) return true;
      if (rule.clampToMonthEnd === true) {
        const len = monthLength(ctx, rule.calendar);
        return rule.day > len && d.day === len;
      }
      return false;
    }
    case "last-weekday-of-month": {
      if (weekdayOfJdn(ctx.jdn) !== rule.weekday) return false;
      // last such weekday ⇔ a week later is already next month
      return d.day + 7 > monthLength(ctx, rule.calendar);
    }
    default:
      return assertNever(rule);
  }
}

export type EventQuery = {
  packs: readonly PackId[];
};

/** Occurrences of the selected packs between two JDNs (inclusive), in day order. */
export function occurrencesBetween(
  events: readonly CalendarEvent[],
  from: Jdn,
  to: Jdn,
  query: EventQuery,
): Occurrence[] {
  if (to < from) return [];
  const packs = new Set(query.packs);
  const active = events.filter(
    (e) => packs.has(e.pack) || (e.alsoIn?.some((p) => packs.has(p)) ?? false),
  );
  const out: Occurrence[] = [];
  for (let jdn = from; jdn <= to; jdn++) {
    const ctx = contextOf(jdn);
    for (const event of active) {
      if (matches(event.rule, ctx)) out.push({ event, jdn, date: ctx.solar });
    }
  }
  return out;
}

export function occurrencesOn(
  events: readonly CalendarEvent[],
  jdn: Jdn,
  query: EventQuery,
): Occurrence[] {
  return occurrencesBetween(events, jdn, jdn, query);
}

/** Occurrences inside one Solar Hijri month. */
export function occurrencesInSolarMonth(
  events: readonly CalendarEvent[],
  year: number,
  month: number,
  query: EventQuery,
): Occurrence[] {
  const from = toJdn({ calendar: "solar-hijri", year, month, day: 1 });
  const to = from + daysInMonth("solar-hijri", year, month) - 1;
  return occurrencesBetween(events, from, to, query);
}

/** Official public holiday (from the `official-holidays` pack). Fridays are handled separately — see {@link isWeekend}. */
export function isOfficialHoliday(events: readonly CalendarEvent[], jdn: Jdn): boolean {
  const ctx = contextOf(jdn);
  return events.some((e) => e.holiday && matches(e.rule, ctx));
}

/** Friday is the weekly day off in Iran. */
export function isWeekend(jdn: Jdn): boolean {
  return weekdayOfJdn(jdn) === 6;
}
