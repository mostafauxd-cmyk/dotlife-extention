/**
 * What the server tells every install about itself (`GET /config`, ROADMAP step 2/3): which
 * versions still work, where the newer one is, and which parts of the app are switched on.
 *
 * Every flag is a way to switch something *off* from the server without a new build — a part that
 * breaks, costs too much, or is cut off from Iran. Each defaults to on, so a phone that never
 * reached the server (or a server with no settings) behaves exactly as the build was made.
 */

import { parseImage, text, type SizedImage } from "./fields";
import { parseNotices, type Notice } from "./notice";
import { NO_PROMOS, parsePromos, type Promos } from "./promo";

export { MEDIA_FILE, MEDIA_PATH, type SizedImage } from "./fields";

export const FLAGS = [
  /** Backup and sync (step 17): pushing and pulling the account's records. */
  "sync",
  /** Signing in with a code by SMS (sms.ir costs per message). */
  "signin.phone",
  /** Signing in with a code by email. */
  "signin.email",
  /** Signing in with Google. */
  "signin.google",
  /** «جلسه‌ی Google Meet» on an event (needs Google's approval of the Meet scope). */
  "meet",
  /** Downloadable content: occasion packs, wallpapers, muezzin recordings (the server's traffic). */
  "content",
  /** The forecast and air quality from Open-Meteo, a third party. */
  "weather",
  /** The qibla finder's map mode (map tiles from a third party). */
  "qibla.map",
] as const;

export type Flag = (typeof FLAGS)[number];

export type Flags = Readonly<Record<Flag, boolean>>;

export const ALL_ON: Flags = Object.fromEntries(FLAGS.map((f) => [f, true])) as Record<
  Flag,
  boolean
>;

/** Where a build was installed from: each has its own page to update from. */
export const CHANNELS = ["play", "bazaar", "myket", "direct"] as const;
export type Channel = (typeof CHANNELS)[number];

export type AppConfig = {
  /** Older than this cannot go on: the app asks for the update and waits. */
  minVersion: string;
  /** The newest version out; older ones are offered it, once per version. */
  latestVersion: string;
  /** The update page of each channel; one left out falls back to the app's own. */
  links: Readonly<Partial<Record<Channel, string>>>;
  /** What the newest version brings, shown in the update sheet; null = the app's own words. */
  whatsNew: WhatsNew | null;
  /**
   * A store's own versions, where it is not where the others are: Bazaar's review takes days and
   * Play rolls out by steps, so a version is offered — and above all required — in a store only
   * once it is out there. A field left out follows the top-level one.
   */
  channels: Readonly<Partial<Record<Channel, ChannelVersions>>>;
  flags: Flags;
  /** The sponsors' cards, per place in the app (`promo.ts`); none unless the server lists one. */
  promos: Promos;
  /** Promotional notices the phone shows at their time (`notice.ts`); none unless listed. */
  notices: readonly Notice[];
};

export type ChannelVersions = { minVersion?: string; latestVersion?: string };

export type Versions = { minVersion: string; latestVersion: string };

/**
 * The update sheet's content, written on the server for each version: a title, a few short items,
 * and a picture. Its size is given so the sheet keeps its place while the picture loads.
 */
export type WhatsNew = {
  /** Replaces «نسخه‌ی تازه‌ی نقطه آمده»; null = that. */
  title: string | null;
  /** One line each; at most `MAX_ITEMS`. */
  items: readonly string[];
  image: WhatsNewImage | null;
};

export type WhatsNewImage = SizedImage;

export const MAX_ITEMS = 6;
const MAX_ITEM = 140;
const MAX_TITLE = 80;

export const DEFAULT_CONFIG: AppConfig = {
  minVersion: "0.0.0",
  latestVersion: "0.0.0",
  links: {},
  whatsNew: null,
  channels: {},
  flags: ALL_ON,
  promos: NO_PROMOS,
  notices: [],
};

const VERSION = /^\d{1,4}(\.\d{1,4}){0,3}$/;

export const isVersion = (v: unknown): v is string => typeof v === "string" && VERSION.test(v);

