import type { CalendarEvent, Provenance } from "../types";

/** مناسبت‌های مذهبی غیرتعطیل (بسته‌ی اختیاری). فقط وقتی نمایش داده می‌شود که کاربر بسته‌ی مذهبی را روشن کرده باشد. */
const SRC: Provenance = {
  source: "تقویم رسمی کشور (به نقل از time.ir)",
  url: "https://www.time.ir/",
  retrievedAt: "2026-10-11",
};

const h = (id: string, title: string, month: number, day: number): CalendarEvent => ({
  id,
  pack: "religious",
  title,
  holiday: false,
  rule: { kind: "fixed", calendar: "hijri", month, day },
  provenance: SRC,
});

export const RELIGIOUS_EVENTS: readonly CalendarEvent[] = [
  h("hijri-new-year", "آغاز سال نو هجری قمری", 1, 1),
  // 12 Muharram, as the official calendar has it (time.ir 1405), not 25
  h("imam-sajjad-martyrdom", "شهادت امام زین‌العابدین", 1, 12),
  h("prophet-hijra", "هجرت پیامبر اکرم از مکه به مدینه", 3, 1),
  h("prophet-birthday-sunni", "میلاد پیامبر اکرم به روایت اهل سنت و آغاز هفته‌ی وحدت", 3, 12),
  h("imam-hasan-askari-birthday", "ولادت امام حسن عسکری", 4, 8),
  h("masumeh-demise", "وفات حضرت معصومه", 4, 10),
  h("zaynab-birthday", "ولادت حضرت زینب", 5, 5),
  h("fatima-birthday", "ولادت حضرت فاطمه زهرا", 6, 20),
  h("imam-baqir-birthday", "ولادت امام محمد باقر", 7, 1),
  // 3 Rajab (it stood at 3 Rabi al-Awwal by mistake until 2026-10-11)
  h("imam-hadi-martyrdom", "شهادت امام هادی", 7, 3),
  h("imam-jawad-birthday", "ولادت امام جواد", 7, 10),
  h("zaynab-demise", "وفات حضرت زینب", 7, 15),
  h("imam-kazim-martyrdom", "شهادت امام موسی کاظم", 7, 25),
  h("imam-husayn-birthday", "ولادت امام حسین", 8, 3),
  h("abbas-birthday", "ولادت حضرت ابوالفضل العباس", 8, 4),
  h("imam-sajjad-birthday", "ولادت امام زین‌العابدین", 8, 5),
  h("ali-akbar-birthday", "ولادت حضرت علی‌اکبر و روز جوان", 8, 11),
  h("ramadan-start", "آغاز ماه مبارک رمضان", 9, 1),
  h("imam-hasan-birthday", "ولادت امام حسن مجتبی", 9, 15),
  // a night of Qadr begins at sunset: it is marked on the day whose evening it is (as time.ir does)
  h("qadr-night-1", "شب قدر (شب نوزدهم رمضان)", 9, 18),
  h("imam-ali-wounding", "ضربت خوردن امام علی", 9, 19),
  h("qadr-night-2", "شب قدر (شب بیست‌ویکم رمضان)", 9, 20),
  h("qadr-night-3", "شب قدر (شب بیست‌وسوم رمضان)", 9, 22),
  h("masumeh-birthday", "ولادت حضرت معصومه و روز دختر", 11, 1),
  h("imam-reza-birthday", "ولادت امام رضا", 11, 11),
  {
    // the last day of Dhu al-Qadah, as the official calendar has it: 30, or 29 in a short month
    id: "imam-jawad-martyrdom",
    pack: "religious",
    title: "شهادت امام جواد",
    holiday: false,
    rule: { kind: "fixed", calendar: "hijri", month: 11, day: 30, clampToMonthEnd: true },
    provenance: SRC,
  },
  h("imam-baqir-martyrdom", "شهادت امام محمد باقر", 12, 7),
  h("arafah", "روز عرفه", 12, 9),
  h("imam-hadi-birthday", "ولادت امام هادی", 12, 15),
  h("imam-kazim-birthday", "ولادت امام موسی کاظم", 12, 20),
  h("mubahala", "روز مباهله", 12, 24),
];
