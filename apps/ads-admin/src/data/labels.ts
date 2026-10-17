import type { AdStatus, Product, SaleModel, Target } from "@dotlife/ads";

/** What the panel calls things, in Persian. */

export const PRODUCT_LABEL: Record<Product, string> = {
  newtab: "نیوتب نقطه",
  noghte: "اپ نقطه",
  paket: "پاکت",
};

/** An ad's state today: its own status, read against its days (`adPhase`). */
export type Phase = AdStatus;

export const PHASE_LABEL: Record<Phase, string> = {
  draft: "پیش‌نویس",
  scheduled: "زمان‌بندی‌شده",
  live: "زنده",
  paused: "متوقف",
  ended: "پایان‌یافته",
};

export const MODEL_LABEL: Record<SaleModel, string> = {
  "per-click": "هر کلیک",
  "per-thousand": "هر هزار نمایش",
  "per-purchase": "هر خرید بلیت",
  "per-signup": "هر عضویت",
  "per-sale": "کارمزد هر خرید",
  "daily-sponsor": "اسپانسر روزانه",
  "monthly-sponsor": "اسپانسر ماهانه",
  "occasion-sponsor": "اسپانسر مناسبت",
};

/** What a model's `price` is a price of. */
export const MODEL_UNIT: Record<SaleModel, string> = {
  "per-click": "تومان برای هر کلیک",
  "per-thousand": "تومان برای هر هزار نمایش",
  "per-purchase": "تومان برای هر خرید",
  "per-signup": "تومان برای هر عضویت",
  "per-sale": "تومان برای هر فروش",
  "daily-sponsor": "تومان در روز",
  "monthly-sponsor": "تومان در ماه",
  "occasion-sponsor": "تومان برای هر مناسبت",
};

export const TARGET_LABEL: Record<Target, string> = {
  persona: "پرسونا",
  city: "شهر",
  season: "فصل",
  occasion: "مناسبت",
  keyword: "کلمه‌ی سرچ",
  topic: "موضوع و دسته‌ی خبر",
  weekend: "آخر هفته",
};

const faNumber = new Intl.NumberFormat("fa-IR");
export const num = (n: number): string => faNumber.format(n);

/** A share as a percent with at most one decimal («۲٫۴٪»). */
export const pct = (x: number): string =>
  `${x.toLocaleString("fa-IR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}٪`;

const jalaliFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/** A Tehran day (`2026-10-17`) in the Persian calendar («۲۵ مهر ۱۴۰۵»). */
export function jalali(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : jalaliFmt.format(d);
}

/** Letters people type two ways read as one, so a search finds both. */
export const normalize = (s: string): string =>
  s.replaceAll("ي", "ی").replaceAll("ك", "ک").replaceAll("‌", " ").trim().toLowerCase();

const segmenter = new Intl.Segmenter("fa", { granularity: "grapheme" });
/** A text's letters as a person counts them (a letter with its marks is one). */
export const graphemes = (s: string): string[] =>
  Array.from(segmenter.segment(s), (x) => x.segment);
/** The first letter, for a mark when no glyph was given. */
export const firstLetter = (s: string): string => graphemes(s)[0] ?? "؟";
