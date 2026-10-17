import {
  adSchema,
  bundleSchema,
  campaignSchema,
  compileCampaigns,
  inSchedule,
  MAX_PER_SLIDE,
  placementsOf,
  tehranDay,
  type Ad,
  type AdStatus,
  type Bundle,
  type Campaign,
  type Product,
  type Slot,
} from "@dotlife/ads";

import { normalize, num, type Phase } from "./labels";
import { issueMessage } from "./validate";

/** The pure rules of the panel: what an ad is today, what fills a slot, filtering, bulk edits, bundles. */

export type Campaigns = ReadonlyMap<string, Campaign>;

/** What a campaign is today: its status read against its days. */
export function campaignPhase(c: Campaign, now: Date): Phase {
  if (c.status !== "live") return c.status;
  const today = tehranDay(now);
  if (c.until !== undefined && today > c.until) return "ended";
  if (c.from !== undefined && today < c.from) return "scheduled";
  return "live";
}

/**
 * What an ad is today: its status, read against its days the way a client's `pickAd` reads them.
 * A campaign's creative is also held by its campaign: it runs only while the campaign does.
 */
export function adPhase(ad: Ad, now: Date, campaigns?: Campaigns): Phase {
  if (ad.status === "draft" || ad.status === "paused" || ad.status === "ended") return ad.status;
  if (ad.campaign !== undefined) {
    const c = campaigns?.get(ad.campaign);
    return c === undefined ? "draft" : campaignPhase(c, now);
  }
  if (inSchedule(ad, now)) return "live";
  const today = tehranDay(now);
  if (ad.until !== undefined && today > ad.until) return "ended";
  return "scheduled";
}

export type SlotFill = {
  kind: "live" | "scheduled" | "house" | "empty";
  /** The ad a client would draw first (the heaviest live one), or the next to start. */
  ad: Ad | undefined;
  live: number;
  scheduled: number;
};

const heaviest = (a: Ad, b: Ad): number => b.weight - a.weight;

/** What fills one slot today: sold and live, sold for later, the product's own promotion, or nothing. */
export function slotFill(
  slot: Slot,
  ads: readonly Ad[],
  now: Date,
  campaigns?: Campaigns,
): SlotFill {
  const mine = ads.filter((a) => a.slot === slot.id);
  const live = mine.filter((a) => adPhase(a, now, campaigns) === "live").sort(heaviest);
  const later = mine
    .filter((a) => adPhase(a, now, campaigns) === "scheduled")
    .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
  const base = { live: live.length, scheduled: later.length };
  if (live[0] !== undefined) return { kind: "live", ad: live[0], ...base };
  if (slot.house) return { kind: "house", ad: later[0], ...base };
  if (later[0] !== undefined) return { kind: "scheduled", ad: later[0], ...base };
  return { kind: "empty", ad: undefined, ...base };
}

/** A slide of the new tab, or a screen of an app. */
export type Slide = { product: Product; name: string; slots: Slot[] };

/** A product's places grouped by slide or screen, in the catalog's order. */
export function slides(product: Product = "newtab"): Slide[] {
  const out: Slide[] = [];
  for (const s of placementsOf(product)) {
    const same = out.find((g) => g.name === s.slide);
    if (same !== undefined) same.slots.push(s);
    else out.push({ product, name: s.slide, slots: [s] });
  }
  return out;
}

/** How many of a slide's slots have a live ad today; a client draws at most `MAX_PER_SLIDE`. */
export function slideFilled(
  slide: Slide,
  ads: readonly Ad[],
  now: Date,
  campaigns?: Campaigns,
): number {
  return slide.slots.filter((s) => slotFill(s, ads, now, campaigns).kind === "live").length;
}
export const overfilled = (filled: number): boolean => filled > MAX_PER_SLIDE;

export type AdFilter = {
  slot?: number | undefined;
  phase?: Phase | undefined;
  product?: Product | undefined;
  advertiser?: string | undefined;
  q?: string | undefined;
};

const haystack = (a: Ad): string =>
  normalize(
    [
      a.id,
      a.title,
      a.line ?? "",
      a.advertiser,
      a.cta ?? "",
      ...Object.values(a.extra ?? {}),
      ...a.targeting.keyword,
      ...a.targeting.city,
      ...a.targeting.occasion,
      ...a.targeting.topic,
    ].join(" "),
  );

export function filterAds(ads: readonly Ad[], f: AdFilter, now: Date, campaigns?: Campaigns): Ad[] {
  const q = f.q === undefined ? "" : normalize(f.q);
  return ads.filter(
    (a) =>
      (f.slot === undefined || a.slot === f.slot) &&
      (f.phase === undefined || adPhase(a, now, campaigns) === f.phase) &&
      (f.product === undefined || a.products.includes(f.product)) &&
      (f.advertiser === undefined || a.advertiser === f.advertiser) &&
      (q === "" || haystack(a).includes(q)),
  );
}

/** The advertisers there are, once each, in the order they first appear. */
export const advertisers = (ads: readonly Ad[]): string[] => [
  ...new Set(ads.map((a) => a.advertiser)),
];

/** Pauses what is running or waiting; a draft, an ended or a paused ad stays as it is. */
export function pauseAds(ads: readonly Ad[], ids: ReadonlySet<string>): Ad[] {
  return ads
    .filter((a) => ids.has(a.id) && (a.status === "live" || a.status === "scheduled"))
    .map((a) => ({ ...a, status: "paused" satisfies AdStatus }));
}

