import { assertNever } from "@dotlife/shared";

import { methodParams } from "./methods";
import { acos, acot, cos, fixHour, julianDate, sin, sunPosition, tan } from "./sun";
import type {
  CivilDate,
  HighLatitudeRule,
  Location,
  PrayerName,
  PrayerSettings,
  PrayerTimes,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

/**
 * Prayer-time computation following the PrayTimes.org algorithm (Hamid Zarrabi-Zadeh), which every major
 * authority's published tables — including Tehran's Institute of Geophysics — agree with to the minute.
 * All intermediate times are in hours; the public result is in minutes after local midnight.
 */

export type ComputeInput = {
  date: CivilDate;
  location: Location;
  /** Local UTC offset in hours (Iran: +3.5, no DST since 1401). */
  utcOffsetHours: number;
  settings?: Partial<PrayerSettings>;
};

type Hours = Record<PrayerName, number>;

const SUN_ANGLE_RISE_SET = 0.833;

export function computePrayerTimes(input: ComputeInput): PrayerTimes {
  const settings: PrayerSettings = { ...DEFAULT_SETTINGS, ...input.settings };
  const params = methodParams(settings);
  const { latitude: lat, longitude: lng, elevation = 0 } = input.location;
  const { year, month, day } = input.date;

  // Julian date of local midnight, shifted so that "time" fractions are local solar-ish
  const jDate = julianDate(year, month, day) - lng / (15 * 24);

  const midDay = (time: number): number => {
    const eqt = sunPosition(jDate + time).equation;
    return fixHour(12 - eqt);
  };

  /** Time when the sun is `angle` degrees below the horizon; `ccw` = before noon. */
  const sunAngleTime = (angle: number, time: number, ccw = false): number => {
    const decl = sunPosition(jDate + time).declination;
    const noon = midDay(time);
    const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (x < -1 || x > 1) return Number.NaN; // the sun never reaches that angle today
    const t = acos(x) / 15;
    return noon + (ccw ? -t : t);
  };

  const asrTime = (factor: number, time: number): number => {
    const decl = sunPosition(jDate + time).declination;
    const angle = -acot(factor + tan(Math.abs(lat - decl)));
    return sunAngleTime(angle, time);
  };

  const riseSetAngle = SUN_ANGLE_RISE_SET + 0.0347 * Math.sqrt(Math.max(0, elevation));
  const asrFactor = settings.asrJuristic === "hanafi" ? 2 : 1;

  // initial estimates (hours), then one refinement pass as in PrayTimes
  let t: Hours = {
    imsak: 5,
    fajr: 5,
    sunrise: 6,
    dhuhr: 12,
    asr: 13,
    sunset: 18,
    maghrib: 18,
    isha: 18,
    midnight: 0,
  };
  const portion = (h: Hours): Hours => {
    const out = { ...h };
    for (const k of Object.keys(out) as PrayerName[]) out[k] = out[k] / 24;
    return out;
  };

  const pass = (prev: Hours): Hours => {
    const p = portion(prev);
    const maghribAngle = "angle" in params.maghrib ? params.maghrib.angle : 0;
    const ishaAngle = "angle" in params.isha ? params.isha.angle : 0;
    return {
      imsak: sunAngleTime(params.fajr, p.imsak, true),
      fajr: sunAngleTime(params.fajr, p.fajr, true),
      sunrise: sunAngleTime(riseSetAngle, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(asrFactor, p.asr),
      sunset: sunAngleTime(riseSetAngle, p.sunset),
      maghrib: sunAngleTime(maghribAngle, p.maghrib),
      isha: sunAngleTime(ishaAngle, p.isha),
      midnight: 0,
    };
  };
  t = pass(t);

  // local time zone
  const tzShift = input.utcOffsetHours - lng / 15;
  for (const k of Object.keys(t) as PrayerName[]) t[k] += tzShift;

  // minute-based definitions
  if ("minutes" in params.maghrib) t.maghrib = t.sunset + params.maghrib.minutes / 60;
  if ("minutes" in params.isha) t.isha = t.maghrib + params.isha.minutes / 60;

  // high latitudes
  t = adjustHighLatitudes(t, settings.highLatitudeRule, params);
  t.imsak = t.fajr - settings.imsakMinutes / 60;

  // midnight
  const nightEnd = params.midnight === "jafari" ? t.fajr : t.sunrise;
  t.midnight = t.sunset + timeDiff(t.sunset, nightEnd) / 2;

  // manual adjustments + convert to minutes
  const out = {} as PrayerTimes;
  for (const k of Object.keys(t) as PrayerName[]) {
    const adj = settings.adjustmentsMinutes[k] ?? 0;
    const h = t[k];
    out[k] = Number.isNaN(h) ? null : Math.round(fixHour(h + adj / 60) * 60);
  }
  return out;
}

/** Hours from `a` to `b`, forward in time (wraps past midnight). */
function timeDiff(a: number, b: number): number {
  return fixHour(b - a);
}

function adjustHighLatitudes(
  t: Hours,
  rule: HighLatitudeRule,
  params: ReturnType<typeof methodParams>,
): Hours {
  if (rule === "none") return t;
  const night = timeDiff(t.sunset, t.sunrise);
  const portionOf = (angle: number): number => {
    switch (rule) {
      case "angle-based":
        return (angle / 60) * night;
      case "one-seventh":
        return night / 7;
      case "night-middle":
        return night / 2;
      default:
        return assertNever(rule);
    }
  };
  const adjust = (time: number, base: number, angle: number, ccw: boolean): number => {
    const p = portionOf(angle);
    const diff = ccw ? timeDiff(time, base) : timeDiff(base, time);
    if (Number.isNaN(time) || diff > p) return ccw ? base - p : base + p;
    return time;
  };
  const ishaAngle = "angle" in params.isha ? params.isha.angle : 0;
  const maghribAngle = "angle" in params.maghrib ? params.maghrib.angle : 0;
  return {
    ...t,
    fajr: adjust(t.fajr, t.sunrise, params.fajr, true),
    isha: ishaAngle > 0 ? adjust(t.isha, t.sunset, ishaAngle, false) : t.isha,
    maghrib: maghribAngle > 0 ? adjust(t.maghrib, t.sunset, maghribAngle, false) : t.maghrib,
  };
}
