import { load, save } from "./platform";

/**
 * What the person chose for this new tab: the colour, which parts show, and the quick-access row.
 * Kept in the extension's storage (synced with the account in a later step, PLAN «شخصی‌سازی»).
 */

export type Theme = { id: string; name: string; bg: string; tint: string };

/** The default set has colours only, no photos (as in the prototype). */
export const THEMES: readonly Theme[] = [
  { id: "noghte", name: "نقطه", bg: "#14161d", tint: "#9AA6DC" },
  { id: "graphite", name: "گرافیت", bg: "#1a1a1b", tint: "#a7a7ab" },
  { id: "sky", name: "آسمان", bg: "#16202b", tint: "#93B4D8" },
  { id: "amber", name: "کهربا", bg: "#221c13", tint: "#E0A21B" },
  { id: "forest", name: "جنگل", bg: "#132019", tint: "#7FC4A0" },
  { id: "plum", name: "شب بنفش", bg: "#1d1727", tint: "#B79CF0" },
  { id: "rose", name: "رز", bg: "#24171b", tint: "#E59AAA" },
];

export const BLOCKS = [
  ["tasks", "کارها"],
  ["notes", "یادداشت‌ها"],
  ["today", "امروز"],
  ["launcher", "ردیف دسترسی سریع"],
  ["bookmarks", "بوکمارک‌های کروم"],
  ["dateline", "تاریخ زیر سرچ"],
  ["pin", "کارت‌ها همیشه باز"],
  ["peek", "باز شدن گوشه با تغییر تازه"],
  ["entry", "افکت ورود"],
  ["s-plans", "اسلاید برنامه‌ها"],
  ["s-notes", "اسلاید یادداشت‌ها"],
] as const;
export type BlockId = (typeof BLOCKS)[number][0];

export type QuickSite = { title: string; url: string };

export type Settings = {
  theme: string;
  /** Parts switched off; everything else shows. «کارت‌ها همیشه باز» starts off. */
  off: BlockId[];
  sites: QuickSite[];
  /** The welcome (what an account gives, then sign-in) has been shown once, on the first new tab. */
  welcomed: boolean;
  /** Calendars hidden on the plans slide: list ids, «occ» (occasions), «pr» (prayer times). */
  hiddenCals: string[];
};

export const DEFAULT_SITES: readonly QuickSite[] = [
  { title: "یوتیوب", url: "https://www.youtube.com/" },
  { title: "جیمیل", url: "https://mail.google.com/" },
  { title: "دیجی‌کالا", url: "https://www.digikala.com/" },
  { title: "آپارات", url: "https://www.aparat.com/" },
  { title: "گوگل درایو", url: "https://drive.google.com/" },
  { title: "ویکی‌پدیا", url: "https://fa.wikipedia.org/" },
];

export const DEFAULTS: Settings = {
  theme: "noghte",
  off: ["pin"],
  sites: [...DEFAULT_SITES],
  welcomed: false,
  hiddenCals: [],
};

const KEY = "settings.v1";

let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

export async function loadSettings(): Promise<Settings> {
  const s = await load<Partial<Settings>>(KEY);
  current = { ...DEFAULTS, ...s };
  return current;
}

export const settings = (): Settings => current;

export function onSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  void save(KEY, current);
  for (const l of listeners) l();
}

export const isOn = (s: Settings, id: BlockId): boolean => !s.off.includes(id);

export function toggleBlock(id: BlockId): void {
  const s = current;
  updateSettings({ off: isOn(s, id) ? [...s.off, id] : s.off.filter((x) => x !== id) });
}

const FIRST: Theme = { id: "noghte", name: "نقطه", bg: "#14161d", tint: "#9AA6DC" };
export const themeOf = (s: Settings): Theme => THEMES.find((t) => t.id === s.theme) ?? FIRST;
