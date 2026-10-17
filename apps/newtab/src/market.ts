import { useEffect, useState } from "react";

import { directMarket } from "./marketDirect";
import { load, save } from "./platform";
import { paketGet } from "./paket";

/**
 * The market on the money slide: today's gold, coins and currencies, and the strip of world metals
 * and crypto. Both are Paket's public prices (`/v1/market/prices`, `/v1/market/ticker`) — no sign-in,
 * so they show whether or not Paket is linked. The extension never asks the price sources itself.
 */

export type PriceItem = {
  id: string;
  group: "gold" | "fx";
  name: string;
  sub: string;
  unit: "IRT";
  price: number;
  changePct: number | null;
  asOf: string;
  checkedAt: string;
  live: boolean;
  source: string;
};

export type Prices = {
  generatedAt: string;
  lastUpdated: string | null;
  live: boolean;
  items: PriceItem[];
  /** Oldest to newest; the last point is today's live price. `stepDays` is 7 for a year. */
  history?: { days: number; stepDays: number; series: Record<string, number[]> };
};

export type TickerItem = {
  id: string;
  group: "metal" | "crypto" | "fx";
  name: string;
  glyph: string;
  unit: "USD" | "IRT";
  price: number;
  changePct: number | null;
  asOf: string;
  checkedAt: string;
  live: boolean;
  source: string;
};

export type Ticker = {
  generatedAt: string;
  lastUpdated: string | null;
  live: boolean;
  items: TickerItem[];
};

export type Period = 7 | 30 | 365;

/**
 * Each row's round badge: an Iconly Pro icon (public/market) drawn in the asset's own colour on a
 * soft tint of it. The server sends the name; the look is ours.
 */
export const BADGE: Record<string, { icon: string; color: string }> = {
  gold18: { icon: "gold", color: "#F2C94C" },
  gold24: { icon: "gold", color: "#F2C94C" },
  mesghal: { icon: "gold", color: "#F2C94C" },
  coin_emami: { icon: "coins", color: "#F2C94C" },
  coin_half: { icon: "coins", color: "#F2C94C" },
  usd: { icon: "dollar", color: "#4CC38A" },
  eur: { icon: "euro", color: "#6AA0FF" },
  gbp: { icon: "pound", color: "#B58CFF" },
  aed: { icon: "coins", color: "#E0A155" },
  usdt: { icon: "tether", color: "#26A17B" },
  xau: { icon: "gold", color: "#F2C94C" },
  xag: { icon: "gold", color: "#C9D1DB" },
  xpt: { icon: "gold", color: "#9AA7B5" },
  btc: { icon: "bitcoin", color: "#F7931A" },
  eth: { icon: "ethereum", color: "#8C9EFF" },
  sol: { icon: "solana", color: "#B07BFF" },
  ton: { icon: "coins", color: "#4CB2F5" },
  bnb: { icon: "bnb", color: "#F0B90B" },
  trx: { icon: "tron", color: "#FF5A5A" },
  doge: { icon: "dogecoin", color: "#D8B24A" },
};

type Market = {
  prices: Prices | null;
  ticker: Ticker | null;
  /** Paket could not be reached the last time (what is shown, if anything, is older). */
  offline: boolean;
};

type Pulled = {
  prices: Prices | null;
  ticker: Ticker | null;
  /** Settles once the charts' history has been read again (the direct sources only). */
  later: Promise<void> | null;
};

/** Paket's server keeps each answer for half a minute; asking again sooner would get the same one. */
const FRESH_MS = 30_000;
/** Paket not answering within this long counts as no answer, so the sources stand in without a long wait. */
const PAKET_WAIT_MS = 3500;

let cached: { period: Period; at: number; got: Pulled } | null = null;

const LAST_KEY = "market.last.v1";
type Last = { period: Period; prices: Prices | null; ticker: Ticker | null };

