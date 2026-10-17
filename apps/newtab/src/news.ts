import { useCallback, useEffect, useRef, useState } from "react";

import { load, save } from "./platform";

/**
 * The news slide's stories, read straight from the outlets' public RSS feeds by the page itself (the
 * manifest's host permissions let it past CORS). Nothing here is managed or sent anywhere: a fixed,
 * curated list of sources, each switched on or off by the person, the stories merged newest first
 * and kept for a few minutes. Only a headline, a summary and a picture are shown, and a click goes to
 * the outlet's own page for the rest. When news is managed on a server, `loadStories` is what changes.
 */

export type NewsCategory = "general" | "economy" | "tech" | "sport";

/** The tabs: everything, then each category. */
export const NEWS_CATEGORIES: readonly (readonly [NewsCategory | "all", string])[] = [
  ["all", "همه"],
  ["general", "عمومی"],
  ["economy", "اقتصاد"],
  ["tech", "فناوری"],
  ["sport", "ورزش"],
];

export type NewsSource = {
  id: string;
  name: string;
  category: NewsCategory;
  /** The feed, at its final address (a redirect would need a permission of its own). */
  feed: string;
  /** The origin the manifest has to allow. */
  host: string;
};

export const NEWS_SOURCES: readonly NewsSource[] = [
  {
    id: "isna",
    name: "ایسنا",
    category: "general",
    feed: "https://www.isna.ir/rss",
    host: "https://www.isna.ir/*",
  },
  {
    id: "khabaronline",
    name: "خبرآنلاین",
    category: "general",
    feed: "https://www.khabaronline.ir/rss",
    host: "https://www.khabaronline.ir/*",
  },
  {
    id: "hamshahri",
    name: "همشهری",
    category: "general",
    feed: "https://www.hamshahrionline.ir/rss",
    host: "https://www.hamshahrionline.ir/*",
  },
  {
    id: "yjc",
    name: "باشگاه خبرنگاران",
    category: "general",
    feed: "https://www.yjc.ir/fa/rss/allnews",
    host: "https://www.yjc.ir/*",
  },
  {
    id: "donya",
    name: "دنیای اقتصاد",
    category: "economy",
    feed: "https://donya-e-eqtesad.com/feeds",
    host: "https://donya-e-eqtesad.com/*",
  },
  {
    id: "eghtesadonline",
    name: "اقتصادآنلاین",
    category: "economy",
    feed: "https://www.eghtesadonline.com/fa/updates/allnews",
    host: "https://www.eghtesadonline.com/*",
  },
  {
    id: "digiato",
    name: "دیجیاتو",
    category: "tech",
    feed: "https://digiato.com/feed",
    host: "https://digiato.com/*",
  },
  {
    id: "varzesh3",
    name: "ورزش۳",
    category: "sport",
    feed: "https://www.varzesh3.com/rss/all",
    host: "https://www.varzesh3.com/*",
  },
];

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

/** The stories of one RSS feed's text. Items without a title or a link are left out. */
export function parseFeed(xml: string, source: NewsSource): Story[] {
  const out: Story[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = m[1] ?? "";
    const title = plain(tag(item, "title") ?? "");
    const url = (tag(item, "link") ?? tag(item, "guid") ?? "").trim();
    if (title === "" || !/^https:\/\//i.test(url)) continue;
    const summary = plain(tag(item, "description") ?? "");
    const when = Date.parse(tag(item, "pubDate") ?? tag(item, "dc:date") ?? "");
    out.push({
      id: `${source.id}:${url}`,
      title,
      summary: summary === title ? "" : summary,
      image: httpsOnly(imageOf(item)),
      source: source.id,
      category: source.category,
      at: new Date(Number.isNaN(when) ? Date.now() : when).toISOString(),
      url,
    });
  }
  return out;
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

// ---- fetching and keeping ----

async function fetchSource(src: NewsSource): Promise<Story[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => {
    ctl.abort();
  }, 10_000);
  try {
    const r = await fetch(src.feed, { signal: ctl.signal });
    if (!r.ok) return [];
    return parseFeed(await r.text(), src);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** The stories of the given sources, fresh from the outlets. */
export async function loadStories(sourceIds: readonly string[]): Promise<Story[]> {
  const chosen = NEWS_SOURCES.filter((s) => sourceIds.includes(s.id));
  return mergeStories(await Promise.all(chosen.map(fetchSource)));
}

const CACHE = "news.v1";
const FRESH_MS = 10 * 60_000;
type Cached = { at: number; sources: string[]; stories: Story[] };

/**
 * The stories: what was kept is shown at once, and fresh ones are fetched when it is older than ten
 * minutes (or the sources changed), when the tab comes back, and on `refresh`.
 */
export function useNews(sourceIds: readonly string[]): {
  stories: Story[];
  loading: boolean;
  failed: boolean;
  refresh: () => void;
} {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const key = [...sourceIds].sort().join(",");
  const ids = useRef(sourceIds);
  ids.current = sourceIds;

  const pull = useCallback(async (force: boolean): Promise<void> => {
    const want = [...ids.current].sort();
    const kept = await load<Cached>(CACHE);
    const same = kept !== undefined && kept.sources.join(",") === want.join(",");
    if (same) setStories(kept.stories);
    if (same && !force && Date.now() - kept.at < FRESH_MS) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fresh = await loadStories(want);
    if (fresh.length > 0) {
      setStories(fresh);
      setFailed(false);
      void save(CACHE, { at: Date.now(), sources: want, stories: fresh } satisfies Cached).catch(
        () => undefined,
      );
    } else if (!same) {
      setStories([]);
      setFailed(want.length > 0);
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

  return {
    stories,
    loading,
    failed,
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
