import { useEffect, useState } from "react";

import { directMarket } from "./marketDirect";
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

/**
 * Asked again every minute while the slide is in view (the server keeps each answer for half a
 * minute); `active` is false while it is scrolled away. Changing `period` asks for that history once; what was shown stays until it arrives.
 */
export function useMarket(period: Period, active = true): Market {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const pull = (): void => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        const [p, t] = await Promise.all([
          paketGet<Prices>(`/v1/market/prices?history=${String(period)}`).catch(() => null),
          paketGet<Ticker>("/v1/market/ticker").catch(() => null),
        ]);
        // Paket's server not answering, or not yet filled: the sources themselves stand in
        let prices = p !== null && p.items.length > 0 ? p : null;
        let ticker = t !== null && t.items.length > 0 ? t : null;
        if (prices === null || ticker === null) {
          const d = await directMarket(period).catch(() => null);
          prices ??= d?.prices ?? null;
          ticker ??= d?.ticker ?? null;
          // the charts arrive when their files have been read; then the card is filled again
          void d?.later?.then(() => {
            if (live) pull();
          });
        }
        if (!live) return;
        if (prices !== null) setPrices(prices);
        if (ticker !== null) setTicker(ticker);
        setOffline(prices === null && ticker === null);
      })();
    };
    pull();
    const t = setInterval(pull, 60_000);
    document.addEventListener("visibilitychange", pull);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [period, active]);
  return { prices, ticker, offline };
}
