import { z } from "zod";

import { PRODUCTS, SALE_MODELS, TARGETS } from "./slots";

/**
 * One ad, as the admin panel writes it and a client draws it. Aimed only by who the person is
 * (persona, city), when it is (season, occasion, weekend) and what they typed in a search — never by
 * anything they wrote or own. The look is a few fields, drawn in the client's own components.
 */

export const AD_STATUS = ["draft", "scheduled", "live", "paused", "ended"] as const;
export type AdStatus = (typeof AD_STATUS)[number];

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Who and when an ad is for. An empty list means everyone on that dimension. */
export const targetingSchema = z
  .object({
    persona: z.array(z.string()).default([]),
    city: z.array(z.string()).default([]),
    season: z.array(z.string()).default([]),
    occasion: z.array(z.string()).default([]),
    keyword: z.array(z.string()).default([]),
    topic: z.array(z.string()).default([]),
    weekend: z.boolean().default(false),
  })
  .default({
    persona: [],
    city: [],
    season: [],
    occasion: [],
    keyword: [],
    topic: [],
    weekend: false,
  });
export type Targeting = z.infer<typeof targetingSchema>;

export const adSchema = z.object({
  id: z.string().min(1),
  /** Which place (`PLACEMENTS`): 1–15 in the new tab, 101… in Noghte, 201… in Paket. */
  slot: z.number().int().min(1).max(999),
  /** Which product's clients may draw it. */
  products: z.array(z.enum(PRODUCTS)).min(1),
  status: z.enum(AD_STATUS),
  advertiser: z.string().min(1),
  /** What the box says. */
  title: z.string().min(1),
  line: z.string().optional(),
  /** The button or tile's words («عضویت»، «+ برنامه»). */
  cta: z.string().optional(),
  url: z.url(),
  /** A glyph (one letter) and colours for the round or square mark when there is no picture. */
  glyph: z.string().max(3).optional(),
  tint: color.optional(),
  image: z.url().optional(),
  /** Slot-specific extras: the folder a tile goes in, a template's body, a symbol's price. */
  extra: z.record(z.string(), z.string()).optional(),
  targeting: targetingSchema,
  /** First and last day shown (Tehran days, inclusive). */
  from: day.optional(),
  until: day.optional(),
  /** Higher wins when several fit one slot. */
  weight: z.number().int().min(1).max(100).default(1),
  model: z.enum(SALE_MODELS),
  /** What the advertiser pays per unit of the model (toman); informational for the dashboard. */
  price: z.number().nonnegative().optional(),
  /** Daily cap on showings across all people; the server stops sending the ad when reached. */
  dailyCap: z.number().int().positive().optional(),
  /** The campaign this ad is a creative of; its targeting, days and price come from there. */
  campaign: z.string().optional(),
  /**
   * The chance this ad is drawn for a person it fits, worked out from bids and budgets when the
   * bundle is made (`allocate`). Absent on ads outside a campaign, which go by `weight` alone.
   */
  share: z.number().min(0).max(1).optional(),
});
export type Ad = z.infer<typeof adSchema>;

/** A signed list of ads for a period, which a client picks from on the device. */
export const bundleSchema = z.object({
  version: z.number().int().nonnegative(),
  generatedAt: z.string(),
  /** ed25519 over the canonical JSON of `ads`, base64; absent in the local sample. */
  signature: z.string().optional(),
  ads: z.array(adSchema),
});
export type Bundle = z.infer<typeof bundleSchema>;

export { TARGETS };