/** The last numbers seen, kept in the store: shown at once as «آخرین قیمت» until fresh ones arrive. */
async function lastSeen(period: Period): Promise<Last | null> {
  const k = await load<Last>(LAST_KEY).catch(() => undefined);
  if (k === undefined || k.period !== period) return null;
  const old = <T extends { live: boolean }>(x: T): T => ({ ...x, live: false });
  return {
    period,
    prices: k.prices === null ? null : { ...old(k.prices), items: k.prices.items.map(old) },
    ticker: k.ticker === null ? null : { ...old(k.ticker), items: k.ticker.items.map(old) },
  };
}
const running = new Map<Period, Promise<Pulled>>();

const within = <T>(p: Promise<T | null>, ms: number): Promise<T | null> =>
  Promise.race([
    p.catch(() => null),
    new Promise<null>((done) => {
      setTimeout(() => {
        done(null);
      }, ms);
    }),
  ]);

/**
 * The market, from what was asked in the last half minute, or asked now. The slide before this one
 * calls it (`warmMarket`) so the numbers are here by the time the money slide comes into view.
 */
function pullMarket(period: Period, force = false): Promise<Pulled> {
  if (!force && cached?.period === period && Date.now() - cached.at < FRESH_MS)
    return Promise.resolve(cached.got);
  const going = running.get(period);
  if (going !== undefined) return going;
  const job = (async (): Promise<Pulled> => {
    const [p, t] = await Promise.all([
      within(paketGet<Prices>(`/v1/market/prices?history=${String(period)}`), PAKET_WAIT_MS),
      within(paketGet<Ticker>("/v1/market/ticker"), PAKET_WAIT_MS),
    ]);
    // Paket's server not answering, or not yet filled: the sources themselves stand in
    let prices = p !== null && p.items.length > 0 ? p : null;
    let ticker = t !== null && t.items.length > 0 ? t : null;
    let later: Promise<void> | null = null;
    if (prices === null || ticker === null) {
      // Paket is unwell: not every client at the same instant (a second at most, so it is not felt)
      await new Promise((done) => setTimeout(done, Math.random() * 1000));
      const d = await directMarket(period).catch(() => null);
      prices ??= d?.prices ?? null;
      ticker ??= d?.ticker ?? null;
      later = d?.later ?? null;
    }
    const got = { prices, ticker, later };
    if (prices !== null || ticker !== null) {
      cached = { period, at: Date.now(), got };
      void save(LAST_KEY, { period, prices, ticker } satisfies Last).catch(() => undefined);
    }
    return got;
  })().finally(() => {
    running.delete(period);
  });
  running.set(period, job);
  return job;
}

/** Asks for the money slide's numbers ahead of time, from the slide above it. */
export function warmMarket(period: Period = 30): void {
  void pullMarket(period).then((g) =>
    g.later?.then(() => {
      void pullMarket(period, true);
    }),
  );
}

/**
 * Asked again every minute while the slide is in view (the server keeps each answer for half a
 * minute); `active` is false while it is scrolled away. Changing `period` asks for that history once; what was shown stays until it arrives.
 */
export function useMarket(period: Period, active = true): Market {
  const [prices, setPrices] = useState<Prices | null>(() =>
    cached?.period === period ? cached.got.prices : null,
  );
  const [ticker, setTicker] = useState<Ticker | null>(() =>
    cached?.period === period ? cached.got.ticker : null,
  );
  const [offline, setOffline] = useState(false);
  // a new tab starts from the last numbers kept, marked as old, until the fresh ones are here
  useEffect(() => {
    if (cached?.period === period) return;
    let live = true;
    void lastSeen(period).then((k) => {
      if (!live || k === null || cached?.period === period) return;
      setPrices((p) => p ?? k.prices);
      setTicker((t) => t ?? k.ticker);
    });
    return () => {
      live = false;
    };
  }, [period]);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const pull = (force = false): void => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        const got = await pullMarket(period, force);
        if (!live) return;
        // the charts arrive when their files have been read; then the card is filled again
        void got.later?.then(() => {
          if (live) pull(true);
        });
        if (got.prices !== null) setPrices(got.prices);
        if (got.ticker !== null) setTicker(got.ticker);
        setOffline(got.prices === null && got.ticker === null);
      })();
    };
    pull();
    const t = setInterval(() => {
      pull();
    }, 60_000);
    const back = (): void => {
      pull();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
    };
  }, [period, active]);
  return { prices, ticker, offline };
}
