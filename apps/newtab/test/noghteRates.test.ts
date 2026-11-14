import { describe, expect, it } from "vitest";

import type { Prices } from "../src/market";
import { parseRates, withOurRates } from "../src/noghteRates";

const NOW = Date.parse("2026-11-14T12:00:00Z");

// as `GET /api/rates` answered on 2026-11-14
const answer = {
  v: 1,
  readAt: "2026-11-14T11:50:00.000Z",
  items: {
    usd: {
      label: "دلار آمریکا",
      value: 271200,
      unit: "toman",
      at: "2026-11-14T11:50:00.000Z",
      sources: ["alanchand", "tgju"],
      agreed: true,
      change: { amount: -1150, percent: -0.42 },
    },
    gram18: {
      label: "طلای ۱۸ عیار (گرم)",
      value: 24931900,
      unit: "toman",
      at: "2026-11-14T05:00:00.000Z",
      sources: ["alanchand"],
      agreed: false,
    },
    ounce: { value: 3883.43, unit: "usd", at: "2026-11-14T11:50:00.000Z", agreed: true },
    "bubble.emami": { value: -565000, unit: "toman", at: "2026-11-14T11:50:00.000Z" },
    eur: { value: "bad", unit: "toman", at: "2026-11-14T11:50:00.000Z" },
  },
};

const paket: Prices = {
  generatedAt: "2026-11-14T11:59:00Z",
  lastUpdated: "2026-11-14T11:30:00Z",
  live: true,
  items: [
    {
      id: "usd",
      group: "fx",
      name: "دلار آمریکا",
      sub: "بازار آزاد",
      unit: "IRT",
      price: 270000,
      changePct: 1.2,
      asOf: "2026-11-14T11:30:00Z",
      checkedAt: "2026-11-14T11:30:00Z",
      live: true,
      source: "paket",
    },
    {
      id: "coin_emami",
      group: "gold",
      name: "سکه امامی",
      sub: "هر عدد",
      unit: "IRT",
      price: 254000000,
      changePct: 0.1,
      asOf: "2026-11-14T11:30:00Z",
      checkedAt: "2026-11-14T11:30:00Z",
      live: true,
      source: "paket",
    },
  ],
  history: { days: 7, stepDays: 1, series: { usd: [268000, 269000, 270000] } },
};

describe("our server's rates on the money slide", () => {
  it("reads the answer and leaves out what does not fit", () => {
    const r = parseRates(answer);
    expect(r?.items.usd).toEqual({
      value: 271200,
      unit: "toman",
      at: "2026-11-14T11:50:00.000Z",
      agreed: true,
      change: { amount: -1150, percent: -0.42 },
    });
    expect(r?.items.eur).toBeUndefined();
    expect(parseRates({ error: "not_ready" })).toBeNull();
    expect(parseRates({ v: 2, readAt: "x", items: {} })).toBeNull();
  });

  it("replaces a row it has, the chart's last point too, and keeps the rows it has not", () => {
    const out = withOurRates(paket, parseRates(answer), NOW);
    const usd = out?.items.find((i) => i.id === "usd");
    expect(usd).toMatchObject({ price: 271200, changePct: -0.42, live: true, source: "noghte" });
    expect(out?.items.find((i) => i.id === "coin_emami")?.source).toBe("paket");
    expect(out?.history?.series.usd).toEqual([268000, 269000, 271200]);
  });

  it("adds a row only it has, and marks a number older than four hours as not live", () => {
    const out = withOurRates(paket, parseRates(answer), NOW);
    const gold = out?.items.find((i) => i.id === "gold18");
    expect(gold).toMatchObject({
      price: 24931900,
      changePct: null,
      live: false,
      name: "طلای ۱۸ عیار",
    });
  });

  it("stands alone when nothing else answered, and changes nothing when it did not answer", () => {
    const alone = withOurRates(null, parseRates(answer), NOW);
    expect(alone?.items.map((i) => i.id)).toEqual(["gold18", "usd"]);
    expect(alone?.history).toBeUndefined();
    expect(withOurRates(paket, null, NOW)).toBe(paket);
  });
});
