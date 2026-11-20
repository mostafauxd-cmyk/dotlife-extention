import { EN } from "./en";

/**
 * The page in more than one language (2026-11-20, the user: «چندزبانه ش هم بکنیم و از ابتدا زبان رو
 * بگیریم»). Persian is the source: every text in the code is written in Persian and goes through
 * `t()`, which gives the same text in the chosen language (`en/*.ts`, keyed by the Persian) — or the
 * Persian itself when a translation is missing, so a forgotten line never shows a key.
 *
 * Only what the page says is translated. What is the person's or the account's data (list and
 * folder names, a category Paket sends, the saved-news folder's name that the phone recognises it
 * by) stays exactly as it is.
 */

export type Lang = "fa" | "en";
export const LANGS: readonly { id: Lang; name: string; dir: "rtl" | "ltr" }[] = [
  { id: "fa", name: "فارسی", dir: "rtl" },
  { id: "en", name: "English", dir: "ltr" },
];

let current: Lang = "fa";

/** Set by `settings.ts` whenever the language setting is read or changed. */
export function setLang(l: Lang): void {
  current = l;
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
  }
}

export const lang = (): Lang => current;
export const dirOf = (l: Lang): "rtl" | "ltr" => LANGS.find((x) => x.id === l)?.dir ?? "rtl";
export const isRtl = (): boolean => dirOf(current) === "rtl";

/** The language a new install starts in: Persian for a Persian browser, else English. */
export function browserLang(): Lang {
  const langs =
    typeof navigator === "undefined" ? [] : [...navigator.languages, navigator.language];
  return langs.some((l) => /^fa\b/i.test(l)) ? "fa" : "en";
}

/**
 * The text in the chosen language. `{name}` in it is filled from `vars` (after the lookup, so the
 * key stays the same whatever the values).
 */
export function t(fa: string, vars?: Readonly<Record<string, string | number>>): string {
  // «برگرداندن|note»: the same Persian word meaning something else here; the part after «|» only
  // tells the translations apart and is never shown
  const plain = fa.includes("|") ? fa.slice(0, fa.indexOf("|")) : fa;
  const text = current === "fa" ? plain : (EN[fa] ?? EN[plain] ?? plain);
  if (vars === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined ? m : String(v);
  });
}
