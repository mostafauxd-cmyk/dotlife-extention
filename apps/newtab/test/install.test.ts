import { describe, expect, it } from "vitest";

import { getLink } from "../src/install";

describe("getLink", () => {
  it("sends Noghte through its own address, naming the extension, the place and the install", () => {
    const u = new URL(getLink("noghte", "signin", "ab12cd34ef"));
    expect(u.origin + u.pathname).toBe("https://noghte.life/get");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      app: "noghte",
      src: "chrome",
      c: "signin",
      r: "ab12cd34ef",
    });
  });

  it("sends Paket to its own site, marked the same way", () => {
    const u = new URL(getLink("paket", "money-slide", "ab12cd34ef"));
    expect(u.origin + u.pathname).toBe("https://paket.life/");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      src: "chrome",
      c: "money-slide",
      r: "ab12cd34ef",
    });
  });
});
