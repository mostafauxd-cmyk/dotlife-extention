/**
 * The words an ad is aimed by. A client must send the same ids in `AdContext`, and the admin panel
 * offers only these for the closed sets (persona, season); city, occasion, topic and keyword are
 * open, with suggestions.
 */

/** The new tab's personas (apps/newtab/src/personas.ts), with the quick-access folder each gets. */
export const AD_PERSONAS = [
  { id: "designer", name: "طراح", folder: "طراحی" },
  { id: "dev", name: "برنامه‌نویس", folder: "برنامه‌نویسی" },
  { id: "acc", name: "حسابدار", folder: "حسابداری" },
  { id: "student", name: "دانشجو", folder: "دانشگاه" },
  { id: "seller", name: "فروشنده‌ی آنلاین", folder: "فروش" },
  { id: "manager", name: "مدیر و کارمند", folder: "کار" },
] as const;

export const AD_SEASONS = [
  { id: "spring", name: "بهار" },
  { id: "summer", name: "تابستان" },
  { id: "autumn", name: "پاییز" },
  { id: "winter", name: "زمستان" },
] as const;

/** Suggestions only: a city is whatever name the client sends. */
export const AD_CITIES = [
  "تهران",
  "مشهد",
  "اصفهان",
  "شیراز",
  "تبریز",
  "کرج",
  "اهواز",
  "قم",
  "رشت",
  "کیش",
] as const;

/** Suggestions only: the news categories and followed topics. */
export const AD_TOPICS = ["سفر", "اقتصاد", "فناوری", "ورزش", "فرهنگ", "سلامت", "خودرو"] as const;
