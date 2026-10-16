import { fromJdn, monthName, WEEKDAY_NAMES_FA, weekdayOfJdn } from "@dotlife/calendar-core";
import {
  occurrencesOn,
  packFileOf,
  registerPackFile,
  type Occurrence,
  type PackId,
} from "@dotlife/event-data";
import { ALL_EVENTS } from "@dotlife/event-data/all";
import {
  computePrayerTimes,
  formatMinutes,
  IRAN_UTC_OFFSET_HOURS,
  nextPrayer,
  PRAYER_NAMES_FA,
} from "@dotlife/prayer-times";
import { dateToJdn, localNow, parseLocalDate } from "@dotlife/tasks";

import { TIME_ZONE } from "./noghte/model";
import { fa } from "./ui/fa";

/**
 * «امروز»: the Solar Hijri date, the day's occasions and the next prayer time, all worked out here
 * from the app's own packages — nothing is asked of a server.
 */

/** Occasion packs shown by default, as in the app. */
const PACKS: readonly PackId[] = [
  "official-holidays",
  "religious",
  "national",
  "persian-cultural",
  "international",
];

let registered = false;
function ensurePacks(): void {
  if (registered) return;
  registered = true;
  for (const pack of PACKS) {
    registerPackFile(
      packFileOf(
        pack,
        ALL_EVENTS.filter((e) => e.pack === pack),
      ),
    );
  }
}

/** Tehran until the person picks a city (a later step). */
const PLACE = { name: "تهران", latitude: 35.6892, longitude: 51.389 };

/** The occasions of a day (the packs shown by default). */
export function occasionsOn(jdn: number): Occurrence[] {
  ensurePacks();
  return occurrencesOn(jdn, { packs: PACKS });
}

export type Today = {
  weekday: string;
  /** «۲۴ مهر ۱۴۰۵» */
  solar: string;
  dayMonth: string;
  gregorian: string;
  hijri: string;
  occasions: Occurrence[];
  holiday: boolean;
  next: { name: string; time: string; inMinutes: number } | null;
  place: string;
};

export function todayInfo(now: Date = new Date()): Today {
  ensurePacks();
  const local = localNow(TIME_ZONE, now);
  const jdn = dateToJdn(local.date);
  const solar = fromJdn(jdn, "solar-hijri");
  const greg = fromJdn(jdn, "gregorian");
  const hijri = fromJdn(jdn, "hijri");
  const occasions = occurrencesOn(jdn, { packs: PACKS });
  const g = parseLocalDate(local.date);
  const times = computePrayerTimes({
    date: g,
    location: { latitude: PLACE.latitude, longitude: PLACE.longitude },
    utcOffsetHours: IRAN_UTC_OFFSET_HOURS,
  });
  const [h, m] = local.time.split(":").map(Number) as [number, number];
  const next = nextPrayer(times, h * 60 + m, ["fajr", "sunrise", "dhuhr", "maghrib", "midnight"]);
  return {
    weekday: WEEKDAY_NAMES_FA[weekdayOfJdn(jdn)] ?? "",
    solar: fa(`${String(solar.day)} ${monthName(solar)} ${String(solar.year)}`),
    dayMonth: fa(`${String(solar.day)} ${monthName(solar)}`),
    gregorian: fa(`${String(greg.day)} ${monthName(greg)} ${String(greg.year)}`),
    hijri: fa(`${String(hijri.day)} ${monthName(hijri)} ${String(hijri.year)}`),
    occasions,
    holiday: occasions.some((o) => o.event.holiday),
    next:
      next === null
        ? null
        : {
            name: PRAYER_NAMES_FA[next.name],
            time: fa(formatMinutes(next.minutes)),
            inMinutes: next.remainingMinutes,
          },
    place: PLACE.name,
  };
}
