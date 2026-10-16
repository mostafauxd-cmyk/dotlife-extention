import type { CalendarEvent, PackId, Provenance } from "../types";

/**
 * تقویم سلامت — روزهای جهانی سلامت (سازمان جهانی بهداشت) و روزهای ملی سلامت، غیرتعطیل (بسته‌ی اختیاری).
 * روز پزشک، داروسازی، پرستار، بهورز و علوم آزمایشگاهی در `professions.ts` هستند و با `alsoIn` اینجا
 * هم دیده می‌شوند؛ روز جهانی بهداشت و روز جهانی غذا در `international.ts`.
 * روزهایی که هر سال جابه‌جا می‌شوند (هفته‌ی سلامت، روز جهانی کلیه، روز جهانی بینایی) فعلاً نیامده‌اند.
 */
const WHO: Provenance = {
  source: "WHO / UN health days, checked against the Iranian Ministry of Health calendar",
  url: "https://www.who.int/campaigns",
  retrievedAt: "2026-10-08",
};

const IR: Provenance = {
  source: "تقویم رسمی کشور و تقویم مناسبت‌های بهداشتی دانشگاه علوم پزشکی اراک",
  url: "https://arakmu.ac.ir/vch/fa/calendar/all/5/",
  retrievedAt: "2026-10-08",
};

const g = (
  id: string,
  title: string,
  month: number,
  day: number,
  alsoIn?: readonly PackId[],
): CalendarEvent => ({
  id,
  pack: "health",
  title,
  holiday: false,
  rule: { kind: "fixed", calendar: "gregorian", month, day },
  ...(alsoIn ? { alsoIn } : {}),
  provenance: WHO,
});

export const HEALTH_EVENTS: readonly CalendarEvent[] = [
  g("world-cancer-day", "روز جهانی سرطان", 2, 4),
  g("world-hearing-day", "روز جهانی شنوایی", 3, 3),
  g("world-oral-health-day", "روز جهانی سلامت دهان و دندان", 3, 20),
  g("world-tb-day", "روز جهانی مبارزه با سل", 3, 24),
  g("world-autism-day", "روز جهانی آگاهی از اوتیسم", 4, 2),
  g("world-hemophilia-day", "روز جهانی هموفیلی", 4, 17),
  g("world-malaria-day", "روز جهانی مالاریا", 4, 25),
  g("world-midwives-day", "روز جهانی ماما", 5, 5, ["professions"]),
  g("red-crescent-day", "روز جهانی صلیب سرخ و هلال احمر", 5, 8),
  g("intl-nurses-day", "روز جهانی پرستار", 5, 12, ["professions"]),
  g("world-thalassaemia-day", "روز جهانی تالاسمی", 5, 8),
  g("world-hypertension-day", "روز جهانی فشار خون", 5, 17),
  g("world-no-tobacco-day", "روز جهانی بدون دخانیات", 5, 31),
  g("world-food-safety-day", "روز جهانی ایمنی غذا", 6, 7),
  g("world-blood-donor-day", "روز جهانی اهدای خون", 6, 14),
  g("anti-drug-day", "روز جهانی مبارزه با مواد مخدر", 6, 26),
  g("world-hepatitis-day", "روز جهانی هپاتیت", 7, 28),
  g("breastfeeding-week", "آغاز هفته‌ی جهانی تغذیه با شیر مادر", 8, 1),
  g("suicide-prevention-day", "روز جهانی پیشگیری از خودکشی", 9, 10),
  g("patient-safety-day", "روز جهانی ایمنی بیمار", 9, 17),
  g("world-alzheimers-day", "روز جهانی آلزایمر", 9, 21),
  g("world-heart-day", "روز جهانی قلب", 9, 29),
  g("older-persons-day", "روز جهانی سالمندان", 10, 1),
  g("world-mental-health-day", "روز جهانی سلامت روان", 10, 10),
  g("handwashing-day", "روز جهانی شستن دست‌ها", 10, 15),
  g("white-cane-day", "روز جهانی عصای سفید (نابینایان)", 10, 15),
  g("world-osteoporosis-day", "روز جهانی پوکی استخوان", 10, 20),
  g("world-stroke-day", "روز جهانی سکته‌ی مغزی", 10, 29),
  g("world-diabetes-day", "روز جهانی دیابت", 11, 14),
  g("world-aids-day", "روز جهانی ایدز", 12, 1),
  g("disability-day", "روز جهانی افراد دارای معلولیت", 12, 3),
  g("uhc-day", "روز جهانی پوشش همگانی سلامت", 12, 12),
  {
    id: "blood-donation-day-ir",
    pack: "health",
    title: "روز ملی اهدای خون",
    holiday: false,
    rule: { kind: "fixed", calendar: "solar-hijri", month: 5, day: 9 },
    provenance: IR,
  },
];
