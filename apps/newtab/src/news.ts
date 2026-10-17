import { useCallback, useEffect, useRef, useState } from "react";

import { usePaketNews, type NewsItem } from "./paket";
import { faviconUrl, inExtension, load, save } from "./platform";

/**
 * The news slide's stories, read straight from the outlets' public RSS feeds by the page itself (the
 * manifest's host permissions let it past CORS), plus Paket's own news. Nothing here is managed or
 * sent anywhere: a curated list of sources and the ones the person adds by an RSS address, each
 * switched on or off by them, the stories merged newest first and kept for a few minutes. Only a
 * headline, a summary and a picture are shown, and a click goes to the outlet's own page for the
 * rest. When news is managed on a server, `loadStories` is what changes.
 */

export type NewsCategory =
  | "economy"
  | "tech"
  | "sport"
  | "culture"
  | "society"
  | "health"
  /** A front page's story that fits none of the chips (politics, the world): shown under «همه». */
  | "general";

/** The chips: everything, then each category. */
export const NEWS_CATEGORIES: readonly (readonly [NewsCategory | "all", string])[] = [
  ["all", "همه"],
  ["economy", "اقتصادی"],
  ["tech", "فناوری"],
  ["sport", "ورزشی"],
  ["culture", "فرهنگ و هنر"],
  ["society", "جامعه"],
  ["health", "سلامت"],
];

export const categoryName = (c: NewsCategory): string =>
  c === "general" ? "عمومی" : (NEWS_CATEGORIES.find(([id]) => id === c)?.[1] ?? "");

export type NewsFeed = {
  /** The feed, at its final address (a redirect would need a permission of its own). */
  url: string;
  /** What every story of it is (a section's own feed), or null to tell from the story. */
  category: NewsCategory | null;
};

export type NewsSource = {
  id: string;
  name: string;
  /**
   * Its feeds: a big agency's sections first (so every category has stories, and a story keeps the
   * section it came from), its front page last.
   */
  feeds: readonly NewsFeed[];
  /** The site's icon, bundled (`public/news`), or null to use the letter on `color`. */
  icon: string | null;
  /** The badge's colour, behind the letter when there is no icon. */
  color: string;
  group: "domestic" | "paket" | "own";
};

const feed = (url: string, category: NewsCategory | null = null): NewsFeed => ({ url, category });

/** A Nastooh (Saba) newsroom: its sections are `/rss/tp/<id>`. */
const sections = (origin: string, tp: Partial<Record<NewsCategory, number>>): NewsFeed[] => [
  ...Object.entries(tp).map(([cat, id]) =>
    feed(`${origin}/rss/tp/${String(id)}`, cat as NewsCategory),
  ),
  feed(`${origin}/rss`),
];

export const PAKET_SOURCE: NewsSource = {
  id: "paket",
  name: "تیم پاکت",
  feeds: [],
  icon: "/news/paket.svg",
  color: "#4FA34F",
  group: "paket",
};

/**
 * The badges in `public/news` follow one guide: a 96×96 tile of the outlet's own colour with a soft
 * light from the top, its mark in white in one safe box (a monogram 56×56, a wordmark about 74×38),
 * centred — vector where the outlet publishes one, a 384px picture where it does not. Varzesh3's
 * mark is many-coloured, so it sits on white.
 */
const domestic = (
  id: string,
  name: string,
  feeds: readonly NewsFeed[],
  color: string,
  icon = `/news/${id}.svg`,
): NewsSource => ({ id, name, feeds, icon, color, group: "domestic" });

/**
 * The sources. The four big newsrooms are read section by section (checked 2026-10-17: each section
 * feed answers with 30 stories and their pictures), the specialised outlets by their one feed.
 */
