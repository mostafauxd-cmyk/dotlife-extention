import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, parseAppConfig } from "../src/appConfig";
import {
  MAX_PROMOS,
  NO_PROMOS,
  parsePromo,
  parsePromos,
  promoFor,
  promoLive,
  type Promo,
} from "../src/promo";

const card = (over: Record<string, unknown> = {}) => ({
  id: "yalda-1405",
  on: true,
  title: "شب یلدا",
  ...over,
});

describe("parsePromo", () => {
  it("is off unless the file says on", () => {
    expect(parsePromo(card({ on: undefined }))).toBeNull();
    expect(parsePromo(card({ on: "true" }))).toBeNull();
    expect(parsePromo(card({ on: false }))).toBeNull();
    expect(parsePromo(card())).not.toBeNull();
  });

  it("needs a name and a title", () => {
    expect(parsePromo(card({ id: "Yalda 1405" }))).toBeNull();
    expect(parsePromo(card({ id: undefined }))).toBeNull();
    expect(parsePromo(card({ title: "  " }))).toBeNull();
  });

  it("keeps good fields and drops bad ones one by one", () => {
    const p = parsePromo(
      card({
        place: "middle",
        look: "banner",
        text: "  هدیه‌ی   یلدا ",
        label: "با همراهی یک برند",
        image: { url: "/config/media/yalda.webp", width: 1200, height: 600 },
        action: { title: "دریافت", url: "javascript:alert(1)" },
        tint: "red",
        from: "2026-12-18",
        until: "not a day",
        closable: "no",
      }),
    );
    expect(p).toEqual({
      id: "yalda-1405",
      on: true,
      from: "2026-12-18",
      until: null,
      place: "top",
      look: "compact",
      title: "شب یلدا",
      text: "هدیه‌ی یلدا",
      label: "با همراهی یک برند",
      image: { url: "/config/media/yalda.webp", width: 1200, height: 600 },
      action: null,
      tint: null,
      closable: true,
    });
  });

  it("takes the web, the stores and the app's own pages as links", () => {
    const url = (u: string) => parsePromo(card({ action: { title: "برو", url: u } }))?.action;
    expect(url("https://example.ir/x")).toEqual({ title: "برو", url: "https://example.ir/x" });
    expect(url("bazaar://details?id=x")?.url).toBe("bazaar://details?id=x");
    expect(url("dotlife://occasions")?.url).toBe("dotlife://occasions");
    expect(url("http://example.ir")).toBeNull();
    expect(url("intent://x")).toBeNull();
  });
});

describe("parsePromos", () => {
  it("leaves out broken and repeated cards, keeps the rest in order", () => {
    const p = parsePromos({
      calendar: [card(), 7, card({ id: "nowruz" }), card({ title: "again" }), card({ on: false })],
      elsewhere: [card()],
    });
    expect(p.calendar.map((c) => c.id)).toEqual(["yalda-1405", "nowruz"]);
  });

  it("holds at most a few cards", () => {
    const many = Array.from({ length: 20 }, (_, i) => card({ id: `c${String(i)}` }));
    expect(parsePromos({ calendar: many }).calendar).toHaveLength(MAX_PROMOS);
  });

  it("gives none for anything else, and the config has none by default", () => {
    expect(parsePromos(null)).toEqual(NO_PROMOS);
    expect(parsePromos({ calendar: "x" })).toEqual(NO_PROMOS);
    expect(DEFAULT_CONFIG.promos).toEqual(NO_PROMOS);
    expect(parseAppConfig({ promos: { calendar: [card()] } }).promos.calendar).toHaveLength(1);
  });
});

describe("read twice", () => {
  it("reads the same on the phone as on the server, which sends what it read", () => {
    const once = parseAppConfig({
      promos: {
        calendar: [
          card({
            from: "2026-12-18",
            until: "2026-12-21T20:00:00Z",
            place: "end",
            look: "picture",
            text: "x",
            label: "y",
            image: { url: "https://cdn.ir/a.webp", width: 2, height: 1 },
            action: { title: "برو", url: "dotlife://occasions" },
            tint: "#C73E33",
            closable: false,
          }),
        ],
      },
    });
    expect(once.promos.calendar).toHaveLength(1);
    expect(parseAppConfig(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});

describe("promoFor", () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

  it("shows a card only inside its days, the last one to its end", () => {
    const p = parsePromo(card({ from: "2026-12-18", until: "2026-12-21" })) as Promo;
    expect(promoLive(p, at(2026, 12, 17, 23))).toBe(false);
    expect(promoLive(p, at(2026, 12, 18, 0))).toBe(true);
    expect(promoLive(p, at(2026, 12, 21, 23))).toBe(true);
    expect(promoLive(p, at(2026, 12, 22, 0))).toBe(false);
  });

  it("takes full times as written", () => {
    const p = parsePromo(card({ until: "2026-12-18T10:00:00Z" })) as Promo;
    expect(promoLive(p, new Date("2026-12-18T09:59:00Z"))).toBe(true);
    expect(promoLive(p, new Date("2026-12-18T10:01:00Z"))).toBe(false);
  });

  it("picks the first live card that this phone has not closed", () => {
    const list = parsePromos({
      calendar: [card({ id: "old", until: "2026-01-01" }), card({ id: "a" }), card({ id: "b" })],
    }).calendar;
    const now = at(2026, 10, 14);
    expect(promoFor(list, now, new Set())?.id).toBe("a");
    expect(promoFor(list, now, new Set(["a"]))?.id).toBe("b");
    expect(promoFor(list, now, new Set(["a", "b"]))).toBeNull();
  });
});
