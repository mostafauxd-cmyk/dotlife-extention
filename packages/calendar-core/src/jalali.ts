import { gregorianToJdn, jdnToGregorian } from "./gregorian";
import { tdiv as div, tmod as mod } from "./math";
import type { Jdn, Ymd } from "./types";

/**
 * Solar Hijri (Jalali) calendar ↔ JDN.
 *
 * Uses the astronomical-break algorithm by Kazimierz M. Borkowski ("The Persian calendar for 3000 years",
 * Earth, Moon and Planets 1996) as popularised by jalaali-js. It reproduces the official Iranian calendar
 * (which is defined by the true vernal equinox, not a fixed 33-year cycle) for years 1 … 3177.
 */

/** Years in which the 33-year cycle pattern shifts. */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const;

export const JALALI_MIN_YEAR = -61;
export const JALALI_MAX_YEAR = 3177;

type JalCal = {
  /** 0 when `year` is a leap year, otherwise 1–4 = years since the last leap year. */
  leap: number;
  /** Gregorian year containing 1 Farvardin of `year`. */
  gy: number;
  /** Day of March on which 1 Farvardin falls in that Gregorian year. */
  march: number;
};

function jalCal(jy: number): JalCal {
  assertYearInRange(jy);
  const gy = jy + 621;
  let leapJ = -14;
  let jp: number = BREAKS[0];
  let jump = 0;

  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

export function isJalaliLeapYear(year: number): boolean {
  return jalCal(year).leap === 0;
}

function assertYearInRange(year: number): void {
  if (year < JALALI_MIN_YEAR || year > JALALI_MAX_YEAR) {
    throw new RangeError(`Jalali year out of supported range: ${String(year)}`);
  }
}

export function jalaliDaysInMonth(year: number, month: number): number {
  assertYearInRange(year);
  if (month < 1 || month > 12) throw new RangeError(`Invalid Jalali month: ${String(month)}`);
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

export function jalaliToJdn({ year, month, day }: Ymd): Jdn {
  const r = jalCal(year);
  return (
    gregorianToJdn({ year: r.gy, month: 3, day: r.march }) +
    (month - 1) * 31 -
    div(month, 7) * (month - 7) +
    day -
    1
  );
}

export function jdnToJalali(jdn: Jdn): Ymd {
  const gy = jdnToGregorian(jdn).year;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = gregorianToJdn({ year: gy, month: 3, day: r.march });
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}
