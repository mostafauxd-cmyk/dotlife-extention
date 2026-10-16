import type { CalendarEvent, Provenance } from "../types";

/**
 * رویدادهای نجومی — بسته‌ی اختیاری.
 * نسخه‌ی اول فقط اعتدال‌ها و انقلاب‌ها را دارد که در تقویم خورشیدی ایران دقیقاً اولِ فصل‌ها هستند
 * (تقویم بر پایه‌ی لحظه‌ی واقعی اعتدال بهاری تنظیم می‌شود). ماه‌گرفتگی/خورگرفتگی بعداً با جدول سالانه اضافه می‌شود.
 */
const SRC: Provenance = {
  source: "تعریف تقویم هجری خورشیدی: آغاز هر فصل با اعتدال/انقلاب",
  retrievedAt: "2026-10-04",
};

const s = (id: string, title: string, month: number, day: number): CalendarEvent => ({
  id,
  pack: "astronomy",
  title,
  holiday: false,
  rule: { kind: "fixed", calendar: "solar-hijri", month, day },
  provenance: SRC,
});

export const ASTRONOMY_EVENTS: readonly CalendarEvent[] = [
  s("vernal-equinox", "اعتدال بهاری — آغاز بهار", 1, 1),
  s("summer-solstice", "انقلاب تابستانی — بلندترین روز سال", 4, 1),
  s("autumnal-equinox", "اعتدال پاییزی — آغاز پاییز", 7, 1),
  s("winter-solstice", "انقلاب زمستانی — بلندترین شب سال", 10, 1),
];
