import { tehranDay, type Ad, type Product } from "@dotlife/ads";

import type { KeyValueStorage } from "./store";

/**
 * What the dashboard counts: showings and clicks of an ad, by day. A client will POST these to
 * `/v1/ads/events` (docs/ads-api.md) with no personal id; here a local stub holds the counts so the
 * dashboard has something to read. Counts are kept as daily totals, never as one row per showing.
 */

export type AdEvent = {
  ad: string;
  slot: number;
  product: Product;
  kind: "impression" | "click";
  /** Tehran day; today when absent. */
  day?: string;
  /** How many at once; 1 when absent. */
  count?: number;
};

export type StatRow = {
  day: string;
  product: Product;
  slot: number;
  ad: string;
  impressions: number;
  clicks: number;
};

export interface EventsStore {
  record(event: AdEvent): Promise<void>;
  stats(): Promise<StatRow[]>;
  clear(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export const EVENTS_KEY = "ads-admin.events";

const key = (r: Pick<StatRow, "day" | "product" | "slot" | "ad">): string =>
  `${r.day}|${r.product}|${String(r.slot)}|${r.ad}`;

export class LocalEventsStore implements EventsStore {
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: KeyValueStorage = localStorage) {}

  private read(): StatRow[] {
    const raw = this.storage.getItem(EVENTS_KEY);
    if (raw === null) return [];
    try {
      const json: unknown = JSON.parse(raw);
      return Array.isArray(json) ? (json as StatRow[]) : [];
    } catch {
      return [];
    }
  }

  private write(rows: StatRow[]): void {
    this.storage.setItem(EVENTS_KEY, JSON.stringify(rows));
    for (const l of [...this.listeners]) l();
  }

  record(event: AdEvent): Promise<void> {
    const rows = this.read();
    const day = event.day ?? tehranDay(new Date());
    const k = key({ day, product: event.product, slot: event.slot, ad: event.ad });
    let row = rows.find((r) => key(r) === k);
    if (row === undefined) {
      row = {
        day,
        product: event.product,
        slot: event.slot,
        ad: event.ad,
        impressions: 0,
        clicks: 0,
      };
      rows.push(row);
    }
    const n = event.count ?? 1;
    if (event.kind === "impression") row.impressions += n;
    else row.clicks += n;
    this.write(rows);
    return Promise.resolve();
  }

  stats(): Promise<StatRow[]> {
    return Promise.resolve(this.read());
  }

  clear(): Promise<void> {
    this.storage.removeItem(EVENTS_KEY);
    for (const l of [...this.listeners]) l();
    return Promise.resolve();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export type Totals = { impressions: number; clicks: number };
export const emptyTotals = (): Totals => ({ impressions: 0, clicks: 0 });
/** Clicks over showings, 0 when nothing was shown. */
export const ctr = (t: Totals): number => (t.impressions === 0 ? 0 : t.clicks / t.impressions);

export type Summary = {
  total: Totals;
  bySlot: Map<number, Totals>;
  byAd: (Totals & { ad: string; slot: number })[];
};

export type StatsFilter = {
  product: Product | "all";
  /** The first day counted (inclusive); everything when absent. */
  since?: string | undefined;
};

export function summarize(rows: readonly StatRow[], f: StatsFilter): Summary {
  const total = emptyTotals();
  const bySlot = new Map<number, Totals>();
  const byAd = new Map<string, Totals & { ad: string; slot: number }>();
  for (const r of rows) {
    if (f.product !== "all" && r.product !== f.product) continue;
    if (f.since !== undefined && r.day < f.since) continue;
    total.impressions += r.impressions;
    total.clicks += r.clicks;
    const s = bySlot.get(r.slot) ?? emptyTotals();
    s.impressions += r.impressions;
    s.clicks += r.clicks;
    bySlot.set(r.slot, s);
    const a = byAd.get(r.ad) ?? { ...emptyTotals(), ad: r.ad, slot: r.slot };
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    byAd.set(r.ad, a);
  }
  return { total, bySlot, byAd: [...byAd.values()].sort((a, b) => b.impressions - a.impressions) };
}

/** The first day to count for «the last N days», on the Tehran calendar. */
export function sinceDay(now: Date, days: number): string {
  return tehranDay(new Date(now.getTime() - (days - 1) * 86_400_000));
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Made-up counts for the last `days` days of each ad, so the dashboard can be seen working. */
export function demoEvents(ads: readonly Ad[], now: Date, days = 14, seed = 7): AdEvent[] {
  const rand = rng(seed);
  const out: AdEvent[] = [];
  for (const ad of ads) {
    const base = 300 + Math.floor(rand() * 1700);
    const rate = 0.004 + rand() * 0.05;
    for (let i = 0; i < days; i++) {
      const day = tehranDay(new Date(now.getTime() - i * 86_400_000));
      const shown = Math.floor(base * (0.6 + rand() * 0.8));
      const clicked = Math.floor(shown * rate * (0.7 + rand() * 0.6));
      for (const product of ad.products) {
        out.push({ ad: ad.id, slot: ad.slot, product, kind: "impression", day, count: shown });
        out.push({ ad: ad.id, slot: ad.slot, product, kind: "click", day, count: clicked });
      }
    }
  }
  return out;
}
