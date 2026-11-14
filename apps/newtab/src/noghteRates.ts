import { API_BASE } from "./noghte/api";
import type { PriceItem, Prices } from "./market";
import { PRICE_ENTRIES } from "./marketDirect";

/**
 * Today's gold, coins and currencies from نقطه's own server (`GET /api/rates`, 2026-11-14): the
 * server reads alanchand, tgju and bonbast a few times an hour, checks them against each other and
 * hands one answer to the phone, Paket and this extension alike. It comes first for today's
 * numbers; Paket (and the mirror behind it) still gives the charts' history and the world strip,
 * which our server does not have. Each change is the one the site of that price shows for its day.
 */

type Item = {
  value: number;
  unit: "toman" | "usd";
  at: string;
  agreed: boolean;
  change?: { amount: number; percent: number };
};

export type Rates = { readAt: string; items: Partial<Record<string, Item>> };

/** Our keys → the money slide's rows (the same names the mirror's rows use). */
const OURS: Readonly<Record<string, string>> = {
  gold18: "gram18",
  gold24: "gram24",
  mesghal: "mesghal",
  coin_emami: "coin.emami",
  coin_half: "coin.half",
  usd: "usd",
  eur: "eur",
  gbp: "gbp",
  aed: "aed",
  usdt: "usdt",
};

/** The server reads each site every half hour by day (hours at night): older than this is «آخرین». */
const LIVE_MS = 4 * 60 * 60_000;
const WAIT_MS = 3500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** The server's answer, only what fits; anything else → null (the other sources stand in). */
export function parseRates(json: unknown): Rates | null {
  if (!isObj(json) || json.v !== 1 || typeof json.readAt !== "string" || !isObj(json.items))
    return null;
  const items: Partial<Record<string, Item>> = {};
  for (const [key, raw] of Object.entries(json.items)) {
    if (!isObj(raw)) continue;
    const { value, unit, at, agreed, change } = raw;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    if ((unit !== "toman" && unit !== "usd") || typeof at !== "string") continue;
    if (Number.isNaN(Date.parse(at))) continue;
    const c =
      isObj(change) && typeof change.amount === "number" && typeof change.percent === "number"
        ? { amount: change.amount, percent: change.percent }
        : undefined;
    items[key] = {
      value,
      unit,
      at,
      agreed: agreed === true,
      ...(c === undefined ? {} : { change: c }),
    };
  }
  return Object.keys(items).length === 0 ? null : { readAt: json.readAt, items };
}

/** Asks our server, giving up after a few seconds (then Paket's numbers stand). */
export async function ourRates(): Promise<Rates | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => {
    ctl.abort();
  }, WAIT_MS);
  try {
    const r = await fetch(`${API_BASE}/rates`, { signal: ctl.signal });
    return r.ok ? parseRates(await r.json()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function itemOf(id: string, ours: Item, readAt: string, now: number): PriceItem | null {
  const entry = PRICE_ENTRIES.find((e) => e.id === id);
  if (entry === undefined || entry.unit !== "IRT" || ours.unit !== "toman") return null;
  if (entry.group !== "gold" && entry.group !== "fx") return null;
  return {
    id,
    group: entry.group,
    name: entry.name,
    sub: entry.sub,
    unit: "IRT",
    price: ours.value,
    changePct: ours.change?.percent ?? null,
    asOf: ours.at,
    checkedAt: readAt,
    live: now - Date.parse(ours.at) <= LIVE_MS,
    source: "noghte",
  };
}

/**
 * The money slide's prices with today's numbers from our server: each row it has is replaced (the
 * chart's last point too, so the line ends at the number shown); a row only ours has is added; rows
 * we do not have stay as they were. With no other prices at all, ours alone, without charts.
 */
export function withOurRates(
  prices: Prices | null,
  rates: Rates | null,
  now = Date.now(),
): Prices | null {
  if (rates === null) return prices;
  const ours = new Map<string, PriceItem>();
  for (const [id, key] of Object.entries(OURS)) {
    const r = rates.items[key];
    const item = r === undefined ? null : itemOf(id, r, rates.readAt, now);
    if (item !== null) ours.set(id, item);
  }
  if (ours.size === 0) return prices;
  if (prices === null) {
    const items = PRICE_ENTRIES.flatMap((e) => {
      const i = ours.get(e.id);
      return i === undefined ? [] : [i];
    });
    return {
      generatedAt: rates.readAt,
      lastUpdated: rates.readAt,
      live: items.some((i) => i.live),
      items,
    };
  }
  const items = prices.items.map((i) => ours.get(i.id) ?? i);
  for (const [id, i] of ours) if (!items.some((x) => x.id === id)) items.push(i);
  const history =
    prices.history === undefined
      ? undefined
      : {
          ...prices.history,
          series: Object.fromEntries(
            Object.entries(prices.history.series).map(([id, s]) => {
              const i = ours.get(id);
              return [id, i === undefined || s.length === 0 ? s : [...s.slice(0, -1), i.price]];
            }),
          ),
        };
  return {
    ...prices,
    lastUpdated: rates.readAt,
    live: prices.live || items.some((i) => i.live),
    items,
    ...(history === undefined ? {} : { history }),
  };
}