export const NEWS_SOURCES: readonly NewsSource[] = [
  domestic(
    "isna",
    "ایسنا",
    sections("https://www.isna.ir", {
      society: 9,
      health: 50,
      culture: 20,
      tech: 41,
      sport: 24,
      economy: 34,
    }),
    "#0E2C50",
    "/news/isna.png",
  ),
  domestic(
    "mehr",
    "مهر",
    sections("https://www.mehrnews.com", {
      society: 6,
      health: 550,
      culture: 2,
      tech: 5,
      sport: 9,
      economy: 25,
    }),
    "#E1251B",
  ),
  domestic(
    "khabaronline",
    "خبرآنلاین",
    sections("https://www.khabaronline.ir", {
      society: 4,
      health: 46,
      culture: 3,
      tech: 7,
      sport: 6,
      economy: 2,
    }),
    "#1B1A8C",
  ),
  domestic(
    "hamshahri",
    "همشهری",
    sections("https://www.hamshahrionline.ir", {
      society: 5,
      health: 702,
      culture: 26,
      tech: 20,
      sport: 9,
      economy: 10,
    }),
    "#E1251B",
    "/news/hamshahri.png",
  ),
  domestic("yjc", "باشگاه خبرنگاران", [feed("https://www.yjc.ir/fa/rss/allnews")], "#8E1B21"),
  domestic(
    "donya",
    "دنیای اقتصاد",
    [feed("https://donya-e-eqtesad.com/feeds", "economy")],
    "#013B82",
  ),
  domestic(
    "eghtesadonline",
    "اقتصادآنلاین",
    [feed("https://www.eghtesadonline.com/fa/updates/allnews", "economy")],
    "#D6262C",
  ),
  domestic("digiato", "دیجیاتو", [feed("https://digiato.com/feed", "tech")], "#2C7FEA"),
  domestic(
    "varzesh3",
    "ورزش۳",
    [feed("https://www.varzesh3.com/rss/all", "sport")],
    "#2E9B4E",
    "/news/varzesh3.png",
  ),
  PAKET_SOURCE,
];

/** A source the person added by its RSS address. */
export type OwnSource = { id: string; name: string; feed: string };

export const ownToSource = (o: OwnSource): NewsSource => ({
  id: o.id,
  name: o.name,
  feeds: [feed(o.feed)],
  icon: faviconUrl(o.feed, 64),
  color: colorOf(o.id),
  group: "own",
});

const PALETTE = [
  "#3A6EA5",
  "#C0462F",
  "#B8862B",
  "#7A5BC4",
  "#2E8B6A",
  "#3F51B5",
  "#2E9B4E",
  "#C2527A",
];
export function colorOf(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return PALETTE[h % PALETTE.length] ?? "#3A6EA5";
}

export type Story = {
  id: string;
  title: string;
  summary: string;
  image: string | null;
  source: string;
  category: NewsCategory;
  /** ISO time. */
  at: string;
  url: string;
};

// ---- the category of a story ----

const WORDS: readonly (readonly [NewsCategory, readonly string[]])[] = [
  [
    "sport",
    [
      "فوتبال",
      "لیگ",
      "پرسپولیس",
      "استقلال",
      "ورزش",
      "والیبال",
      "کشتی",
      "جام جهانی",
      "المپیک",
      "بسکتبال",
      "تیم ملی",
      "قهرمانی",
      "سرمربی",
    ],
  ],
  [
    "tech",
    [
      "فناوری",
      "هوش مصنوعی",
      "اپل",
      "گوگل",
      "اندروید",
      "آیفون",
      "گوشی",
      "اینترنت",
      "نرم‌افزار",
      "اپلیکیشن",
      "ربات",
      "سامسونگ",
      "تلگرام",
      "استارتاپ",
      "دیجیتال",
    ],
  ],
  [
    "economy",
    [
      "اقتصاد",
      "دلار",
      "طلا",
      "سکه",
      "بورس",
      "بانک",
      "تورم",
      "قیمت",
      "بازار",
      "ارز",
      "یارانه",
      "مالیات",
      "نفت",
      "سرمایه",
      "بودجه",
      "صادرات",
      "واردات",
      "رمزارز",
      "بیت‌کوین",
    ],
  ],
  [
    "health",
    [
      "سلامت",
      "بیمار",
      "بیمارستان",
      "درمان",
      "پزشک",
      "دارو",
      "واکسن",
      "بیماری",
      "ویروس",
      "سرطان",
      "تغذیه",
      "وزارت بهداشت",
    ],
  ],
  [
    "culture",
    [
      "فیلم",
      "سینما",
      "موسیقی",
      "کنسرت",
      "تئاتر",
      "کتاب",
      "نمایشگاه",
      "جشنواره",
      "هنر",
      "نقاشی",
      "رمان",
      "شاعر",
      "سریال",
      "بازیگر",
      "فرهنگ",
    ],
  ],
];

