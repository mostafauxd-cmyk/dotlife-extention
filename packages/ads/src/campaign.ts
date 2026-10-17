import { z } from "zod";

import { targetingSchema, type Ad, type Targeting } from "./schema";
import { tehranDay } from "./select";
import { PRODUCTS, SALE_MODELS, slotById, TARGETS, type Product, type SaleModel, type Slot } from "./slots";

/**
 * A campaign: what an advertiser buys across the products. It names the products it runs in, and
 * for each the places and who it is for; it carries the bid and the budget. Its ads (creatives) are
 * plain `Ad`s with `campaign` set. When a bundle is made, `allocate` turns bids and budgets into a
 * share of each place, and `compileCampaigns` writes that share, the targeting and the days onto
 * the ads, so a client still only reads a flat list of ads.
 */

export const CAMPAIGN_STATUS = ["draft", "live", "paused", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const productPlanSchema = z.object({
  product: z.enum(PRODUCTS),
  /** The places in this product, by id (`PLACEMENTS`). */
  slots: z.array(z.number().int()).min(1),
  targeting: targetingSchema,
});
export type ProductPlan = z.infer<typeof productPlanSchema>;

export const campaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  advertiser: z.string().min(1),
  status: z.enum(CAMPAIGN_STATUS),
  from: day.optional(),
  until: day.optional(),
  model: z.enum(SALE_MODELS),
  /** Toman per unit of the model: a click, a thousand showings, an action, or a day/month/occasion. */
  bid: z.number().positive(),
  budget: z.object({
    total: z.number().positive(),
    /** At most this much a day; the total spread over the days left when absent. */
    daily: z.number().positive().optional(),
  }),
  products: z.array(productPlanSchema).min(1),
  /** Spent so far (toman); the server keeps it, the panel shows it. */
  spent: z.number().nonnegative().optional(),
});
export type Campaign = z.infer<typeof campaignSchema>;
/** A campaign as written, before defaults (an empty targeting is `{}`). */
export type CampaignInput = z.input<typeof campaignSchema>;

/** Flat-fee models buy the place outright for their days. */
export const SPONSOR_MODELS: readonly SaleModel[] = [
  "daily-sponsor",
  "monthly-sponsor",
  "occasion-sponsor",
];
export const isSponsor = (m: SaleModel): boolean => SPONSOR_MODELS.includes(m);

/** Rough rates that turn a bid into value per showing until real counts exist. */
export type Rates = {
  /** Clicks per showing. */
  ctr: number;
  /** Actions per click, for the pay-per-action models. */
  action: Partial<Record<SaleModel, number>>;
};
export const DEFAULT_RATES: Rates = {
  ctr: 0.012,
  action: { "per-purchase": 0.03, "per-signup": 0.08, "per-sale": 0.02 },
};

/** Share of a city's people among all, for reach; a city not listed counts as small. */
const CITY_SHARE: Record<string, number> = {
  تهران: 0.3,
  مشهد: 0.08,
  اصفهان: 0.06,
  شیراز: 0.05,
  تبریز: 0.05,
  کرج: 0.05,
  اهواز: 0.04,
  قم: 0.03,
  رشت: 0.02,
  کیش: 0.005,
};

const PERSIAN_MONTH = new Intl.DateTimeFormat("en-u-ca-persian", {
  month: "numeric",
  timeZone: "Asia/Tehran",
});
/** The season on the Tehran calendar, in the ids clients send. */
export function seasonOf(now: Date): string {
  const m = Number(PERSIAN_MONTH.format(now));
  if (m <= 3) return "spring";
  if (m <= 6) return "summer";
  if (m <= 9) return "autumn";
  return "winter";
}

/**
 * About what share of a place's showings a targeting can reach today (0–1). An estimate for the
 * forecast, from simple guesses per dimension; a season that is not now reaches no one.
 */
