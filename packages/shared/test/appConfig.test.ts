import { describe, expect, it } from "vitest";

import {
  ALL_ON,
  MAX_ITEMS,
  parseWhatsNew,
  compareVersions,
  DEFAULT_CONFIG,
  parseAppConfig,
  updateNeed,
  versionsFor,
  type AppConfig,
} from "../src";

const config = (over: Partial<AppConfig>): AppConfig => ({ ...DEFAULT_CONFIG, ...over });

describe("compareVersions", () => {
  it("compares part by part, as numbers", () => {
    expect(compareVersions("0.10.0", "0.9.3")).toBe(1);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.1", "0.1.0")).toBe(0);
    expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
  });
});

describe("updateNeed", () => {
  it("requires below the minimum, offers below the latest, else nothing", () => {
    const c = config({ minVersion: "0.2.0", latestVersion: "0.3.1" });
    expect(updateNeed("0.1.9", c, null)).toBe("required");
    expect(updateNeed("0.2.0", c, null)).toBe("offer");
    expect(updateNeed("0.3.1", c, null)).toBe("none");
    expect(updateNeed("0.4.0", c, null)).toBe("none");
  });

  it("never blocks a version it cannot read", () => {
    expect(updateNeed("dev", config({ minVersion: "9.0.0" }), null)).toBe("none");
  });
});

describe("a store behind the others", () => {
  // 0.3.0 is out everywhere but Bazaar, whose review has not passed yet
  const c = parseAppConfig({
    minVersion: "0.3.0",
    latestVersion: "0.3.0",
    channels: { bazaar: { minVersion: "0.1.0", latestVersion: "0.2.0" }, myket: { x: 1 } },
  });

  it("asks of a Bazaar build only what Bazaar has", () => {
    expect(versionsFor(c, "bazaar")).toEqual({ minVersion: "0.1.0", latestVersion: "0.2.0" });
    expect(updateNeed("0.2.0", c, "bazaar")).toBe("none");
    expect(updateNeed("0.1.0", c, "bazaar")).toBe("offer");
  });

  it("asks the top-level versions of the others, and of a build that names no store", () => {
    expect(updateNeed("0.2.0", c, "play")).toBe("required");
    expect(updateNeed("0.2.0", c, null)).toBe("required");
    expect(c.channels.myket).toBeUndefined();
  });

  it("follows the top-level field a store leaves out, and never offers below the minimum", () => {
    const d = parseAppConfig({
      minVersion: "0.2.0",
      latestVersion: "0.4.0",
      channels: { play: { latestVersion: "0.3.0" }, myket: { latestVersion: "0.1.0" } },
    });
    expect(versionsFor(d, "play")).toEqual({ minVersion: "0.2.0", latestVersion: "0.3.0" });
    expect(versionsFor(d, "myket")).toEqual({ minVersion: "0.2.0", latestVersion: "0.2.0" });
  });
});

describe("parseAppConfig", () => {
  it("gives the defaults for anything that is not an object", () => {
    expect(parseAppConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseAppConfig("x")).toEqual(DEFAULT_CONFIG);
    expect(parseAppConfig([1])).toEqual(DEFAULT_CONFIG);
  });

  it("keeps good fields and drops bad ones one by one", () => {
    const c = parseAppConfig({
      minVersion: "0.2.0",
      latestVersion: "banana",
      links: {
        play: "https://play.google.com/x",
        bazaar: "javascript:alert(1)",
        other: "https://x",
      },
      whatsNew: { title: "  ", items: [] },
      flags: { sync: false, weather: "no", "future.thing": false },
    });
    expect(c.minVersion).toBe("0.2.0");
    // a bad latest falls to the default, then is lifted to the minimum
    expect(c.latestVersion).toBe("0.2.0");
    expect(c.links).toEqual({ play: "https://play.google.com/x" });
    expect(c.whatsNew).toBeNull();
    expect(c.flags).toEqual({ ...ALL_ON, sync: false });
  });

  it("takes the stores' own addresses", () => {
    const c = parseAppConfig({
      links: { bazaar: "bazaar://details?id=ir.dotlife.app", myket: "myket://details?id=x" },
    });
    expect(c.links.bazaar).toBe("bazaar://details?id=ir.dotlife.app");
    expect(c.links.myket).toBe("myket://details?id=x");
  });
});

describe("parseWhatsNew", () => {
  it("keeps a title, short items and a picture with its size", () => {
    expect(
      parseWhatsNew({
        title: "  تقویم تازه ",
        items: ["سوایپ ماه روان شد", "", 7, "  یادداشت   صوتی "],
        image: { url: "/config/media/v0-2.webp", width: 1200, height: 675 },
      }),
    ).toEqual({
      title: "تقویم تازه",
      items: ["سوایپ ماه روان شد", "یادداشت صوتی"],
      image: { url: "/config/media/v0-2.webp", width: 1200, height: 675 },
    });
  });

  it("drops a picture without its size, from an unsafe address, or outside the media folder", () => {
    const image = (img: unknown) => parseWhatsNew({ items: ["x"], image: img })?.image;
    expect(image({ url: "https://cdn.ir/a.jpg" })).toBeNull();
    expect(image({ url: "http://cdn.ir/a.jpg", width: 1, height: 1 })).toBeNull();
    expect(image({ url: "/config/media/../secret.json", width: 1, height: 1 })).toBeNull();
    expect(image({ url: "/etc/a.jpg", width: 1, height: 1 })).toBeNull();
    expect(image({ url: "https://cdn.ir/a.jpg", width: 800, height: 600 })).toEqual({
      url: "https://cdn.ir/a.jpg",
      width: 800,
      height: 600,
    });
  });

  it("keeps at most a few items, and gives null when nothing is left", () => {
    expect(parseWhatsNew({ items: Array(10).fill("x") })?.items).toHaveLength(MAX_ITEMS);
    expect(parseWhatsNew({ items: [" "] })).toBeNull();
    expect(parseWhatsNew("x")).toBeNull();
  });
});
