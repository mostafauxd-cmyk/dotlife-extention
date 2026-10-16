import type { CalendarEvent, Provenance } from "../types";

/**
 * جشن‌ها و آیین‌های ایرانی / ایران باستان — بسته‌ی اختیاری، جدا از تعطیلات رسمی (PLAN §117).
 * تاریخ‌ها طبق رواج امروزی در تقویم خورشیدی (نه شمارش سی‌روزه‌ی باستانی).
 */
const SRC: Provenance = {
  source: "رواج عمومی در تقویم‌های ایرانی (time.ir، تقویم‌های رسمی و فرهنگی)",
  url: "https://www.time.ir/",
  retrievedAt: "2026-10-11",
};

const s = (
  id: string,
  title: string,
  month: number,
  day: number,
  description?: string,
): CalendarEvent => ({
  id,
  pack: "persian-cultural",
  title,
  holiday: false,
  rule: { kind: "fixed", calendar: "solar-hijri", month, day },
  ...(description === undefined ? {} : { description }),
  provenance: SRC,
});

export const PERSIAN_CULTURAL_EVENTS: readonly CalendarEvent[] = [
  {
    id: "chaharshanbe-suri",
    pack: "persian-cultural",
    title: "چهارشنبه‌سوری",
    holiday: false,
    rule: {
      kind: "last-weekday-of-month",
      calendar: "solar-hijri",
      month: 12,
      weekday: 4,
      offsetDays: -1,
    },
    description: "شبِ پیش از آخرین چهارشنبه‌ی سال (غروب سه‌شنبه).",
    provenance: SRC,
  },
  s("nowruz-festival", "جشن نوروز", 1, 1),
  s("omid-day", "روز امید و شادباش‌نویسی؛ زادروز اشو زرتشت", 1, 6),
  s("abangah", "جشن آبانگاه", 1, 10),
  s("sizdah-bedar", "سیزده‌به‌در", 1, 13),
  s("soroushgan", "جشن سروشگان", 1, 17),
  s("farvardingan", "جشن فروردینگان", 1, 19),
  s("giahavari", "جشن گیاه‌آوری", 2, 2),
  s("nowruz-fortieth", "جشن چهلم نوروز", 2, 10),
  s("mid-spring", "جشن میانه‌ی بهار (بهاربد)", 2, 15),
  s("khordadgan", "جشن خردادگان", 3, 6),
  s("abpashunak", "جشن آب‌پاشونک، آغاز تابستان", 4, 1),
  s("tirgan", "جشن تیرگان", 4, 13),
  s("amordadgan", "جشن اَمردادگان", 5, 7),
  s("chelleh-tabestan", "جشن چله‌ی تابستان", 5, 10),
  s("shahrivargan", "جشن شهریورگان", 6, 4),
  s("mehregan", "جشن مهرگان", 7, 10, "در شمارش باستانی، روزِ مهر از ماهِ مهر (۱۶ مهر) است."),
  s("abangan", "جشن آبانگان", 8, 10),
  s("mid-autumn", "جشن میانه‌ی پاییز", 8, 15),
  s("azar-jashn", "آذرجشن", 9, 1),
  s("azargan", "جشن آذرگان", 9, 9),
  s("yalda", "شب یلدا (شب چله)", 9, 30),
  s("khorram-ruz", "جشن خرم‌روز، نخستین جشن دیگان (میلاد خورشید)", 10, 1),
  s("zoroaster-death", "سالروز درگذشت اشو زرتشت", 10, 5),
  s("dey-be-azar", "دی‌به‌آذر روز، دومین جشن دیگان", 10, 8),
  s("dey-be-mehr", "دی‌به‌مهر روز، سومین جشن دیگان", 10, 15),
  s("dey-be-din", "دی‌به‌دین روز، چهارمین جشن دیگان", 10, 23),
  s("bahmangan", "جشن بهمنگان", 11, 2),
  s("sadeh", "جشن سده", 11, 10),
  s("mid-winter", "جشن میانه‌ی زمستان", 11, 15),
  s("sepandarmazgan", "سپندارمذگان — روز عشق ایرانی", 12, 5),
];
