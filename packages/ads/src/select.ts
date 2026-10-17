import type { Ad } from "./schema";
import { MAX_PER_SLIDE, slotById } from "./slots";

/** What a client knows when it asks for an ad. Nothing here comes from a person's own content. */
export type AdContext = {
  product: "newtab" | "noghte" | "paket";
  now: Date;
  persona?: string | null;
  city?: string | null;
  season?: string | null;
  occasion?: string | null;
  /** What was typed in a search (slots 4 and 9). */
  keyword?: string | null;
  topic?: string | null;
  weekend?: boolean;
  /** Paket Plus: sees nothing but the partner's purchase item (slot 10). */
  plus?: boolean;
  /** Slots already filled on this slide. */
  filledOnSlide?: number;
  /** The person has not agreed to ads (`/ads/consent`). */
  consent: boolean;
  /** Ads closed or already counted for the day, by id. */
  dismissed?: ReadonlySet<string>;
};

/** The Tehran calendar day of a moment, as `YYYY-MM-DD`. */
export const tehranDay = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d);

/** An ad's days: it is live when its status says so and today is inside from…until. */
export function inSchedule(ad: Ad, now: Date): boolean {
  if (ad.status !== "live" && ad.status !== "scheduled") return false;
  const t = tehranDay(now);
  if (ad.from !== undefined && t < ad.from) return false;
  if (ad.until !== undefined && t > ad.until) return false;
  return true;
}

const hit = (wanted: readonly string[], have: string | null | undefined): boolean =>
  wanted.length === 0 || (have !== null && have !== undefined && wanted.includes(have));

function fits(ad: Ad, c: AdContext): boolean {
  const t = ad.targeting;
  if (!hit(t.persona, c.persona) || !hit(t.city, c.city) || !hit(t.season, c.season)) return false;
  if (!hit(t.occasion, c.occasion) || !hit(t.topic, c.topic)) return false;
  if (t.weekend && c.weekend !== true) return false;
  if (t.keyword.length > 0) {
    const k = (c.keyword ?? "").trim().toLowerCase();
    if (k === "" || !t.keyword.some((w) => k.includes(w.toLowerCase()))) return false;
  }
  return true;
}

/**
 * The ad for one slot, or null. The rules of the design: nothing without consent; a Plus subscriber
 * sees only slot 10; at most three slots filled on a slide; scheduled and aimed by the context only.
 */
export function pickAd(ads: readonly Ad[], slot: number, c: AdContext): Ad | null {
  const def = slotById(slot);
  if (def === undefined || !c.consent) return null;
  if (c.plus === true && slot !== 10) return null;
  if ((c.filledOnSlide ?? 0) >= MAX_PER_SLIDE) return null;
  const pool = ads.filter(
    (a) =>
      a.slot === slot &&
      a.products.includes(c.product) &&
      inSchedule(a, c.now) &&
      c.dismissed?.has(a.id) !== true &&
      fits(a, c),
  );
  if (pool.length === 0) return null;
  // the heaviest first; the day decides among equals, so a person sees a steady one all day
  const day = Number(tehranDay(c.now).replaceAll("-", ""));
  return [...pool].sort((a, b) => b.weight - a.weight || (hashId(a.id) + day) % 7 - (hashId(b.id) + day) % 7)[0] ?? null;
}

function hashId(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
