import type { PriceItem, Prices, Ticker, TickerItem } from "./market";

/**
 * The market without Paket's server. Paket's own `/v1/market/*` is the way the extension is meant to
 * read prices (one place keeps the keys and the rate limits); until it answers, the same two public
 * sources it reads are read here, by the same rules: the iran-market mirror (TGJU's gold, coins and
 * currencies, republished every 30 minutes) and Nobitex's public stats for crypto and the tether.
 * Only the figures the money slide shows are taken, and a record that does not fit is dropped.
 */

const MIRROR = "https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data";
const NOBITEX = "https://api.nobitex.ir";
/** The mirror re-checks every 30 minutes; a price stays «live» a little longer than that. */
const LIVE_MS = 45 * 60_000;

type Entry = {
  id: string;
  group: PriceItem["group"] | TickerItem["group"];
  name: string;
  sub: string;
  glyph: string;
  unit: "IRT" | "USD";
  symbol: string;
};

const PRICE_ENTRIES: Entry[] = [
  {
    id: "gold18",
    group: "gold",
    name: "طلای ۱۸ عیار",
    sub: "هر گرم",
    glyph: "۱۸",
    unit: "IRT",
    symbol: "GOLD_18K_IRR",
  },
  {
    id: "gold24",
    group: "gold",
    name: "طلای ۲۴ عیار",
    sub: "هر گرم",
    glyph: "۲۴",
    unit: "IRT",
    symbol: "GOLD_24K_IRR",
  },
  {
    id: "mesghal",
    group: "gold",
    name: "مثقال طلا",
    sub: "آب‌شده",
    glyph: "م",
    unit: "IRT",
    symbol: "GOLD_MESGHAL_IRR",
  },
  {
    id: "coin_emami",
    group: "gold",
    name: "سکه امامی",
    sub: "هر عدد",
    glyph: "س",
    unit: "IRT",
    symbol: "COIN_EMAMI_IRR",
  },
  {
    id: "coin_half",
    group: "gold",
    name: "نیم سکه",
    sub: "هر عدد",
    glyph: "ن",
    unit: "IRT",
    symbol: "COIN_HALF_IRR",
  },
  {
    id: "usd",
    group: "fx",
    name: "دلار آمریکا",
    sub: "بازار آزاد",
    glyph: "$",
    unit: "IRT",
    symbol: "USD_IRR_FREE",
  },
  {
    id: "eur",
    group: "fx",
    name: "یورو",
    sub: "بازار آزاد",
    glyph: "€",
    unit: "IRT",
    symbol: "EUR_IRR_FREE",
  },
  {
    id: "gbp",
    group: "fx",
    name: "پوند انگلیس",
    sub: "بازار آزاد",
    glyph: "£",
    unit: "IRT",
    symbol: "GBP_IRR_FREE",
  },
  {
    id: "aed",
    group: "fx",
    name: "درهم امارات",
    sub: "بازار آزاد",
    glyph: "د",
    unit: "IRT",
    symbol: "AED_IRR_FREE",
  },
  {
    id: "usdt",
    group: "fx",
    name: "تتر",
    sub: "USDT",
    glyph: "₮",
    unit: "IRT",
    symbol: "USDT_IRR",
  },
];

const TICKER_ENTRIES: Entry[] = [
  {
    id: "xau",
    group: "metal",
    name: "انس طلا",
    sub: "دلار",
    glyph: "Au",
    unit: "USD",
    symbol: "XAU_USD",
  },
  {
    id: "xag",
    group: "metal",
    name: "انس نقره",
    sub: "دلار",
    glyph: "Ag",
    unit: "USD",
    symbol: "XAG_USD",
  },
  {
    id: "xpt",
    group: "metal",
    name: "پلاتین",
    sub: "دلار",
    glyph: "Pt",
    unit: "USD",
    symbol: "XPT_USD",
  },
  {
    id: "btc",
    group: "crypto",
    name: "بیت‌کوین",
    sub: "دلار",
    glyph: "₿",
    unit: "USD",
    symbol: "BTC_USD",
  },
  {
    id: "eth",
    group: "crypto",
    name: "اتریوم",
    sub: "دلار",
    glyph: "Ξ",
    unit: "USD",
    symbol: "ETH_USD",
  },
  {
    id: "usdt",
    group: "fx",
    name: "تتر",
    sub: "USDT",
    glyph: "₮",
    unit: "IRT",
    symbol: "USDT_IRR",
  },
  {
    id: "sol",
    group: "crypto",
    name: "سولانا",
    sub: "دلار",
    glyph: "S",
    unit: "USD",
    symbol: "SOL_USD",
  },
  {
    id: "ton",
    group: "crypto",
    name: "تون‌کوین",
    sub: "دلار",
    glyph: "T",
    unit: "USD",
    symbol: "TON_USD",
  },
  {
    id: "bnb",
    group: "crypto",
    name: "بی‌ان‌بی",
    sub: "دلار",
    glyph: "B",
    unit: "USD",
    symbol: "BNB_USD",
  },
  {
    id: "trx",
    group: "crypto",
    name: "ترون",
    sub: "دلار",
    glyph: "T",
    unit: "USD",
    symbol: "TRX_USD",
  },
  {
    id: "doge",
    group: "crypto",
    name: "دوج‌کوین",
    sub: "دلار",
    glyph: "D",
    unit: "USD",
    symbol: "DOGE_USD",
  },
];

