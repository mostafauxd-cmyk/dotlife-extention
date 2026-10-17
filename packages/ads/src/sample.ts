import type { Ad } from "./schema";

/**
 * What the clients draw until a server sends a signed bundle: one ad for each slot the new tab has,
 * the design's own examples. Marked as the sample's so no one mistakes them for sold ads.
 */
const base = {
  products: ["newtab"] as Ad["products"],
  status: "live" as const,
  weight: 1,
  targeting: { persona: [], city: [], season: [], occasion: [], keyword: [], topic: [], weekend: false },
};

export const SAMPLE_ADS: readonly Ad[] = [
  { ...base, id: "sample-1", slot: 1, advertiser: "نمونه", title: "بیمه‌ی آنلاین", glyph: "ب", tint: "#D9862B", url: "https://example.com/", model: "per-click" },
  { ...base, id: "sample-2", slot: 2, advertiser: "نمونه", title: "دوره‌ی UI", glyph: "د", tint: "#EA4C89", url: "https://example.com/", model: "per-click", extra: { folder: "طراحی" }, targeting: { ...base.targeting, persona: ["designer"] } },
  { ...base, id: "sample-4", slot: 4, advertiser: "نمونه", title: "بلیت قطار مشهد", line: "از ۴۵۰ هزار تومان", url: "https://example.com/", model: "per-click", targeting: { ...base.targeting, keyword: ["مشهد", "قطار"] } },
  { ...base, id: "sample-5", slot: 5, advertiser: "نمونه", title: "شام امشب با ۲۰٪ تخفیف", url: "https://example.com/", model: "daily-sponsor" },
  { ...base, id: "sample-6", slot: 6, advertiser: "نمونه", title: "بلیت قطار مشهد از ۴۵۰ هزار تومان", line: "برای آخر هفته", cta: "ببین", url: "https://example.com/", model: "per-thousand" },
  { ...base, id: "sample-7", slot: 7, advertiser: "نمونه", title: "ارکستر ملی، شب حافظ", line: "جمعه ۱ آبان · تالار وحدت", cta: "+ برنامه", glyph: "ک", tint: "#8C9EFF", url: "https://example.com/", model: "per-purchase", extra: { kind: "کنسرت", date: "2026-10-23" } },
  { ...base, id: "sample-8", slot: 8, advertiser: "نمونه", title: "کفش ورزشی ۲۰٪ تخفیف", url: "https://example.com/", model: "occasion-sponsor", extra: { occasionDay: "26" } },
  { ...base, id: "sample-9", slot: 9, advertiser: "نمونه", title: "بلیت سینما و تئاتر این آخر هفته", url: "https://example.com/", model: "per-click" },
  { ...base, id: "sample-10", slot: 10, advertiser: "نمونه", title: "خرید طلای آب‌شده", line: "از ۱۰۰ هزار تومان", url: "https://example.com/", model: "per-sale" },
  { ...base, id: "sample-11", slot: 11, advertiser: "نمونه", title: "صندوق طلای عیار", line: "واحد صندوق · بورس کالا", glyph: "ص", tint: "#B8862B", url: "https://example.com/", model: "monthly-sponsor", extra: { price: "48200", change: "0.9" } },
  { ...base, id: "sample-12", slot: 12, advertiser: "نمونه", title: "سپرده‌ی روزشمار؛ برداشت هر روز بدون جریمه", line: "از طرف یک بانک", cta: "افتتاح حساب", url: "https://example.com/", model: "per-thousand" },
  { ...base, id: "sample-13", slot: 13, advertiser: "نمونه", title: "چک‌لیست سفر شمال", line: "از طرف یک آژانس سفر", cta: "استفاده از قالب", url: "https://example.com/", model: "monthly-sponsor", extra: { body: "مدارک و بلیت\nلباس گرم\nشارژر و پاوربانک\nرزرو اقامت" } },
  { ...base, id: "sample-15", slot: 15, advertiser: "نمونه", title: "کانال خبری سفر", line: "برای دوستداران سفر", cta: "عضویت", glyph: "T", tint: "#2AABEE", url: "https://t.me/", model: "per-signup" },
];
