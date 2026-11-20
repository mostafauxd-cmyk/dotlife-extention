import { lang, t } from "../i18n";

/**
 * Digits for anything shown, in the page's language: Persian digits in Persian (the font has them
 * too, but copy-paste keeps them), Latin ones otherwise — and Persian digits that came in written
 * become Latin there.
 */
export const fa = (s: string | number): string =>
  lang() === "fa"
    ? String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d)
    : latin(String(s)).replace(/٬/g, ",").replace(/٫/g, ".");

/** Latin digits from anything typed (a phone number or a code in Persian digits). */
export const latin = (s: string): string =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** «۱۰:۳۰» from a Date, in Tehran time. */
export function clock(d: Date): string {
  const t = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tehran",
  });
  return fa(t);
}

/** «همین حالا»، «۵ دقیقه پیش»، «۳ ساعت پیش»، «دیروز»… */
export function ago(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  if (s < 60) return t("همین حالا");
  if (s < 3600) return t("{n} دقیقه پیش", { n: fa(Math.floor(s / 60)) });
  if (s < 86400) return t("{n} ساعت پیش", { n: fa(Math.floor(s / 3600)) });
  if (s < 2 * 86400) return t("دیروز");
  return t("{n} روز پیش", { n: fa(Math.floor(s / 86400)) });
}