/** A section named in a feed's own tags («اجتماعی > سلامت») says the most; the deeper part first. */
const TAGS: readonly (readonly [NewsCategory, RegExp])[] = [
  ["health", /سلامت|بهداشت|درمان|پزشکی/],
  ["sport", /ورزش|فوتبال|کشتی/],
  ["tech", /فناوری|دانش|علمی|ارتباطات|هوش مصنوعی/],
  ["culture", /فرهنگ|هنر|سینما|ادب|کتاب|موسیقی|تئاتر/],
  ["economy", /اقتصاد|بازار|بورس|انرژی/],
  ["society", /اجتماعی|جامعه|حوادث|شهری|آموزش|محیط زیست|خانواده/],
];

/**
 * The story's category: the feed's own (a section feed), else the section its tags name, else the
 * first whose words the headline uses, else «general».
 */
export function categorize(
  title: string,
  tags: string,
  fallback: NewsCategory | null,
): NewsCategory {
  if (fallback !== null) return fallback;
  for (const part of tags.split(/[>،,]/).reverse()) {
    for (const [cat, re] of TAGS) if (re.test(part)) return cat;
  }
  for (const [cat, words] of WORDS) if (words.some((w) => title.includes(w))) return cat;
  return "general";
}

// ---- reading a feed (a tolerant reader: feeds with a stray `&` still count) ----

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  zwnj: "‌",
  laquo: "«",
  raquo: "»",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#x") || e.startsWith("#X"))
      return String.fromCodePoint(Number.parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(Number.parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** The text of a tag inside an item, CDATA opened, or null. */
function tag(item: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(item);
  if (m === null) return null;
  const raw = (m[1] ?? "").trim();
  const c = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
  return c !== null ? (c[1] ?? "").trim() : decode(raw);
}

const attr = (el: string, name: string): string | null =>
  new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(el)?.[1] ?? null;

/** Plain text from a bit of HTML. */
export function plain(html: string): string {
  return decode(
    html
      // a feed's own footer line («The post … appeared first on …»)
      .replace(/<p>\s*The post[\s\S]*$/i, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function imageOf(item: string): string | null {
  for (const m of item.matchAll(/<(?:enclosure|media:content|media:thumbnail)\b[^>]*>/gi)) {
    const el = m[0];
    const type = attr(el, "type") ?? "";
    const url = attr(el, "url");
    if (
      url !== null &&
      (type === "" || type.startsWith("image/") || /\.(jpe?g|png|webp|avif)/i.test(url))
    ) {
      return decode(url);
    }
  }
  const own = /<image>[\s\S]*?<url>([^<]+)<\/url>[\s\S]*?<\/image>/i.exec(item)?.[1];
  if (own !== undefined) return decode(own.trim());
  const img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(
    tag(item, "description") ?? tag(item, "content:encoded") ?? "",
  );
  return img?.[1] !== undefined ? decode(img[1]) : null;
}

const httpsOnly = (u: string | null): string | null =>
  u !== null && /^https:\/\//i.test(u) ? u : null;

/** The feed's own name, for a source added by address. */
export const feedTitle = (xml: string): string | null => {
  const head = xml.split(/<item\b/i)[0] ?? "";
  const t = tag(head, "title");
  return t === null ? null : plain(t) || null;
};

/** The stories of one RSS feed's text. Items without a title or a link are left out. */
export function parseFeed(
  xml: string,
  source: NewsSource,
  category: NewsCategory | null = null,
): Story[] {
  const out: Story[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = m[1] ?? "";
    const title = plain(tag(item, "title") ?? "");
    const url = (tag(item, "link") ?? tag(item, "guid") ?? "").trim();
    if (title === "" || !/^https:\/\//i.test(url)) continue;
    const summary = plain(tag(item, "description") ?? "");
    const tags = [...item.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)]
      .map((c) => plain(c[1] ?? ""))
      .join(" ");
    const when = Date.parse(tag(item, "pubDate") ?? tag(item, "dc:date") ?? "");
    out.push({
      id: `${source.id}:${url}`,
      title,
      summary: summary === title ? "" : summary,
      image: httpsOnly(imageOf(item)),
      source: source.id,
      category: categorize(title, tags, category),
      at: new Date(Number.isNaN(when) ? Date.now() : when).toISOString(),
      url,
    });
  }
  return out;
}

/** Paket's own news as stories. */
export function paketStories(items: readonly NewsItem[]): Story[] {
  return items.map((n) => ({
    id: `paket:${n.id}`,
    title: n.title,
    summary: n.summary,
    image: httpsOnly(n.thumbnailUrl),
    source: PAKET_SOURCE.id,
    category: "economy",
    at: n.publishedAt,
    url: n.ctaUrl ?? "https://paket.life/?src=chrome&c=news",
  }));
}

/** Newest first, one of each address and one of each headline, a limit per source. */
export function mergeStories(lists: readonly Story[][], perSource = 25): Story[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const all: Story[] = [];
  for (const list of lists) {
    const sorted = [...list].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    for (const s of sorted.slice(0, perSource)) {
      const key = s.title.replace(/\s+/g, "");
      if (seenUrl.has(s.url) || seenTitle.has(key)) continue;
      seenUrl.add(s.url);
      seenTitle.add(key);
      all.push(s);
    }
  }
  return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ---- the same story in other outlets ----

const normal = (s: string): string =>
  s.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[‌]/g, " ").toLowerCase();

const words = (title: string): Set<string> =>
  new Set(
    normal(title)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );

/**
 * For each story, the stories of other outlets that tell the same thing: headlines sharing at least
 * half their words, one story per outlet. The map is by story id; a story with no other outlet has no
 * entry.
 */
export function coverage(stories: readonly Story[], threshold = 0.5): Map<string, Story[]> {
  const bag = stories.map((s) => words(s.title));
  const out = new Map<string, Story[]>();
  stories.forEach((a, i) => {
    const wa = bag[i];
    if (wa === undefined || wa.size < 3) return;
    const same: Story[] = [];
    stories.forEach((b, j) => {
      const wb = bag[j];
      if (i === j || wb === undefined || b.source === a.source || wb.size < 3) return;
      let shared = 0;
      for (const w of wa) if (wb.has(w)) shared++;
      // one line per outlet: its first telling of the story stands for the rest
      if (
        shared / (wa.size + wb.size - shared) >= threshold &&
        !same.some((x) => x.source === b.source)
      )
        same.push(b);
    });
    if (same.length > 0) out.set(a.id, same);
  });
  return out;
}

// ---- fetching and keeping ----

async function fetchText(feed: string): Promise<string | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => {
    ctl.abort();
  }, 10_000);
  try {
    const r = await fetch(feed, { signal: ctl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchFeed(src: NewsSource, f: NewsFeed): Promise<Story[]> {
  const xml = await fetchText(f.url);
  return xml === null ? [] : parseFeed(xml, src, f.category);
}

/**
 * The stories of the given web sources, fresh from the outlets: every feed of each, a dozen newest
 * from each feed, a section's copy of a story kept over the front page's.
 */
export async function loadStories(sources: readonly NewsSource[]): Promise<Story[]> {
  const lists = await Promise.all(sources.flatMap((s) => s.feeds.map((f) => fetchFeed(s, f))));
  return mergeStories(lists, 12);
}

/**
 * A source by RSS address: the address has to be https and to read as a feed, and Chrome is asked
 * (from the click that calls this) for the site's permission. Resolves to the source, or says why not.
 */
export async function checkOwnFeed(
  address: string,
): Promise<{ ok: true; source: OwnSource } | { ok: false; why: string }> {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return { ok: false, why: "این آدرس درست نیست." };
  }
  if (url.protocol !== "https:") return { ok: false, why: "آدرس باید با https شروع شود." };
  if (inExtension) {
    const granted = await chrome.permissions
      .request({ origins: [`${url.origin}/*`] })
      .catch(() => false);
    if (!granted) return { ok: false, why: "بدون اجازه‌ی خواندن از این سایت نمی‌شود." };
  }
  const xml = await fetchText(url.href);
  if (xml === null) return { ok: false, why: "به این آدرس نرسیدم." };
  if (!/<item\b/i.test(xml)) return { ok: false, why: "این آدرس فید RSS نیست." };
  return {
    ok: true,
    source: {
      id: `own:${url.host}${url.pathname}`,
      name: feedTitle(xml) ?? url.host,
      feed: url.href,
    },
  };
}

const CACHE = "news.v3";
const FRESH_MS = 10 * 60_000;
type Cached = { at: number; sources: string[]; stories: Story[] };

/**
 * The stories: what was kept is shown at once, and fresh ones are fetched when it is older than ten
 * minutes (or the sources changed), when the tab comes back, and on `refresh`. Paket's news, when
 * its source is on, come with the rest.
 */
export function useNews(sources: readonly NewsSource[]): {
  stories: Story[];
  loading: boolean;
  failed: boolean;
  refresh: () => void;
} {
  const [fetched, setFetched] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const paket = usePaketNews();
  const web = sources.filter((s) => s.group !== "paket");
  const withPaket = sources.some((s) => s.group === "paket");
  const key = web
    .map((s) => s.id)
    .sort()
    .join(",");
  const webRef = useRef(web);
  webRef.current = web;

  const pull = useCallback(async (force: boolean): Promise<void> => {
    const list = webRef.current;
    const want = list
      .map((s) => s.id)
      .sort()
      .join(",");
    const kept = await load<Cached>(CACHE);
    const same = kept !== undefined && kept.sources.join(",") === want;
    if (same) setFetched(kept.stories);
    if (same && !force && Date.now() - kept.at < FRESH_MS) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fresh = await loadStories(list);
    if (fresh.length > 0) {
      setFetched(fresh);
      setFailed(false);
      void save(CACHE, {
        at: Date.now(),
        sources: want.split(","),
        stories: fresh,
      } satisfies Cached).catch(() => undefined);
    } else if (!same) {
      setFetched([]);
      setFailed(list.length > 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void pull(false);
    const back = (): void => {
      if (!document.hidden) void pull(false);
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
    };
  }, [pull, key]);

  const stories = withPaket
    ? mergeStories([fetched, paketStories(paket)], Number.POSITIVE_INFINITY)
    : fetched;
  return {
    stories,
    loading,
    failed: failed && stories.length === 0,
    refresh: () => {
      void pull(true);
    },
  };
}

// ---- what was read ----

const READ = "news.read.v1";
const READ_LIMIT = 600;

export function useRead(): { read: ReadonlySet<string>; markRead: (id: string) => void } {
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    void load<string[]>(READ).then((r) => {
      if (r !== undefined) setRead((cur) => [...new Set([...r, ...cur])]);
    });
  }, []);
  return {
    read: new Set(read),
    markRead: (id) => {
      setRead((cur) => {
        if (cur.includes(id)) return cur;
        const next = [...cur, id].slice(-READ_LIMIT);
        void save(READ, next).catch(() => undefined);
        return next;
      });
    },
  };
}

// ---- «برای تو» and «داغ‌ترین» ----

const TOPIC_CATEGORY: Record<string, NewsCategory> = {
  اقتصاد: "economy",
  کسب‌وکار: "economy",
  املاک: "economy",
  فناوری: "tech",
  بازی: "tech",
  ورزش: "sport",
  فرهنگ: "culture",
  کتاب: "culture",
  موسیقی: "culture",
  سینما: "culture",
  هنر: "culture",
  سلامت: "health",
};

/**
 * «برای تو»: newest first, but what the person follows (the topics they said) rises, what several
 * outlets cover rises, and what they already opened sinks.
 */
export function forYou(
  stories: readonly Story[],
  opts: {
    topics: readonly string[];
    read: ReadonlySet<string>;
    covered: ReadonlyMap<string, Story[]>;
    now?: number;
  },
): Story[] {
  const now = opts.now ?? Date.now();
  const score = (s: Story): number => {
    const hours = Math.max(0, (now - Date.parse(s.at)) / 3_600_000);
    let v = -hours; // an hour older is an hour less
    if (opts.topics.some((t) => TOPIC_CATEGORY[t] === s.category || s.title.includes(t))) v += 12;
    v += 4 * Math.min(3, opts.covered.get(s.id)?.length ?? 0);
    if (opts.read.has(s.id)) v -= 48;
    return v;
  };
  return [...stories].sort((a, b) => score(b) - score(a));
}

/** «داغ‌ترین»: the last day's stories told by the most outlets, then the newest. */
export function hottest(
  stories: readonly Story[],
  covered: ReadonlyMap<string, Story[]>,
  limit = 6,
  now = Date.now(),
): Story[] {
  const day = stories.filter((s) => now - Date.parse(s.at) < 24 * 3_600_000);
  const taken = new Set<string>();
  const out: Story[] = [];
  const ranked = [...day].sort(
    (a, b) =>
      (covered.get(b.id)?.length ?? 0) - (covered.get(a.id)?.length ?? 0) ||
      Date.parse(b.at) - Date.parse(a.at),
  );
  for (const s of ranked) {
    if (taken.has(s.id)) continue;
    out.push(s);
    taken.add(s.id);
    // the story's twins in other outlets are not a second line of the list
    for (const t of covered.get(s.id) ?? []) taken.add(t.id);
    if (out.length === limit) break;
  }
  return out;
}

// ---- a picture for a story whose feed gives none ----

/** The page's own picture (`og:image`, else `twitter:image`), or null. */
export function ogImage(html: string): string | null {
  const head = html.slice(0, 200_000);
  for (const name of ["og:image", "og:image:secure_url", "twitter:image"]) {
    const n = name.replace(/:/g, "\\:");
    const m =
      new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']`, "i").exec(
        head,
      ) ??
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, "i").exec(
        head,
      );
    const url = httpsOnly(m?.[1] === undefined ? null : decode(m[1]));
    if (url !== null) return url;
  }
  return null;
}

const OG = "news.og.v1";
const OG_LIMIT = 500;
let ogKept: Promise<Record<string, string>> | null = null;
const ogStore = (): Promise<Record<string, string>> =>
  (ogKept ??= load<Record<string, string>>(OG).then((r) => r ?? {}));

// a few at a time: the pictures are asked for as cards come into view, not all at once
let running = 0;
const waiting: (() => void)[] = [];
async function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  if (running >= 3) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/**
 * The picture on the story's own page, for a feed that gives none (اقتصادآنلاین): read once, kept
 * ("" when the page has none; a failed read is tried again another time).
 */
export async function articleImage(url: string): Promise<string | null> {
  const kept = await ogStore();
  const had = kept[url];
  if (had !== undefined) return had === "" ? null : had;
  const html = await oneAtATime(() => fetchText(url));
  if (html === null) return null;
  const img = ogImage(html);
  kept[url] = img ?? "";
  // the newest few hundred are kept, the oldest go
  const all = Object.entries(kept);
  const next = all.length > OG_LIMIT ? Object.fromEntries(all.slice(-OG_LIMIT)) : kept;
  ogKept = Promise.resolve(next);
  void save(OG, next).catch(() => undefined);
  return img;
}