/** Resumes paused ads; they run again inside their days. */
export function resumeAds(ads: readonly Ad[], ids: ReadonlySet<string>): Ad[] {
  return ads
    .filter((a) => ids.has(a.id) && a.status === "paused")
    .map((a) => ({ ...a, status: "live" satisfies AdStatus }));
}

export function newAdId(
  now: Date = new Date(),
  rand: () => number = Math.random,
  prefix = "ad",
): string {
  return `${prefix}-${now.getTime().toString(36)}${Math.floor(rand() * 36 ** 3)
    .toString(36)
    .padStart(3, "0")}`;
}

/** A copy that starts as a draft, so it never goes live by accident. */
export function duplicateAd(ad: Ad, id: string): Ad {
  return { ...ad, id, status: "draft", title: `${ad.title} (کپی)` };
}

/** Sent to clients: what is live or waiting for its day, and whose last day has not passed. */
export function publishable(ad: Ad, now: Date): boolean {
  if (ad.status !== "live" && ad.status !== "scheduled") return false;
  return ad.until === undefined || tehranDay(now) <= ad.until;
}

/**
 * The next bundle: campaign creatives compiled with their campaign's targeting, days and share
 * (`compileCampaigns`), and the other ads that are live or waiting, in id order. A campaign that
 * starts later joins the bundle made on or after its first day.
 */
export function buildBundle(
  ads: readonly Ad[],
  previousVersion: number,
  now: Date,
  campaigns: readonly Campaign[] = [],
): Bundle {
  const list = compileCampaigns(campaigns, ads, now)
    .filter((a) => publishable(a, now))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { version: previousVersion + 1, generatedAt: now.toISOString(), ads: list };
}

/** JSON with sorted keys and no spaces: the one text a signature is made over. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return value === undefined ? "null" : JSON.stringify(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** What the signature field shows until the server signs a bundle (ed25519 over `canonicalJson(ads)`). */
export const SIGNATURE_PLACEHOLDER = "<ed25519 · base64 · امضای سرور>";

export type ImportResult =
  | { ok: true; ads: Ad[]; campaigns: Campaign[]; source: "bundle" | "list"; version?: number }
  | { ok: false; error: string; issues: string[] };

/** Reads a bundle's JSON (or a bare list of ads), checking every ad with the shared schema. */
/** A file bigger than this is refused before it is read. */
export const MAX_IMPORT_CHARS = 5_000_000;

export function parseImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_CHARS)
    return { ok: false, error: "فایل بزرگ‌تر از ۵ مگابایت است.", issues: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "این متن JSON معتبر نیست.", issues: [] };
  }
  const isList = Array.isArray(raw);
  const parsed = isList ? adSchema.array().safeParse(raw) : bundleSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 12).map((i) => {
      const at = i.path.map(String).find((p) => /^\d+$/.test(p));
      return at === undefined
        ? issueMessage(i)
        : `تبلیغ ${num(Number(at) + 1)}: ${issueMessage(i)}`;
    });
    return { ok: false, error: "ساختار فایل با قالب تبلیغ‌ها نمی‌خواند.", issues };
  }
  const ads = Array.isArray(parsed.data) ? parsed.data : parsed.data.ads;
  const ids = new Set<string>();
  for (const a of ads) {
    if (ids.has(a.id))
      return { ok: false, error: `شناسه‌ی «${a.id}» بیش از یک بار آمده است.`, issues: [] };
    ids.add(a.id);
  }
  // a full export also carries the campaigns; a client's bundle does not
  const rawCampaigns =
    !isList && typeof raw === "object" && raw !== null && "campaigns" in raw ? raw.campaigns : [];
  const camps = campaignSchema.array().safeParse(rawCampaigns);
  if (!camps.success)
    return { ok: false, error: "کمپین‌های فایل با قالب کمپین نمی‌خوانند.", issues: [] };
  return Array.isArray(parsed.data)
    ? { ok: true, ads, campaigns: [], source: "list" }
    : { ok: true, ads, campaigns: camps.data, source: "bundle", version: parsed.data.version };
}

export type ImportPlan = { added: number; updated: number; removed: number; result: Ad[] };

/** What importing would do: `merge` adds and updates by id, `replace` swaps the whole list. */
export function planImport(
  current: readonly Ad[],
  incoming: readonly Ad[],
  mode: "merge" | "replace",
): ImportPlan {
  const have = new Map(current.map((a) => [a.id, a]));
  const inIds = new Set(incoming.map((a) => a.id));
  const added = incoming.filter((a) => !have.has(a.id)).length;
  const updated = incoming.length - added;
  if (mode === "replace")
    return {
      added,
      updated,
      removed: current.filter((a) => !inIds.has(a.id)).length,
      result: [...incoming],
    };
  const merged = current.map((a) => incoming.find((i) => i.id === a.id) ?? a);
  return {
    added,
    updated,
    removed: 0,
    result: [...merged, ...incoming.filter((a) => !have.has(a.id))],
  };
}

/** A copy of a campaign that starts as a draft, its spend at zero. */
export function duplicateCampaign(c: Campaign, id: string): Campaign {
  const { spent: _spent, ...rest } = c;
  return { ...rest, id, status: "draft", name: `${c.name} (کپی)` };
}

export const campaignMap = (list: readonly Campaign[]): Campaigns =>
  new Map(list.map((c) => [c.id, c]));
