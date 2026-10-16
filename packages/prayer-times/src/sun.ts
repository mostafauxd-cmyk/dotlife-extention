/**
 * Low-precision solar position (NOAA / US Naval Observatory approximation), accurate to well under a minute
 * for prayer-time purposes. Angles in degrees, times in hours.
 */

const RAD = Math.PI / 180;

export const sin = (d: number): number => Math.sin(d * RAD);
export const cos = (d: number): number => Math.cos(d * RAD);
export const tan = (d: number): number => Math.tan(d * RAD);
export const asin = (x: number): number => Math.asin(x) / RAD;
export const acos = (x: number): number => Math.acos(x) / RAD;
export const atan2 = (y: number, x: number): number => Math.atan2(y, x) / RAD;
export const acot = (x: number): number => Math.atan(1 / x) / RAD;

/** Normalise an angle to [0, 360). */
export function fixAngle(a: number): number {
  a -= 360 * Math.floor(a / 360);
  return a < 0 ? a + 360 : a;
}

/** Normalise hours to [0, 24). */
export function fixHour(h: number): number {
  h -= 24 * Math.floor(h / 24);
  return h < 0 ? h + 24 : h;
}

/** Julian Date (with fraction) of the Gregorian civil date at 0h UT. */
export function julianDate(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

export type SunPosition = {
  /** Solar declination in degrees. */
  declination: number;
  /** Equation of time in hours (apparent − mean solar time). */
  equation: number;
};

export function sunPosition(jd: number): SunPosition {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = atan2(cos(e) * sin(l), cos(l)) / 15;
  const equation = q / 15 - fixHour(ra);
  const declination = asin(sin(e) * sin(l));
  return { declination, equation };
}
