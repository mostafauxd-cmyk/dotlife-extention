import { div, mod } from "./math";
import type { Jdn, Ymd } from "./types";

/**
 * Islamic (Hijri) calendar ↔ JDN — the **tabular / arithmetic** calendar
 * (Calendrical Calculations, "civil" variant, 30-year cycle with leap years 2,5,7,10,13,16,18,21,24,26,29).
 *
 * Iran's official Hijri dates are set by moon sighting and can differ from this by ±1 day in some months.
 * The event-data step adds a per-month correction table on top of this; this module stays purely arithmetic.
 */

/** JDN of 1 Muharram 1 AH (Friday 16 July 622 Julian). */
export const ISLAMIC_EPOCH: Jdn = 1948440;

export function isIslamicLeapYear(year: number): boolean {
  return mod(14 + 11 * year, 30) < 11;
}

export function islamicDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new RangeError(`Invalid Hijri month: ${String(month)}`);
  if (month === 12) return isIslamicLeapYear(year) ? 30 : 29;
  return month % 2 === 1 ? 30 : 29;
}

export function islamicToJdn({ year, month, day }: Ymd): Jdn {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    div(3 + 11 * year, 30) +
    ISLAMIC_EPOCH -
    1
  );
}

export function jdnToIslamic(jdn: Jdn): Ymd {
  const year = div(30 * (jdn - ISLAMIC_EPOCH) + 10646, 10631);
  const priorDays = jdn - islamicToJdn({ year, month: 1, day: 1 });
  const month = Math.min(12, Math.ceil((priorDays - 29) / 29.5) + 1);
  const day = jdn - islamicToJdn({ year, month, day: 1 }) + 1;
  return { year, month, day };
}