export type Quote = {
  price: number;
  changePct: number | null;
  asOf: string;
  checkedAt: string;
  live: boolean;
  source: "iran-market" | "nobitex";
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const date = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** `latest-toman.json` → quotes by symbol (toman and dollars as the file declares them). */
export function parseMirror(json: unknown, now: Date): Map<string, Quote & { unit: string }> {
  const out = new Map<string, Quote & { unit: string }>();
  if (!isObj(json) || !isObj(json.data) || !isObj(json.data.categories)) return out;
  // a rial file would be ten times too high
  if (isObj(json.meta) && json.meta.unit !== undefined && json.meta.unit !== "toman") return out;
  const generated = date(json.data.generated_at);
  for (const list of Object.values(json.data.categories)) {
    if (!Array.isArray(list)) continue;
    for (const rec of list as unknown[]) {
      if (!isObj(rec) || typeof rec.symbol !== "string") continue;
      const price = num(rec.price);
      const asOf = date(rec.timestamp);
      const unit = rec.currency;
      if (price === null || price <= 0 || asOf === null || (unit !== "IRT" && unit !== "USD"))
        continue;
      if (Array.isArray(rec.quality) && rec.quality.includes("spike")) continue;
      const checkedAt = date(rec.checked_at) ?? generated ?? now.toISOString();
      out.set(rec.symbol, {
        price,
        changePct: num(rec.change_pct),
        asOf,
        checkedAt,
        live: rec.stale !== true && now.getTime() - Date.parse(checkedAt) <= LIVE_MS,
        source: "iran-market",
        unit,
      });
    }
  }
  return out;
}

/** Nobitex `market/stats` → crypto in dollars and the tether in toman (its pair is in rial). */
export function parseNobitex(json: unknown, now: Date): Map<string, Quote> {
  const out = new Map<string, Quote>();
  if (!isObj(json) || json.status !== "ok" || !isObj(json.stats)) return out;
  const stats = json.stats;
  const take = (key: string, id: string, k: number): void => {
    const s = stats[key];
    if (!isObj(s) || s.isClosed === true) return;
    const latest = Number(s.latest);
    if (!(latest > 0)) return;
    const open = Number(s.dayOpen);
    out.set(id, {
      price: latest * k,
      changePct: open > 0 ? (latest / open - 1) * 100 : null,
      asOf: now.toISOString(),
      checkedAt: now.toISOString(),
      live: true,
      source: "nobitex",
    });
  };
  for (const id of ["btc", "eth", "sol", "ton", "bnb", "trx", "doge"]) take(`${id}-usdt`, id, 1);
  take("usdt-rls", "usdt", 0.1);
  return out;
}

/** The tether must sit near the dollar, or the unit assumption is wrong and the mirror's figure stands. */
export function usdtAgrees(usdt: number, usd: number | undefined): boolean {
  if (usdt < 1_000 || usdt > 10_000_000) return false;
  return usd === undefined || (usdt / usd >= 0.8 && usdt / usd <= 1.25);
}

/** `history/{SYMBOL}.json` → daily closes in toman, oldest first (the files are in rial). */
export function parseCloses(json: unknown, currency: string | undefined): number[] {
  const scale = currency === "IRR" ? 0.1 : currency === "IRT" ? 1 : null;
  if (scale === null || !isObj(json) || !Array.isArray(json.data)) return [];
  const out: number[] = [];
  for (const c of json.data as unknown[]) {
    if (!isObj(c)) continue;
    const close = num(c.close);
    if (close !== null && close > 0) out.push(close * scale);
  }
  return out;
}

/** The last `days` closes (a year every seventh), with today's live price as the last point. */
export function seriesOf(closes: number[], days: 7 | 30 | 365, live: number): number[] {
  const tail = closes.slice(-days);
  const picked = days === 365 ? tail.filter((_, i) => (tail.length - 1 - i) % 7 === 0) : tail;
  return [...picked, live];
}

// ---- the requests ----

async function getJson(url: string, ms = 8000): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => {
    ctl.abort();
  }, ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    return (await r.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const closes = new Map<string, Promise<number[]>>();
let currencies: Promise<Map<string, string>> | null = null;

async function history(symbol: string): Promise<number[]> {
  currencies ??= getJson(`${MIRROR}/history/index.json`).then((j) => {
    const m = new Map<string, string>();
    if (isObj(j) && Array.isArray(j.data))
      for (const e of j.data as unknown[])
        if (isObj(e) && typeof e.symbol === "string" && typeof e.currency === "string")
          m.set(e.symbol, e.currency);
    return m;
  });
  const cur = (await currencies).get(symbol);
  let p = closes.get(symbol);
  if (p === undefined) {
    p = getJson(`${MIRROR}/history/${symbol}.json`, 20_000).then((j) => parseCloses(j, cur));
    closes.set(symbol, p);
  }
  return p;
}

/**
 * Prices and the strip from the sources. `want` is the price the card shows a chart for: only its
 * history file is read (they are about a megabyte each), kept for as long as the tab lives.
 */
export async function directMarket(
  period: 7 | 30 | 365,
  want: string | null,
): Promise<{ prices: Prices | null; ticker: Ticker | null }> {
  const now = new Date();
  const [latest, nob] = await Promise.all([
    getJson(`${MIRROR}/latest-toman.json`, 15_000),
    getJson(
      `${NOBITEX}/market/stats?srcCurrency=btc,eth,sol,ton,bnb,trx,doge,usdt&dstCurrency=usdt,rls`,
    ),
  ]);
  const mirror = parseMirror(latest, now);
  const crypto = parseNobitex(nob, now);
  const usd = mirror.get("USD_IRR_FREE")?.price;
  const tether = crypto.get("usdt");
  if (tether !== undefined && !usdtAgrees(tether.price, usd)) crypto.delete("usdt");

  const quote = (e: Entry): Quote | undefined => {
    const n = crypto.get(e.id);
    if (n !== undefined && (e.id === "usdt" || e.unit === "USD")) return n;
    const m = mirror.get(e.symbol);
    return m !== undefined && m.unit === e.unit ? m : undefined;
  };

  const items: PriceItem[] = PRICE_ENTRIES.flatMap((e) => {
    const q = quote(e);
    return q === undefined
      ? []
      : [
          {
            id: e.id,
            group: e.group as "gold" | "fx",
            name: e.name,
            sub: e.sub,
            unit: "IRT" as const,
            ...q,
          },
        ];
  });
  const stamps = [...items.map((i) => i.checkedAt)].sort();
  const prices: Prices | null =
    items.length === 0
      ? null
      : {
          generatedAt: now.toISOString(),
          lastUpdated: stamps.at(-1) ?? null,
          live: items.every((i) => i.live),
          items,
        };

  if (prices !== null) {
    const pick = items.find((i) => i.id === want) ?? items[0];
    const entry = PRICE_ENTRIES.find((e) => e.id === pick?.id);
    if (pick !== undefined && entry !== undefined) {
      const c = await history(entry.symbol);
      if (c.length > 1)
        prices.history = {
          days: period,
          stepDays: period === 365 ? 7 : 1,
          series: { [pick.id]: seriesOf(c, period, pick.price) },
        };
    }
  }

  const tk: TickerItem[] = TICKER_ENTRIES.flatMap((e) => {
    const q = quote(e);
    return q === undefined
      ? []
      : [
          {
            id: e.id,
            group: e.group as TickerItem["group"],
            name: e.name,
            glyph: e.glyph,
            unit: e.unit,
            ...q,
          },
        ];
  });
  const ticker: Ticker | null =
    tk.length === 0
      ? null
      : {
          generatedAt: now.toISOString(),
          lastUpdated: [...tk.map((i) => i.checkedAt)].sort().at(-1) ?? null,
          live: tk.every((i) => i.live),
          items: tk,
        };
  return { prices, ticker };
}