/** Compares dotted versions part by part (`0.10.0` is after `0.9.3`); a missing part is 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export type UpdateNeed = "none" | "offer" | "required";

/** The newest is never older than the oldest that works. */
const settled = (minVersion: string, latest: string): Versions => ({
  minVersion,
  latestVersion: compareVersions(latest, minVersion) < 0 ? minVersion : latest,
});

/** The versions for a build from this store: its own where set, else the top-level ones. */
export function versionsFor(config: AppConfig, channel: Channel | null): Versions {
  const own = channel === null ? undefined : config.channels[channel];
  return settled(own?.minVersion ?? config.minVersion, own?.latestVersion ?? config.latestVersion);
}

/** What this version should do: nothing, offer the newer one, or not go on without it. */
export function updateNeed(
  current: string,
  config: AppConfig,
  channel: Channel | null,
): UpdateNeed {
  if (!isVersion(current)) return "none";
  const v = versionsFor(config, channel);
  if (compareVersions(current, v.minVersion) < 0) return "required";
  if (compareVersions(current, v.latestVersion) < 0) return "offer";
  return "none";
}

export const isChannel = (v: unknown): v is Channel => CHANNELS.some((c) => c === v);

const isHttpsOrStore = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 500 && /^(https:|market:|bazaar:|myket:)/.test(v);

/** The update sheet's content, field by field; nothing to show = null. */
export function parseWhatsNew(input: unknown): WhatsNew | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? o.items
        .map((i) => text(i, MAX_ITEM))
        .filter((i): i is string => i !== null)
        .slice(0, MAX_ITEMS)
    : [];
  // a picture without its size would make the sheet jump when it arrives: left out
  const image = parseImage(o.image);
  const title = text(o.title, MAX_TITLE);
  return title === null && items.length === 0 && image === null ? null : { title, items, image };
}

/**
 * Reads a config from untrusted JSON, field by field: whatever is missing or wrong takes its
 * default, so one bad field never switches the whole app off or blocks it. An unknown flag is
 * ignored (a newer server); a flag this version knows but the server left out stays on.
 */
export function parseAppConfig(input: unknown): AppConfig {
  const o =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const minVersion = isVersion(o.minVersion) ? o.minVersion : DEFAULT_CONFIG.minVersion;
  const latest = isVersion(o.latestVersion) ? o.latestVersion : DEFAULT_CONFIG.latestVersion;

  const links: Partial<Record<Channel, string>> = {};
  if (typeof o.links === "object" && o.links !== null) {
    const l = o.links as Record<string, unknown>;
    for (const c of CHANNELS) {
      const v = l[c];
      if (isHttpsOrStore(v)) links[c] = v;
    }
  }

  const flags: Record<Flag, boolean> = { ...ALL_ON };
  if (typeof o.flags === "object" && o.flags !== null) {
    const f = o.flags as Record<string, unknown>;
    for (const k of FLAGS) {
      const v = f[k];
      if (typeof v === "boolean") flags[k] = v;
    }
  }

  const channels: Partial<Record<Channel, ChannelVersions>> = {};
  if (typeof o.channels === "object" && o.channels !== null) {
    const ch = o.channels as Record<string, unknown>;
    for (const c of CHANNELS) {
      const v = ch[c];
      if (typeof v !== "object" || v === null) continue;
      const r = v as Record<string, unknown>;
      const own: ChannelVersions = {
        ...(isVersion(r.minVersion) ? { minVersion: r.minVersion } : {}),
        ...(isVersion(r.latestVersion) ? { latestVersion: r.latestVersion } : {}),
      };
      if (own.minVersion !== undefined || own.latestVersion !== undefined) channels[c] = own;
    }
  }

  return {
    ...settled(minVersion, latest),
    links,
    whatsNew: parseWhatsNew(o.whatsNew),
    channels,
    flags,
    promos: parsePromos(o.promos),
    notices: parseNotices(o.notices),
  };
}

/** The headers every request carries, so the server knows which build is asking. */
export const VERSION_HEADER = "x-app-version";
export const CHANNEL_HEADER = "x-app-channel";

/** The server's answer to a version too old for it (HTTP 426 Upgrade Required). */
export const UPDATE_REQUIRED = "update_required";
