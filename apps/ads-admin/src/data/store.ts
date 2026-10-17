import { adSchema, bundleSchema, type Ad, type Bundle } from "@dotlife/ads";

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

export type LocalAdsStoreOptions = {
  storage?: KeyValueStorage;
  /** Ads to start with when nothing has been saved yet. */
  seed?: readonly Ad[];
};

/** Keeps ads in the browser's localStorage. The panel's only store until a server exists. */
export class LocalAdsStore implements AdsStore {
  private readonly storage: KeyValueStorage;
  private readonly listeners = new Set<() => void>();

  constructor({ storage = localStorage, seed }: LocalAdsStoreOptions = {}) {
    this.storage = storage;
    if (seed !== undefined && this.storage.getItem(ADS_KEY) === null) this.write([...seed]);
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
    const bundle = buildBundle(this.read(), previous?.version ?? 0, now);
    this.storage.setItem(BUNDLE_KEY, JSON.stringify(bundle));
    this.emit();
    return bundle;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    // a change from another tab arrives as a storage event
    const onStorage = (e: StorageEvent): void => {
      if (e.key === ADS_KEY || e.key === BUNDLE_KEY) listener();
    };
    const target = typeof window === "undefined" ? undefined : window;
    target?.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      target?.removeEventListener("storage", onStorage);
    };
  }
}
