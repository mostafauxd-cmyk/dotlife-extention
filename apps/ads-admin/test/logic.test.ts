import { SAMPLE_ADS, SLOTS, slotById } from "@dotlife/ads";
import { describe, expect, it } from "vitest";

import {
  adPhase,
  buildBundle,
  canonicalJson,
  duplicateAd,
  filterAds,
  newAdId,
  overfilled,
  parseImport,
  pauseAds,
  planImport,
  publishable,
  resumeAds,
  sha256Hex,
  slideFilled,
  slides,
  slotFill,
} from "../src/data/logic";
import { makeAd, NOW } from "./helpers";

const slot = (id: number) => {
  const s = slotById(id);
  if (s === undefined) throw new Error("no slot");
  return s;
};

describe("adPhase", () => {
  it("reads the status against the days", () => {
    expect(adPhase(makeAd(), NOW)).toBe("live");
    expect(adPhase(makeAd({ from: "2026-10-20" }), NOW)).toBe("scheduled");
    expect(adPhase(makeAd({ status: "scheduled" }), NOW)).toBe("live");
    expect(adPhase(makeAd({ until: "2026-10-16" }), NOW)).toBe("ended");
    expect(adPhase(makeAd({ status: "paused" }), NOW)).toBe("paused");
    expect(adPhase(makeAd({ status: "draft", from: "2026-10-20" }), NOW)).toBe("draft");
  });
  it("counts the whole last day, on the Tehran clock", () => {
    expect(adPhase(makeAd({ until: "2026-10-17" }), NOW)).toBe("live");
    // 22:00 UTC is already the 18th in Tehran
    expect(adPhase(makeAd({ until: "2026-10-17" }), new Date("2026-10-17T22:00:00Z"))).toBe(
      "ended",
    );
  });
});

describe("slotFill", () => {
  it("is empty, live, scheduled or the house's", () => {
    expect(slotFill(slot(5), [], NOW).kind).toBe("empty");
    expect(slotFill(slot(6), [], NOW).kind).toBe("house");
    const soon = makeAd({ slot: 5, id: "s", from: "2026-11-01", model: "daily-sponsor" });
    expect(slotFill(slot(5), [soon], NOW)).toMatchObject({ kind: "scheduled", scheduled: 1 });
    const now5 = makeAd({ slot: 5, id: "n", model: "daily-sponsor" });
    expect(slotFill(slot(5), [soon, now5], NOW)).toMatchObject({ kind: "live", live: 1 });
  });
  it("shows the heaviest live ad", () => {
    const ads = [makeAd({ id: "a", weight: 1 }), makeAd({ id: "b", weight: 9 })];
    expect(slotFill(slot(6), ads, NOW).ad?.id).toBe("b");
  });
  it("lets a paused ad leave the slot to the house", () => {
    expect(slotFill(slot(6), [makeAd({ status: "paused" })], NOW).kind).toBe("house");
  });
});

describe("slides", () => {
  it("groups the fifteen slots into the design's six slides", () => {
    const s = slides();
    expect(s.map((x) => x.name)).toEqual([
      "خانه",
      "برنامه‌ها",
      "پول",
      "یادداشت‌ها",
      "خبر",
      "شبکه‌ها",
    ]);
    expect(s.flatMap((x) => x.slots)).toHaveLength(SLOTS.length);
  });
  it("warns when more than three slots of a slide are live", () => {
    const home = slides()[0];
    if (home === undefined) throw new Error("no slide");
    const ads = [1, 2, 4, 5].map((n) =>
      makeAd({ id: `x${String(n)}`, slot: n, model: "per-click" }),
    );
    expect(overfilled(slideFilled(home, ads, NOW))).toBe(true);
    expect(overfilled(slideFilled(home, ads.slice(0, 3), NOW))).toBe(false);
  });
});

describe("filterAds", () => {
  const ads = [
    makeAd({ id: "a", title: "بلیت قطار مشهد", advertiser: "الف" }),
    makeAd({
      id: "b",
      slot: 15,
      model: "per-signup",
      status: "paused",
      advertiser: "ب",
      products: ["noghte"],
    }),
    makeAd({ id: "c", slot: 6, title: "كتاب", status: "draft", advertiser: "الف" }),
  ];
  it("filters by slot, phase, product and advertiser", () => {
    const ids = (f: Parameters<typeof filterAds>[1]) => filterAds(ads, f, NOW).map((a) => a.id);
    expect(ids({ slot: 15 })).toEqual(["b"]);
    expect(ids({ phase: "draft" })).toEqual(["c"]);
    expect(ids({ product: "noghte" })).toEqual(["b"]);
    expect(ids({ advertiser: "الف" })).toEqual(["a", "c"]);
    expect(ids({})).toHaveLength(3);
  });
  it("searches titles, treating Arabic and Persian letters alike", () => {
    expect(filterAds(ads, { q: "کتاب" }, NOW).map((a) => a.id)).toEqual(["c"]);
    expect(filterAds(ads, { q: "مشهد" }, NOW).map((a) => a.id)).toEqual(["a"]);
    expect(filterAds(ads, { q: "نیست" }, NOW)).toEqual([]);
  });
});