export function estimateReach(t: Targeting, slot: Slot, now: Date): number {
  const allowed = new Set(slot.targets);
  let r = 1;
  if (allowed.has("persona") && t.persona.length > 0) r *= Math.min(1, t.persona.length / 6);
  if (allowed.has("city") && t.city.length > 0)
    r *= Math.min(1, t.city.reduce((s, c) => s + (CITY_SHARE[c] ?? 0.01), 0));
  if (allowed.has("season") && t.season.length > 0) r *= t.season.includes(seasonOf(now)) ? 1 : 0;
  if (allowed.has("occasion") && t.occasion.length > 0) r *= Math.min(1, 0.15 * t.occasion.length);
  if (allowed.has("keyword") && t.keyword.length > 0) r *= Math.min(0.6, 0.04 * t.keyword.length);
  if (allowed.has("topic") && t.topic.length > 0) r *= Math.min(1, t.topic.length / 7);
  if (allowed.has("weekend") && t.weekend) r *= 2 / 7;
  return r;
}

/** The campaign's targeting for one place: only the dimensions that place may be aimed by. */
export function targetingFor(t: Targeting, slot: Slot): Targeting {
  const allowed = new Set<string>(slot.targets);
  const keep = (dim: (typeof TARGETS)[number], v: string[]): string[] => (allowed.has(dim) ? v : []);
  return {
    persona: keep("persona", t.persona),
    city: keep("city", t.city),
    season: keep("season", t.season),
    occasion: keep("occasion", t.occasion),
    keyword: keep("keyword", t.keyword),
    topic: keep("topic", t.topic),
    weekend: allowed.has("weekend") && t.weekend,
  };
}

const DAY_MS = 86_400_000;

/** A campaign runs today when it is live and today is inside its days. */
export function campaignRunning(c: Campaign, now: Date): boolean {
  if (c.status !== "live") return false;
  const t = tehranDay(now);
  return (c.from === undefined || t >= c.from) && (c.until === undefined || t <= c.until);
}

/** What it may spend today: its daily cap, or what is left spread over the days left (30 when open). */
export function dailyBudget(c: Campaign, now: Date): number {
  const left = Math.max(0, c.budget.total - (c.spent ?? 0));
  let days = 30;
  if (c.until !== undefined) {
    const end = Date.parse(`${c.until}T23:59:59+03:30`);
    days = Math.max(1, Math.ceil((end - now.getTime()) / DAY_MS));
  }
  const spread = left / days;
  return c.budget.daily === undefined ? spread : Math.min(c.budget.daily, left);
}

/** What a sponsor pays for one day of its place. */
function sponsorPerDay(c: Campaign): number {
  return c.model === "monthly-sponsor" ? c.bid / 30 : c.bid;
}

/** Value of a thousand showings, the one measure every model is ranked by. */
export function ecpm(c: Campaign, inventory: number, rates: Rates = DEFAULT_RATES): number {
  switch (c.model) {
    case "per-thousand":
      return c.bid;
    case "per-click":
      return c.bid * rates.ctr * 1000;
    case "per-purchase":
    case "per-signup":
    case "per-sale":
      return c.bid * rates.ctr * (rates.action[c.model] ?? 0.02) * 1000;
    case "daily-sponsor":
    case "monthly-sponsor":
    case "occasion-sponsor":
      return (sponsorPerDay(c) / Math.max(1, inventory)) * 1000;
  }
}

export type Limit = "budget" | "reach" | "outbid" | "exclusive" | null;

/** One campaign's part of one place for a day. */
export type Line = {
  campaign: string;
  slot: number;
  product: Product;
  /** Share of the place's showings (0–1). */
  share: number;
  /** Share of showings its targeting can reach (0–1). */
  reach: number;
  ecpm: number;
  impressions: number;
  clicks: number;
  /** Toman a day. */
  spend: number;
  /** What holds it back from more: its budget, its targeting, others' bids, or a sponsor. */
  limit: Limit;
};

export type PlaceForecast = {
  slot: number;
  product: Product;
  inventory: number;
  /** Share of the place sold (the rest is the product's own promotion or empty). */
  sold: number;
  lines: Line[];
};

export type Forecast = {
  places: PlaceForecast[];
  /** Per campaign: what it will spend and get today. */
  campaigns: Map<string, { spend: number; budget: number; impressions: number; clicks: number }>;
};

export type AllocateOptions = {
  rates?: Rates;
  /** Showings a day per place, from real counts; the catalog's guess when absent. */
  inventory?: ReadonlyMap<number, number>;
};

