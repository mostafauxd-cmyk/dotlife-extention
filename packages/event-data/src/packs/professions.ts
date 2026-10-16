import type { CalendarEvent, PackId, Provenance } from "../types";

/**
 * روزهای مشاغل — غیرتعطیل (بسته‌ی اختیاری).
 * فقط روزهایی که دست‌کم دو منبع روی تاریخشان هم‌نظرند: تقویم رسمی کشور (time.ir)، متن تقویم رسمی
 * مصوب و تقویم bahesab.ir. روزهایی که فقط یک منبع داشت (مثل روز آرایشگر، روز قناد) عمداً نیامده‌اند.
 * روزهای پزشکی با `alsoIn: ["health"]` در «تقویم سلامت» هم دیده می‌شوند؛ روزهایی که پیش‌تر در
 * بسته‌ی ملی بودند با `alsoIn: ["national"]` همان‌جا هم می‌مانند.
 */
const SRC: Provenance = {
  source: "تقویم رسمی کشور (time.ir) و تقویم bahesab.ir، تطبیق‌داده‌شده",
  url: "https://www.time.ir/event-year",
  retrievedAt: "2026-10-08",
};

const s = (
  id: string,
  title: string,
  month: number,
  day: number,
  alsoIn?: readonly PackId[],
): CalendarEvent => ({
  id,
  pack: "professions",
  title,
  holiday: false,
  rule: { kind: "fixed", calendar: "solar-hijri", month, day },
  ...(alsoIn ? { alsoIn } : {}),
  provenance: SRC,
});

export const PROFESSION_EVENTS: readonly CalendarEvent[] = [
  s("dentists-day", "روز دندان‌پزشک", 1, 23, ["health"]),
  s("lab-sciences-day", "روز علوم آزمایشگاهی", 1, 30, ["health"]),
  s("architecture-day", "روز معماری و روز ملی کارآفرینی", 2, 3),
  s("psychologists-day", "روز روان‌شناس و مشاور", 2, 9, ["health"]),
  s("teachers-day", "روز معلم", 2, 12, ["national"]),
  s("public-relations-day", "روز ارتباطات و روابط عمومی", 2, 27),
  s("guilds-day", "روز اصناف", 4, 1),
  s("industry-mining-day", "روز صنعت و معدن", 4, 10),
  s("pen-day", "روز قلم", 4, 14),
  s("tax-day", "روز مالیات", 4, 16),
  s("social-security-day", "روز بهزیستی و تأمین اجتماعی", 4, 25),
  s("journalists-day", "روز خبرنگار", 5, 17, ["national"]),
  s("physicians-day", "روز پزشک", 6, 1, ["health"]),
  s("employees-day", "روز کارمند", 6, 4),
  s("pharmacy-day", "روز داروسازی", 6, 5, ["national", "health"]),
  s("printing-day", "روز صنعت چاپ", 6, 11),
  s("health-workers-day", "روز بهورز", 6, 12, ["health"]),
  s("cooperatives-day", "روز تعاون", 6, 13),
  s("firefighters-day", "روز آتش‌نشانی و ایمنی", 7, 7),
  s("police-day", "روز نیروی انتظامی", 7, 13),
  s("veterinary-day", "روز دامپزشکی", 7, 14, ["national"]),
  s("statistics-day", "روز آمار و برنامه‌ریزی", 8, 1),
  s("rangers-day", "روز محیط‌بان", 8, 8),
  s("librarians-day", "روز کتاب، کتاب‌خوانی و کتابدار", 8, 24),
  s("insurance-day", "روز بیمه", 9, 13),
  s("accountants-day", "روز حسابدار", 9, 15),
  s("engineers-day", "روز مهندس", 12, 5, ["national"]),
  s("lawyers-day", "روز وکیل مدافع", 12, 7),
  {
    id: "customs-day",
    pack: "professions",
    title: "روز جهانی گمرک",
    holiday: false,
    rule: { kind: "fixed", calendar: "gregorian", month: 1, day: 26 },
    provenance: SRC,
  },
  {
    // 5 Jumada al-Ula, the birth of Lady Zaynab
    id: "nurses-day",
    pack: "professions",
    title: "روز پرستار",
    holiday: false,
    rule: { kind: "fixed", calendar: "hijri", month: 5, day: 5 },
    alsoIn: ["national", "health"],
    provenance: SRC,
  },
];
