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
] as const;

/** The slides under the home, in the design's order; the person can switch each off and reorder them. */
export const SLIDES = [
  ["s-plans", "برنامه‌ها"],
  ["s-money", "پول"],
  ["s-notes", "یادداشت‌ها"],
  ["s-social", "شبکه‌ها"],
] as const;
export type SlideId = (typeof SLIDES)[number][0];
export type BlockId = (typeof BLOCKS)[number][0] | SlideId;

export type QuickSite = { title: string; url: string };
/** A folder in the quick-access row: made by dropping one tile on another, or from the persona. */
export type QuickFolder = {
  kind: "folder";
  id: string;
  name: string;
  items: QuickSite[];
  persona?: string;
};
export type QuickItem = QuickSite | QuickFolder;
export const isFolder = (i: QuickItem): i is QuickFolder => "kind" in i;
/** Every site in the row, folders opened. */
export const allSites = (items: readonly QuickItem[]): QuickSite[] =>
  items.flatMap((i) => (isFolder(i) ? i.items : [i]));

export type Settings = {
  theme: string;
  /** Parts switched off; everything else shows. «کارت‌ها همیشه باز» starts off. */
  off: BlockId[];
  sites: QuickItem[];
  /** «کدام بیشتر شبیه توست؟»: a persona id, or null when none was picked. */
  persona: string | null;
  /** The welcome (what an account gives, then sign-in) has been shown once, on the first new tab. */
  welcomed: boolean;
  /** Calendars hidden on the plans slide: list ids, «occ» (occasions), «pr» (prayer times). */
  hiddenCals: string[];
  /** The slides' order under the home (ids missing here follow in the design's order). */
  slideOrder: SlideId[];
  /** The social networks slide: which services have a tab, in what order, and which were introduced. */
  social: { order: string[]; shown: string[]; seen: string[] };
  /** Money amounts hidden on the money slide (one tap shows them). */
  hideMoney: boolean;
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
  persona: null,
  hiddenCals: [],
  slideOrder: SLIDES.map(([id]) => id),
  social: {
    order: ["tg", "ig", "wa", "x", "bale", "rubika", "eitaa"],
    shown: ["tg", "ig", "wa", "bale", "rubika"],
    seen: [],
  },
  hideMoney: false,
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

/** The slides in the person's order (switched-off ones included; `isOn` tells). */
export function orderedSlides(s: Settings): SlideId[] {
  const known = new Set<string>(SLIDES.map(([id]) => id));
  const kept = s.slideOrder.filter((id) => known.has(id));
  return [...kept, ...SLIDES.map(([id]) => id).filter((id) => !kept.includes(id))];
}

/** One step up (-1) or down (+1) among the slides. */
export function moveSlide(id: SlideId, by: -1 | 1): void {
  const order = orderedSlides(current);
  const i = order.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= order.length) return;
  const next = [...order];
  [next[i], next[j]] = [next[j] as SlideId, next[i] as SlideId];
  updateSettings({ slideOrder: next });
}

const FIRST: Theme = { id: "noghte", name: "نقطه", bg: "#14161d", tint: "#9AA6DC" };
export const themeOf = (s: Settings): Theme => THEMES.find((t) => t.id === s.theme) ?? FIRST;
