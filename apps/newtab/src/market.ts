import { useEffect, useState } from "react";

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

/** Each row's round badge: its letter and colour (the server sends the name, the look is ours). */
const GOLD = "linear-gradient(135deg,#F6D98A,#B8862B)";
export const BADGE: Record<string, { glyph: string; bg: string; dark?: boolean }> = {
  gold18: { glyph: "۱۸", bg: GOLD, dark: true },
  gold24: { glyph: "۲۴", bg: GOLD, dark: true },
  mesghal: { glyph: "م", bg: GOLD, dark: true },
  coin_emami: { glyph: "س", bg: GOLD, dark: true },
  coin_half: { glyph: "ن", bg: GOLD, dark: true },
  usd: { glyph: "$", bg: "#2F7D5B" },
  eur: { glyph: "€", bg: "#2F5FAD" },
  gbp: { glyph: "£", bg: "#6B3FA0" },
  aed: { glyph: "د", bg: "#9A6A2E" },
  usdt: { glyph: "₮", bg: "#26A17B" },
  xau: { glyph: "Au", bg: GOLD, dark: true },
  xag: { glyph: "Ag", bg: "linear-gradient(135deg,#E3E7EC,#8D96A0)", dark: true },
  xpt: { glyph: "Pt", bg: "#7C8794" },
  btc: { glyph: "₿", bg: "#F7931A" },
  eth: { glyph: "Ξ", bg: "#627EEA" },
  sol: { glyph: "S", bg: "#9945FF" },
  ton: { glyph: "T", bg: "#0098EA" },
  bnb: { glyph: "B", bg: "#E0A90E" },
  trx: { glyph: "T", bg: "#EB0029" },
  doge: { glyph: "D", bg: "#C2A633" },
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
      void Promise.all([
        paketGet<Prices>(`/v1/market/prices?history=${String(period)}`).catch(() => null),
        paketGet<Ticker>("/v1/market/ticker").catch(() => null),
      ]).then(([p, t]) => {
        if (!live) return;
        if (p !== null) setPrices(p);
        if (t !== null) setTicker(t);
        setOffline(p === null && t === null);
      });
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