/**
 * Splits each place among the campaigns that want it today. A flat-fee sponsor takes what its
 * targeting reaches outright (the best-paying one first); the rest goes to the others in proportion
 * to the value of their bids (eCPM), no more than their targeting reaches. A campaign whose share
 * would cost more than its daily budget is scaled down across all its places and the freed share
 * goes to the others. What nobody buys is left to the product's own promotion.
 */
export function allocate(
  campaigns: readonly Campaign[],
  now: Date,
  opts: AllocateOptions = {},
): Forecast {
  const rates = opts.rates ?? DEFAULT_RATES;
  type Item = Line & { frozen: boolean };
  const bySlot = new Map<number, Item[]>();
  const running = campaigns.filter((c) => campaignRunning(c, now));
  const byId = new Map(running.map((c) => [c.id, c]));
  const inv = (s: Slot): number => opts.inventory?.get(s.id) ?? s.inventory ?? 10000;

  for (const c of running) {
    for (const plan of c.products) {
      for (const id of plan.slots) {
        const slot = slotById(id);
        if (slot?.product !== plan.product) continue;
        const reach = estimateReach(targetingFor(plan.targeting, slot), slot, now);
        const items = bySlot.get(id) ?? [];
        items.push({
          campaign: c.id,
          slot: id,
          product: plan.product,
          share: 0,
          reach,
          ecpm: ecpm(c, inv(slot) * Math.max(reach, 0.0001), rates),
          impressions: 0,
          clicks: 0,
          spend: 0,
          limit: null,
          frozen: false,
        });
        bySlot.set(id, items);
      }
    }
  }

  // sponsors first: each place goes to the best-paying sponsor that can afford a day of it
  for (const items of bySlot.values()) {
    let free = 1;
    const sponsors = items
      .filter((i) => isSponsor(byId.get(i.campaign)?.model ?? "per-click"))
      .sort((a, b) => b.ecpm - a.ecpm);
    for (const s of sponsors) {
      const c = byId.get(s.campaign);
      s.frozen = true;
      if (c === undefined || sponsorPerDay(c) > dailyBudget(c, now) + 1e-6) {
        s.limit = "budget";
        continue;
      }
      if (free <= 1e-9) {
        s.limit = "exclusive";
        continue;
      }
      s.share = Math.min(free, s.reach);
      free -= s.share;
    }
    for (const i of items) if (!i.frozen && free <= 1e-9) i.limit = "exclusive";
  }

  const fill = (items: Item[]): void => {
    // proportional to eCPM among those not yet fixed, each no more than its reach
    for (let round = 0; round < items.length + 1; round++) {
      const fixed = items.filter((i) => i.frozen).reduce((s, i) => s + i.share, 0);
      const open = items.filter((i) => !i.frozen);
      const free = Math.max(0, 1 - fixed);
      const total = open.reduce((s, i) => s + i.ecpm, 0);
      if (open.length === 0 || total <= 0) return;
      let capped = false;
      for (const i of open) {
        i.share = (free * i.ecpm) / total;
        if (i.share > i.reach) {
          i.share = i.reach;
          i.frozen = true;
          i.limit = "reach";
          capped = true;
        }
      }
      if (!capped) return;
    }
  };

  const spendOf = (i: Item): number => {
    const slot = slotById(i.slot);
    const c = byId.get(i.campaign);
    if (slot === undefined || c === undefined) return 0;
    if (isSponsor(c.model)) return i.share > 0 ? sponsorPerDay(c) : 0;
    return (i.share * inv(slot) * i.ecpm) / 1000;
  };

  for (let round = 0; round < 20; round++) {
    for (const items of bySlot.values()) {
      for (const i of items) if (i.limit !== "budget" && i.limit !== "exclusive" && !isSponsor(byId.get(i.campaign)?.model ?? "per-click")) {
        i.frozen = false;
        i.limit = null;
      }
      fill(items);
    }
    let changed = false;
    for (const c of running) {
      if (isSponsor(c.model)) continue;
      const mine = [...bySlot.values()].flat().filter((i) => i.campaign === c.id);
      const spend = mine.reduce((s, i) => s + spendOf(i), 0);
      const budget = dailyBudget(c, now);
      if (spend > budget * 1.0001) {
        const f = budget / spend;
        for (const i of mine) {
          i.share *= f;
          i.frozen = true;
          i.limit = "budget";
        }
        changed = true;
      }
    }
    if (!changed) break;
    // budget-held lines keep their share; the others are refilled around them
    for (const items of bySlot.values())
      for (const i of items) if (i.limit === "budget") i.frozen = true;
  }

  const places: PlaceForecast[] = [];
  const totals = new Map<string, { spend: number; budget: number; impressions: number; clicks: number }>();
  for (const c of running)
    totals.set(c.id, { spend: 0, budget: dailyBudget(c, now), impressions: 0, clicks: 0 });
  for (const [id, items] of bySlot) {
    const slot = slotById(id);
    if (slot === undefined) continue;
    const inventory = inv(slot);
    const lines: Line[] = items
      .map(({ frozen: _f, ...i }) => {
        const c = byId.get(i.campaign);
        const impressions = Math.round(i.share * inventory);
        const clicks = Math.round(impressions * rates.ctr);
        const spend = spendOf({ ...i, frozen: false });
        if (i.limit === null && c !== undefined && items.some((o) => o !== i && o.ecpm > i.ecpm) && i.share < i.reach)
          return { ...i, impressions, clicks, spend, limit: "outbid" as const };
        return { ...i, impressions, clicks, spend };
      })
      .sort((a, b) => b.share - a.share);
    for (const l of lines) {
      const t = totals.get(l.campaign);
      if (t === undefined) continue;
      t.spend += l.spend;
      t.impressions += l.impressions;
      t.clicks += l.clicks;
    }
    places.push({
      slot: id,
      product: slot.product,
      inventory,
      sold: Math.min(1, lines.reduce((s, l) => s + l.share, 0)),
      lines,
    });
  }
  places.sort((a, b) => a.slot - b.slot);
  return { places, campaigns: totals };
}

