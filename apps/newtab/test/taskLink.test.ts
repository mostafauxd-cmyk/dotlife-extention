import { describe, expect, it } from "vitest";

import { linkIn, parseLink, withLink, withoutLink } from "../src/noghte/taskLink";

describe("a page kept on a task", () => {
  it("reads the address from the first line only", () => {
    expect(linkIn("https://a.com/x\n\nمتن")).toBe("https://a.com/x");
    expect(linkIn("متن\nhttps://a.com/x")).toBe("");
    expect(linkIn("https://a.com/x با متن")).toBe("");
    expect(linkIn("")).toBe("");
  });

  it("keeps the person's own text apart from it, both ways", () => {
    const notes = withLink("یادداشت من", "https://a.com/x");
    expect(notes).toBe("https://a.com/x\n\nیادداشت من");
    expect(linkIn(notes)).toBe("https://a.com/x");
    expect(withoutLink(notes)).toBe("یادداشت من");
    expect(withLink("", "https://a.com/x")).toBe("https://a.com/x");
    expect(withLink("فقط متن", "")).toBe("فقط متن");
    expect(withoutLink("بدون لینک")).toBe("بدون لینک");
  });

  it("accepts what a person pastes, and refuses what is not an address", () => {
    expect(parseLink(" example.com/a ")).toBe("https://example.com/a");
    expect(parseLink("http://example.com")).toBe("http://example.com/");
    expect(parseLink("hello")).toBe("");
    expect(parseLink("two words.com")).toBe("");
    expect(parseLink("javascript:alert(1)")).toBe("");
  });
});

describe("a page kept from the right-click menu", () => {
  it("is named by its title, or else by its address", async () => {
    const { keptTitle } = await import("../src/noghte/inbox");
    expect(keptTitle({ url: "https://a.com/x", title: " صفحه " })).toBe("صفحه");
    expect(keptTitle({ url: "https://a.com/x/", title: "" })).toBe("a.com/x");
  });
});
