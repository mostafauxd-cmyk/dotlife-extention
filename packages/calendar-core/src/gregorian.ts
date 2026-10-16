import { tdiv as div, tmod as mod } from "./math";
import type { Jdn, Ymd } from "./types";

/**
 * Proleptic Gregorian calendar ↔ JDN.
 * Integer-only algorithm (Fliegel & Van Flandern form as used by jalaali-js); valid for all years we care about.
 */

export function gregorianToJdn({ year, month, day }: Ymd): Jdn {
  let d =
    div((year + div(month - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(month + 9, 12) + 2, 5) +
    day -
    34840408;
  d = d - div(div(year + 100100 + div(month - 8, 6), 100) * 3, 4) + 752;
  return d;
}

export function jdnToGregorian(jdn: Jdn): Ymd {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);
  return { year, month, day };
}

export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function gregorianDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isGregorianLeapYear(year) ? 29 : 28;
    default:
      throw new RangeError(`Invalid Gregorian month: ${String(month)}`);
  }
}
