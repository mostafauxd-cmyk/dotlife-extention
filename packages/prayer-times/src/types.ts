export type PrayerName =
  "imsak" | "fajr" | "sunrise" | "dhuhr" | "asr" | "sunset" | "maghrib" | "isha" | "midnight";

/** Calculation methods — each is just a parameter set (PLAN §14). Default for Iran: `tehran`. */
export type PrayerCalcMethod =
  "tehran" | "jafari" | "mwl" | "isna" | "egypt" | "makkah" | "karachi" | "custom";

/** Angle below the horizon in degrees, or minutes after/before the anchor time. */
export type AngleOrMinutes = { angle: number } | { minutes: number };

export type MethodParams = {
  /** Fajr: sun angle below horizon. */
  fajr: number;
  /** Isha: angle, or minutes after maghrib. */
  isha: AngleOrMinutes;
  /** Maghrib: angle, or minutes after sunset. */
  maghrib: AngleOrMinutes;
  /** Islamic midnight: half-way from sunset to sunrise (`standard`) or to fajr (`jafari`). */
  midnight: "standard" | "jafari";
};

export type HighLatitudeRule = "none" | "night-middle" | "one-seventh" | "angle-based";

export type PrayerSettings = {
  method: PrayerCalcMethod;
  /** Only read when `method === "custom"`. */
  custom?: Partial<MethodParams>;
  /** Asr shadow factor: `standard` (Shafi'i/Maliki/Hanbali/Ja'fari) = 1, `hanafi` = 2. */
  asrJuristic: "standard" | "hanafi";
  highLatitudeRule: HighLatitudeRule;
  /** Imsak offset before fajr, in minutes. */
  imsakMinutes: number;
  /** Per-prayer manual adjustment in minutes (e.g. a city's local custom). */
  adjustmentsMinutes: Partial<Record<PrayerName, number>>;
};

export type Location = {
  latitude: number;
  longitude: number;
  /** Metres above sea level; affects sunrise/sunset slightly. */
  elevation?: number;
};

/** Civil date (Gregorian) in the location's local time zone. */
export type CivilDate = { year: number; month: number; day: number };

/** Times as minutes after local midnight; `null` when the sun never reaches the angle (polar regions, no high-lat rule). */
export type PrayerTimes = Record<PrayerName, number | null>;

export const DEFAULT_SETTINGS: PrayerSettings = {
  method: "tehran",
  asrJuristic: "standard",
  highLatitudeRule: "night-middle",
  imsakMinutes: 10,
  adjustmentsMinutes: {},
};

export const PRAYER_NAMES_FA: Readonly<Record<PrayerName, string>> = {
  imsak: "امساک",
  fajr: "اذان صبح",
  sunrise: "طلوع آفتاب",
  dhuhr: "اذان ظهر",
  asr: "عصر",
  sunset: "غروب آفتاب",
  maghrib: "اذان مغرب",
  isha: "عشاء",
  midnight: "نیمه‌شب شرعی",
};

export const METHOD_NAMES_FA: Readonly<Record<PrayerCalcMethod, string>> = {
  tehran: "مؤسسه ژئوفیزیک دانشگاه تهران",
  jafari: "حوزه علمیه قم (جعفری)",
  mwl: "رابطة العالم الاسلامی",
  isna: "انجمن اسلامی آمریکای شمالی (ISNA)",
  egypt: "هیئت مساحی مصر",
  makkah: "ام‌القری (مکه)",
  karachi: "دانشگاه علوم اسلامی کراچی",
  custom: "دلخواه",
};
