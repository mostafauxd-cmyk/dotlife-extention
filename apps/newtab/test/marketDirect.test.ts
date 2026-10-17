import { describe, expect, it } from "vitest";

import { parseCloses, parseMirror, parseNobitex, seriesOf, usdtAgrees } from "../src/marketDirect";

const NOW = new Date("2026-10-17T10:00:00Z");

const file = (records: unknown[], unit = "toman") => ({
  meta: { unit },
  data: { generated_at: "2026-10-17T09:50:00Z", categories: { gold: records } },
});
const rec = (symbol: string, price: number, extra: Record<string, unknown> = {}) => ({
  symbol,
  price,
  change_pct: 0.8,
  currency: "IRT",
  timestamp: "2026-10-17T09:40:00Z",
  checked_at: "2026-10-17T09:50:00Z",
  ...extra,
});

describe("parseMirror", () => {
  it("reads a price with its change, stamp and live flag", () => {
    const q = parseMirror(file([rec("GOLD_18K_IRR", 26_255_100)]), NOW).get("GOLD_18K_IRR");
    expect(q).toMatchObject({
      price: 26_255_100,
      changePct: 0.8,
      live: true,
      source: "iran-market",
    });
  });

  it("turns off «live» for a stale record or one checked long ago", () => {
    const m = parseMirror(
      file([rec("A", 1, { stale: true }), rec("B", 1, { checked_at: "2026-10-17T08:00:00Z" })]),
      NOW,
    );
    expect(m.get("A")?.live).toBe(false);
    expect(m.get("B")?.live).toBe(false);
  });

  it("drops spikes, bad prices, unknown units, and a whole rial file", () => {
    const m = parseMirror(
      file([
        rec("S", 5, { quality: ["spike"] }),
        rec("Z", 0),
        rec("U", 5, { currency: "IRR" }),
        rec("OK", 5),
      ]),
      NOW,
    );
    expect([...m.keys()]).toEqual(["OK"]);
    expect(parseMirror(file([rec("OK", 5)], "rial"), NOW).size).toBe(0);
    expect(parseMirror({ nonsense: true }, NOW).size).toBe(0);
  });
});

describe("parseNobitex", () => {
  const stats = {
    status: "ok",
    stats: {
      "btc-usdt": { latest: "82000", dayOpen: "80000", isClosed: false },
      "eth-usdt": { latest: "2900", dayOpen: "2900", isClosed: true },
      "usdt-rls": { latest: "2616000", dayOpen: "2600000" },
    },
  };
  it("reads crypto in dollars and the tether in toman (its pair is rial)", () => {
    const m = parseNobitex(stats, NOW);
    expect(m.get("btc")?.price).toBe(82000);
    expect(m.get("btc")?.changePct).toBeCloseTo(2.5);
    expect(m.get("usdt")?.price).toBeCloseTo(261_600);
    expect(m.has("eth")).toBe(false); // closed
  });

  it("checks the tether against the dollar", () => {
    expect(usdtAgrees(261_600, 259_800)).toBe(true);
    expect(usdtAgrees(2_616_000, 259_800)).toBe(false); // rial taken for toman
    expect(usdtAgrees(261_600, undefined)).toBe(true);
  });
});

describe("history", () => {
  it("scales rial closes to toman and skips gaps", () => {
    const j = { data: [{ close: 1000 }, { close: null }, { close: 2000 }] };
    expect(parseCloses(j, "IRR")).toEqual([100, 200]);
    expect(parseCloses(j, "IRT")).toEqual([1000, 2000]);
    expect(parseCloses(j, undefined)).toEqual([]);
  });

  it("ends a series on the live price; a year is one point a week", () => {
    const c = Array.from({ length: 400 }, (_, i) => i + 1);
    expect(seriesOf(c, 7, 999)).toEqual([394, 395, 396, 397, 398, 399, 400, 999]);
    const year = seriesOf(c, 365, 999);
    expect(year.at(-1)).toBe(999);
    expect(year.length).toBe(54); // 53 weekly closes and today
    expect(year.at(-2)).toBe(400);
  });
});
