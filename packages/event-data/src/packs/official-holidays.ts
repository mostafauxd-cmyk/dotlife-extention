import type { CalendarEvent, Provenance } from "../types";

/**
 * تعطیلات رسمی جمهوری اسلامی ایران — مجموعه‌ی هسته، همیشه در دسترس (PLAN §116).
 * مرجع: تقویم رسمی کشور (مرکز تقویم مؤسسه ژئوفیزیک دانشگاه تهران)، به نقل از time.ir.
 */
const SRC: Provenance = {
  source: "تقویم رسمی کشور — مرکز تقویم مؤسسه ژئوفیزیک دانشگاه تهران (به نقل از time.ir)",
  url: "https://www.time.ir/",
  retrievedAt: "2026-10-04",
};

const solar = (
  id: string,
  title: string,
  month: number,
  day: number,
  description?: string,
): CalendarEvent => ({
  id,
  pack: "official-holidays",
  title,
  holiday: true,
  rule: { kind: "fixed", calendar: "solar-hijri", month, day },
  ...(description === undefined ? {} : { description }),
  provenance: SRC,
});

const hijri = (
  id: string,
  title: string,
  month: number,
  day: number,
  opts: { clampToMonthEnd?: boolean; description?: string } = {},
): CalendarEvent => ({
  id,
  pack: "official-holidays",
  title,
  holiday: true,
  rule: {
    kind: "fixed",
    calendar: "hijri",
    month,
    day,
    ...(opts.clampToMonthEnd === true ? { clampToMonthEnd: true } : {}),
  },
  ...(opts.description === undefined ? {} : { description: opts.description }),
  provenance: SRC,
});

export const OFFICIAL_HOLIDAYS: readonly CalendarEvent[] = [
  // ---- خورشیدی ----
  solar("nowruz-1", "نوروز — جشن سال نو", 1, 1),
  solar("nowruz-2", "نوروز", 1, 2),
  solar("nowruz-3", "نوروز", 1, 3),
  solar("nowruz-4", "نوروز", 1, 4),
  solar("islamic-republic-day", "روز جمهوری اسلامی ایران", 1, 12),
  solar("nature-day", "روز طبیعت (سیزده‌به‌در)", 1, 13),
  solar("khomeini-demise", "رحلت امام خمینی", 3, 14),
  solar("15-khordad-uprising", "قیام ۱۵ خرداد", 3, 15),
  solar("revolution-victory", "پیروزی انقلاب اسلامی", 11, 22),
  solar("oil-nationalization", "روز ملی شدن صنعت نفت", 12, 29),

  // ---- قمری ----
  hijri("tasua", "تاسوعای حسینی", 1, 9),
  hijri("ashura", "عاشورای حسینی", 1, 10),
  hijri("arbaeen", "اربعین حسینی", 2, 20),
  hijri("prophet-demise", "رحلت پیامبر اکرم و شهادت امام حسن مجتبی", 2, 28),
  hijri("imam-reza-martyrdom", "شهادت امام رضا", 2, 30, {
    clampToMonthEnd: true,
    description: "در سال‌هایی که صفر ۲۹ روزه است، در ۲۹ صفر برگزار می‌شود.",
  }),
  hijri("imam-askari-martyrdom", "شهادت امام حسن عسکری", 3, 8),
  hijri("prophet-birthday", "میلاد پیامبر اکرم و امام جعفر صادق", 3, 17),
  hijri("fatima-martyrdom", "شهادت حضرت فاطمه زهرا", 6, 3),
  hijri("imam-ali-birthday", "ولادت امام علی", 7, 13),
  hijri("mabaath", "مبعث پیامبر اکرم", 7, 27),
  hijri("imam-mahdi-birthday", "ولادت حضرت قائم (نیمه‌ی شعبان)", 8, 15),
  hijri("imam-ali-martyrdom", "شهادت امام علی", 9, 21),
  hijri("eid-fitr-1", "عید سعید فطر", 10, 1),
  hijri("eid-fitr-2", "تعطیل به مناسبت عید سعید فطر", 10, 2),
  hijri("imam-sadiq-martyrdom", "شهادت امام جعفر صادق", 10, 25),
  hijri("eid-adha", "عید سعید قربان", 12, 10),
  hijri("eid-ghadir", "عید سعید غدیر خم", 12, 18),
];
