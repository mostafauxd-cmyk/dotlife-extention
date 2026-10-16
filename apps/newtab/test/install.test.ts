import { describe, expect, it } from "vitest";

import { getLink } from "../src/install";

describe("getLink", () => {
  it("names the app, the extension, the place and the install, through Noghte's own address", () => {
    const u = new URL(getLink("paket", "money-empty", "ab12cd34ef"));
    expect(u.origin + u.pathname).toBe("https://noghte.life/get");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      app: "paket",
      src: "chrome",
      c: "money-empty",
      r: "ab12cd34ef",
    });
  });
});
