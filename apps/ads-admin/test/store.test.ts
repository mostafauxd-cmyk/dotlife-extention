import { SAMPLE_ADS } from "@dotlife/ads";
import { describe, expect, it, vi } from "vitest";

import { ADS_KEY, BUNDLE_KEY, LocalAdsStore, MemoryStorage } from "../src/data/store";
import { makeAd, NOW } from "./helpers";

const fresh = (seed?: typeof SAMPLE_ADS) => {
  const storage = new MemoryStorage();
  return {
    storage,
    store: new LocalAdsStore(seed === undefined ? { storage } : { storage, seed }),
  };
};

describe("LocalAdsStore", () => {
  it("starts empty, or from a seed only when nothing was saved", async () => {
    expect(await fresh().store.list()).toEqual([]);
    const { storage, store } = fresh(SAMPLE_ADS);
    expect(await store.list()).toHaveLength(SAMPLE_ADS.length);
    await store.delete("sample-1");
    // a second store over the same storage must not bring the seed back
    expect(await new LocalAdsStore({ storage, seed: SAMPLE_ADS }).list()).toHaveLength(
      SAMPLE_ADS.length - 1,
    );
  });

  it("adds, finds, replaces in place and deletes", async () => {
    const { store } = fresh();
    await store.put(makeAd({ id: "a" }));
    await store.put(makeAd({ id: "b", title: "دوم" }));
    await store.put(makeAd({ id: "a", title: "تازه" }));
    expect((await store.list()).map((a) => [a.id, a.title])).toEqual([
      ["a", "تازه"],
      ["b", "دوم"],
    ]);
    expect((await store.get("b"))?.title).toBe("دوم");
    expect(await store.get("zzz")).toBeUndefined();
    await store.delete("a");
    expect((await store.list()).map((a) => a.id)).toEqual(["b"]);
  });

  it("refuses an invalid ad and writes nothing", async () => {
    const { store } = fresh();
    await store.put(makeAd({ id: "a" }));
    const bad = { ...makeAd({ id: "b" }), slot: 99 };
    await expect(store.putMany([makeAd({ id: "c" }), bad])).rejects.toThrow();
    expect((await store.list()).map((a) => a.id)).toEqual(["a"]);
  });

  it("writes many at once and replaces the whole list", async () => {
    const { store } = fresh();
    const onChange = vi.fn();
    store.subscribe(onChange);
    await store.putMany([makeAd({ id: "a" }), makeAd({ id: "b" })]);
    expect(onChange).toHaveBeenCalledTimes(1);
    await store.replaceAll([makeAd({ id: "z" })]);
    expect((await store.list()).map((a) => a.id)).toEqual(["z"]);
  });

  it("tells listeners about changes until they stop", async () => {
    const { store } = fresh();
    const onChange = vi.fn();
    const stop = store.subscribe(onChange);
    await store.put(makeAd());
    await store.delete("a");
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
    await store.put(makeAd());
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("skips saved entries that no longer fit the schema, and survives broken JSON", async () => {
    const { storage, store } = fresh();
    storage.setItem(ADS_KEY, JSON.stringify([makeAd({ id: "ok" }), { id: "bad" }]));
    expect((await store.list()).map((a) => a.id)).toEqual(["ok"]);
    storage.setItem(ADS_KEY, "{not json");
    expect(await store.list()).toEqual([]);
  });

  it("publishes live and waiting ads as the next version", async () => {
    const { storage, store } = fresh();
    await store.putMany([
      makeAd({ id: "live" }),
      makeAd({ id: "soon", status: "scheduled", from: "2026-11-01" }),
      makeAd({ id: "draft", status: "draft" }),
      makeAd({ id: "paused", status: "paused" }),
      makeAd({ id: "over", until: "2026-10-01" }),
    ]);
    expect(await store.lastBundle()).toBeUndefined();
    const one = await store.publish(NOW);
    expect(one.version).toBe(1);
    expect(one.generatedAt).toBe(NOW.toISOString());
    expect(one.ads.map((a) => a.id)).toEqual(["live", "soon"]);
    const two = await store.publish(new Date(NOW.getTime() + 1000));
    expect(two.version).toBe(2);
    expect((await store.lastBundle())?.version).toBe(2);
    expect(storage.getItem(BUNDLE_KEY)).not.toBeNull();
  });
});