describe("bulk edits", () => {
  const ads = [
    makeAd({ id: "live" }),
    makeAd({ id: "paused", status: "paused" }),
    makeAd({ id: "draft", status: "draft" }),
    makeAd({ id: "soon", status: "scheduled" }),
  ];
  const all = new Set(ads.map((a) => a.id));
  it("pauses only what runs or waits", () => {
    expect(pauseAds(ads, all).map((a) => a.id)).toEqual(["live", "soon"]);
    expect(pauseAds(ads, all).every((a) => a.status === "paused")).toBe(true);
  });
  it("resumes only the paused", () => {
    const r = resumeAds(ads, all);
    expect(r.map((a) => [a.id, a.status])).toEqual([["paused", "live"]]);
  });
  it("leaves unselected ads alone", () => {
    expect(pauseAds(ads, new Set(["live"]))).toHaveLength(1);
  });
});

describe("ids and copies", () => {
  it("makes distinct ids", () => {
    expect(newAdId(NOW, () => 0.1)).not.toBe(newAdId(NOW, () => 0.9));
    expect(newAdId(NOW)).toMatch(/^ad-[0-9a-z]+$/);
  });
  it("copies as a draft with a new id", () => {
    const copy = duplicateAd(makeAd({ id: "a" }), "b");
    expect(copy).toMatchObject({ id: "b", status: "draft", title: "بلیت قطار (کپی)" });
  });
});

describe("bundles", () => {
  it("sends only what is live or waiting, in id order", () => {
    const ads = [
      makeAd({ id: "z" }),
      makeAd({ id: "a", status: "scheduled", from: "2026-12-01" }),
      makeAd({ id: "p", status: "paused" }),
      makeAd({ id: "e", until: "2026-10-01" }),
    ];
    expect(publishable(makeAd({ id: "e", until: "2026-10-01" }), NOW)).toBe(false);
    const b = buildBundle(ads, 4, NOW);
    expect(b.version).toBe(5);
    expect(b.ads.map((a) => a.id)).toEqual(["a", "z"]);
  });
  it("writes canonical JSON: sorted keys, no spaces, no undefined", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: "x" }] })).toBe(
      '{"a":[2,{"c":"x"}],"b":1}',
    );
    expect(canonicalJson({ x: "فارسی" })).toBe('{"x":"فارسی"}');
  });
  it("gives the same text whatever the key order", () => {
    expect(canonicalJson({ a: 1, b: { c: 2, d: 3 } })).toBe(
      canonicalJson({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });
  it("hashes", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("import", () => {
  it("reads a bundle and a bare list", () => {
    const bundle = JSON.stringify({ version: 3, generatedAt: NOW.toISOString(), ads: SAMPLE_ADS });
    expect(parseImport(bundle)).toMatchObject({ ok: true, source: "bundle", version: 3 });
    expect(parseImport(JSON.stringify([makeAd()]))).toMatchObject({ ok: true, source: "list" });
  });
  it("explains what is wrong in Persian", () => {
    expect(parseImport("{")).toMatchObject({ ok: false, error: "این متن JSON معتبر نیست." });
    const r = parseImport(JSON.stringify([{ ...makeAd(), url: "nope", slot: 99 }]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.join(" ")).toContain("تبلیغ ۱");
      expect(r.issues.join(" ")).toContain("نشانی مقصد");
    }
  });
  it("refuses two ads with one id", () => {
    const r = parseImport(JSON.stringify([makeAd(), makeAd()]));
    expect(r).toMatchObject({ ok: false });
  });
  it("plans a merge and a replace", () => {
    const current = [makeAd({ id: "a", title: "قدیمی" }), makeAd({ id: "b" })];
    const incoming = [makeAd({ id: "a", title: "تازه" }), makeAd({ id: "c" })];
    const merge = planImport(current, incoming, "merge");
    expect(merge).toMatchObject({ added: 1, updated: 1, removed: 0 });
    expect(merge.result.map((a) => [a.id, a.title])).toEqual([
      ["a", "تازه"],
      ["b", "بلیت قطار"],
      ["c", "بلیت قطار"],
    ]);
    const replace = planImport(current, incoming, "replace");
    expect(replace).toMatchObject({ added: 1, updated: 1, removed: 1 });
    expect(replace.result.map((a) => a.id)).toEqual(["a", "c"]);
  });
});