/**
 * The ads a bundle carries for the campaigns: each creative gets its campaign's targeting for its
 * place, the campaign's days and price, and the chance it is drawn for a person it fits (its line's
 * share over its reach, split among the campaign's creatives in that place). Ads outside a campaign
 * pass through as they are; creatives of campaigns that are not running are left out.
 */
export function compileCampaigns(
  campaigns: readonly Campaign[],
  ads: readonly Ad[],
  now: Date,
  opts: AllocateOptions = {},
): Ad[] {
  const forecast = allocate(campaigns, now, opts);
  const lines = new Map<string, Line>();
  for (const p of forecast.places) for (const l of p.lines) lines.set(`${l.campaign}:${String(l.slot)}`, l);
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const out: Ad[] = [];
  for (const ad of ads) {
    if (ad.campaign === undefined) {
      out.push(ad);
      continue;
    }
    const c = byId.get(ad.campaign);
    const slot = slotById(ad.slot);
    if (c === undefined || slot === undefined || !campaignRunning(c, now)) continue;
    if (ad.status === "draft" || ad.status === "paused" || ad.status === "ended") continue;
    const plan = c.products.find((p) => p.product === slot.product && p.slots.includes(slot.id));
    const line = lines.get(`${c.id}:${String(slot.id)}`);
    if (plan === undefined || line === undefined || line.share <= 0) continue;
    const siblings = ads.filter(
      (a) => a.campaign === c.id && a.slot === slot.id && a.status !== "draft" && a.status !== "paused" && a.status !== "ended",
    ).length;
    const share = Math.min(1, line.share / Math.max(line.reach, 1e-6) / Math.max(1, siblings));
    const { from: _from, until: _until, price: _price, ...rest } = ad;
    out.push({
      ...rest,
      status: "live",
      products: [slot.product],
      targeting: targetingFor(plan.targeting, slot),
      ...(c.from === undefined ? {} : { from: c.from }),
      ...(c.until === undefined ? {} : { until: c.until }),
      model: c.model,
      price: c.bid,
      share: Math.round(share * 10000) / 10000,
      // older clients rank by weight alone; keep the order the shares give
      weight: Math.max(1, Math.min(100, Math.round(share * 100))),
    });
  }
  return out;
}
