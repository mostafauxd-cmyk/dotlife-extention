/** Persian digits for anything shown (the font has them too, but copy-paste keeps them). */
export const fa = (s: string | number): string =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d);

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
  if (s < 60) return "همین حالا";
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`;
  if (s < 2 * 86400) return "دیروز";
  return `${fa(Math.floor(s / 86400))} روز پیش`;
}
