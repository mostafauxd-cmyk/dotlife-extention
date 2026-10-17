import {
  adSchema,
  bundleSchema,
  campaignSchema,
  type Ad,
  type Bundle,
  type Campaign,
} from "@dotlife/ads";

import { buildBundle } from "./logic";

/**
 * Where the panel keeps its ads. The interface is what a server API will implement later
 * (docs/ads-api.md): the panel never touches storage directly, so swapping `LocalAdsStore` for an
 * HTTP store changes nothing else. Every method is async for that reason.
 */
export interface AdsStore {
  list(): Promise<Ad[]>;
  get(id: string): Promise<Ad | undefined>;
  /** Adds an ad, or replaces the one with the same id. Throws when the ad is not valid. */
  put(ad: Ad): Promise<void>;
  /** The same for many, in one write (bulk pause, import). */
  putMany(ads: readonly Ad[]): Promise<void>;
  delete(id: string): Promise<void>;
  /** Swaps the whole list (importing a bundle in «replace» mode). */
  replaceAll(ads: readonly Ad[]): Promise<void>;
  listCampaigns(): Promise<Campaign[]>;
  /** Adds a campaign, or replaces the one with the same id. Throws when it is not valid. */
  putCampaign(campaign: Campaign): Promise<void>;
  /** Deletes a campaign and its creatives. */
  deleteCampaign(id: string): Promise<void>;
  /** The last bundle that was published, if any. */
  lastBundle(): Promise<Bundle | undefined>;
  /** Writes the next bundle (version + 1) from the ads that are live or waiting, and returns it. */
  publish(now?: Date): Promise<Bundle>;
  /** Called after any change, including one from another tab. Returns the way to stop. */
  subscribe(listener: () => void): () => void;
}

/** The part of `Storage` the store uses, so tests can pass a plain object. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export const ADS_KEY = "ads-admin.ads";
export const BUNDLE_KEY = "ads-admin.bundle";
export const CAMPAIGNS_KEY = "ads-admin.campaigns";

export type LocalAdsStoreOptions = {
  storage?: KeyValueStorage;
  /** Ads to start with when nothing has been saved yet. */
  seed?: readonly Ad[];
  /** Campaigns (and their creatives) to start with when none have been saved yet. */
  seedCampaigns?: { campaigns: readonly Campaign[]; ads: readonly Ad[] };
  /** Also hands each published bundle on (in development, to the dev bundle route). */
  mirror?: (bundle: Bundle) => Promise<void>;
};

/** Keeps ads in the browser's localStorage. The panel's only store until a server exists. */
export class LocalAdsStore implements AdsStore {
  private readonly storage: KeyValueStorage;
  private readonly listeners = new Set<() => void>();
  private readonly mirror: ((bundle: Bundle) => Promise<void>) | undefined;

  constructor({ storage = localStorage, seed, seedCampaigns, mirror }: LocalAdsStoreOptions = {}) {
    this.storage = storage;
    this.mirror = mirror;
    if (seed !== undefined && this.storage.getItem(ADS_KEY) === null) this.write([...seed]);
    if (seedCampaigns !== undefined && this.storage.getItem(CAMPAIGNS_KEY) === null) {
      this.writeCampaigns([...seedCampaigns.campaigns]);
      const have = new Set(this.read().map((a) => a.id));
      this.write([...this.read(), ...seedCampaigns.ads.filter((a) => !have.has(a.id))]);
    }
  }

  private readCampaigns(): Campaign[] {
    const raw = this.storage.getItem(CAMPAIGNS_KEY);
    if (raw === null) return [];
    try {
      const json: unknown = JSON.parse(raw);
      if (!Array.isArray(json)) return [];
      return json.flatMap((x: unknown) => {
        const r = campaignSchema.safeParse(x);
        return r.success ? [r.data] : [];
      });
    } catch {
      return [];
    }
  }

  private writeCampaigns(list: Campaign[]): void {
    this.storage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
    this.emit();
  }

  listCampaigns(): Promise<Campaign[]> {
    return Promise.resolve(this.readCampaigns());
  }

  putCampaign(campaign: Campaign): Promise<void> {
    try {
      const c = campaignSchema.parse(campaign);
      const all = this.readCampaigns();
      const i = all.findIndex((x) => x.id === c.id);
      if (i >= 0) all[i] = c;
      else all.push(c);
      this.writeCampaigns(all);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error("put failed"));
    }
  }

  deleteCampaign(id: string): Promise<void> {
    this.write(this.read().filter((a) => a.campaign !== id));
    this.writeCampaigns(this.readCampaigns().filter((c) => c.id !== id));
    return Promise.resolve();
  }

  private read(): Ad[] {
    const raw = this.storage.getItem(ADS_KEY);
    if (raw === null) return [];
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(json)) return [];
    // an entry that no longer fits the schema is left out rather than breaking the whole panel
    return json.flatMap((x: unknown) => {
      const r = adSchema.safeParse(x);
      return r.success ? [r.data] : [];
    });
  }

  private write(ads: Ad[]): void {
    this.storage.setItem(ADS_KEY, JSON.stringify(ads));
    this.emit();
  }

  private emit(): void {
    for (const l of [...this.listeners]) l();
  }

  list(): Promise<Ad[]> {
    return Promise.resolve(this.read());
  }

  get(id: string): Promise<Ad | undefined> {
    return Promise.resolve(this.read().find((a) => a.id === id));
  }

  put(ad: Ad): Promise<void> {
    return this.putMany([ad]);
  }

  putMany(ads: readonly Ad[]): Promise<void> {
    try {
      const checked = ads.map((a) => adSchema.parse(a));
      const all = this.read();
      for (const ad of checked) {
        const i = all.findIndex((a) => a.id === ad.id);
        if (i >= 0) all[i] = ad;
        else all.push(ad);
      }
      this.write(all);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error("put failed"));
    }
  }

  delete(id: string): Promise<void> {
    this.write(this.read().filter((a) => a.id !== id));
    return Promise.resolve();
  }

  replaceAll(ads: readonly Ad[]): Promise<void> {
    try {
      this.write(ads.map((a) => adSchema.parse(a)));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error("replace failed"));
    }
  }

  lastBundle(): Promise<Bundle | undefined> {
    const raw = this.storage.getItem(BUNDLE_KEY);
    if (raw === null) return Promise.resolve(undefined);
    try {
      const r = bundleSchema.safeParse(JSON.parse(raw));
      return Promise.resolve(r.success ? r.data : undefined);
    } catch {
      return Promise.resolve(undefined);
    }
  }

  async publish(now: Date = new Date()): Promise<Bundle> {
    const previous = await this.lastBundle();
    const bundle = buildBundle(this.read(), previous?.version ?? 0, now, this.readCampaigns());
    this.storage.setItem(BUNDLE_KEY, JSON.stringify(bundle));
    this.emit();
    if (this.mirror !== undefined) await this.mirror(bundle);
    return bundle;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    // a change from another tab arrives as a storage event
    const onStorage = (e: StorageEvent): void => {
      if (e.key === ADS_KEY || e.key === BUNDLE_KEY || e.key === CAMPAIGNS_KEY) listener();
    };
    const target = typeof window === "undefined" ? undefined : window;
    target?.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      target?.removeEventListener("storage", onStorage);
    };
  }
}
