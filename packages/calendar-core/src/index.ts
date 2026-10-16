import { assertNever } from "@dotlife/shared";

import {
  gregorianDaysInMonth,
  gregorianToJdn,
  isGregorianLeapYear,
  jdnToGregorian,
} from "./gregorian";
import { islamicDaysInMonth, islamicToJdn, isIslamicLeapYear, jdnToIslamic } from "./islamic";
import { isJalaliLeapYear, jalaliDaysInMonth, jalaliToJdn, jdnToJalali } from "./jalali";
import { mod } from "./math";
import type { CalendarDate, CalendarSystem, Jdn, Weekday, Ymd } from "./types";

export type { CalendarDate, CalendarSystem, Jdn, Weekday, Ymd } from "./types";
export { JALALI_MAX_YEAR, JALALI_MIN_YEAR } from "./jalali";
export { ISLAMIC_EPOCH } from "./islamic";

/**
 * Shahanshahi (Imperial) calendar: identical to Solar Hijri in structure, year numbered from the
 * founding of the Achaemenid empire. Only the year label differs (PLAN §115).
 */
export const SHAHANSHAHI_YEAR_OFFSET = 1180;

export function toJdn(date: CalendarDate): Jdn {
  validate(date);
  switch (date.calendar) {
    case "solar-hijri":
      return jalaliToJdn(date);
    case "shahanshahi":
      return jalaliToJdn({ ...date, year: date.year - SHAHANSHAHI_YEAR_OFFSET });
    case "gregorian":
      return gregorianToJdn(date);
    case "hijri":
      return islamicToJdn(date);
    default:
      return assertNever(date.calendar);
  }
}

export function fromJdn(jdn: Jdn, calendar: CalendarSystem): CalendarDate {
  if (!Number.isInteger(jdn)) throw new RangeError(`JDN must be an integer: ${String(jdn)}`);
  switch (calendar) {
    case "solar-hijri":
      return { calendar, ...jdnToJalali(jdn) };
    case "shahanshahi": {
      const j = jdnToJalali(jdn);
      return { calendar, ...j, year: j.year + SHAHANSHAHI_YEAR_OFFSET };
    }
    case "gregorian":
      return { calendar, ...jdnToGregorian(jdn) };
    case "hijri":
      return { calendar, ...jdnToIslamic(jdn) };
    default:
      return assertNever(calendar);
  }
}

/** Convert a date from its calendar to another. Same calendar returns an equal (validated) date. */
export function convert(date: CalendarDate, to: CalendarSystem): CalendarDate {
  return fromJdn(toJdn(date), to);
}

export function isLeapYear(calendar: CalendarSystem, year: number): boolean {
  switch (calendar) {
    case "solar-hijri":
      return isJalaliLeapYear(year);
    case "shahanshahi":
      return isJalaliLeapYear(year - SHAHANSHAHI_YEAR_OFFSET);
    case "gregorian":
      return isGregorianLeapYear(year);
    case "hijri":
      return isIslamicLeapYear(year);
    default:
      return assertNever(calendar);
  }
}

export function daysInMonth(calendar: CalendarSystem, year: number, month: number): number {
  switch (calendar) {
    case "solar-hijri":
      return jalaliDaysInMonth(year, month);
    case "shahanshahi":
      return jalaliDaysInMonth(year - SHAHANSHAHI_YEAR_OFFSET, month);
    case "gregorian":
      return gregorianDaysInMonth(year, month);
    case "hijri":
      return islamicDaysInMonth(year, month);
    default:
      return assertNever(calendar);
  }
}

/** Day of week, Saturday = 0 … Friday = 6. */
export function weekdayOfJdn(jdn: Jdn): Weekday {
  // JDN 0 was a Monday; shift so that Saturday maps to 0.
  return mod(jdn + 2, 7) as Weekday;
}

export function weekday(date: CalendarDate): Weekday {
  return weekdayOfJdn(toJdn(date));
}

export function isValid(date: CalendarDate): boolean {
  try {
    validate(date);
    return true;
  } catch {
    return false;
  }
}

/** Throws a RangeError if the date does not exist in its calendar. */
export function validate(date: CalendarDate): void {
  const { calendar, year, month, day } = date;
  if (![year, month, day].every(Number.isInteger)) {
    throw new RangeError(`Date fields must be integers: ${JSON.stringify(date)}`);
  }
  if (month < 1 || month > 12)
    throw new RangeError(`Invalid month ${String(month)} in ${calendar}`);
  const dim = daysInMonth(calendar, year, month);
  if (day < 1 || day > dim) {
    throw new RangeError(
      `Invalid day ${String(day)} for ${calendar} ${String(year)}/${String(month)}`,
    );
  }
}

/** Add (or subtract) whole days, staying in the same calendar. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromJdn(toJdn(date) + days, date.calendar);
}

/** Signed number of days from `a` to `b` (positive when `b` is later). Calendars may differ. */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return toJdn(b) - toJdn(a);
}

export function compare(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  const d = daysBetween(a, b);
  return d < 0 ? 1 : d > 0 ? -1 : 0;
}

export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return toJdn(a) === toJdn(b);
}

/** Today in the given calendar, using the system local date (time zone handled by the host). */
export function today(calendar: CalendarSystem, now: Date = new Date()): CalendarDate {
  const g: Ymd = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  return fromJdn(gregorianToJdn(g), calendar);
}

/** Persian names, index = month - 1. */
export const MONTH_NAMES_FA: Readonly<Record<CalendarSystem, readonly string[]>> = {
  "solar-hijri": [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ],
  shahanshahi: [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ],
  gregorian: [
    "ژانویه",
    "فوریه",
    "مارس",
    "آوریل",
    "مه",
    "ژوئن",
    "ژوئیه",
    "اوت",
    "سپتامبر",
    "اکتبر",
    "نوامبر",
    "دسامبر",
  ],
  hijri: [
    "محرم",
    "صفر",
    "ربیع‌الاول",
    "ربیع‌الثانی",
    "جمادی‌الاول",
    "جمادی‌الثانی",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذی‌القعده",
    "ذی‌الحجه",
  ],
};

/** Persian weekday names, index = Weekday (Saturday first). */
export const WEEKDAY_NAMES_FA: readonly string[] = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

export function monthName(date: CalendarDate): string {
  return MONTH_NAMES_FA[date.calendar][date.month - 1] as string;
}
