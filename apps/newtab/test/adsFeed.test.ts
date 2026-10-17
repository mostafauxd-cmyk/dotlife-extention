import { describe, expect, it } from "vitest";

import { pullBundle } from "../src/adsFeed";

const reply =
  (body: unknown, status = 200): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

const ad = {
  id: "x",
  slot: 6,
  products: ["newtab"],
  status: "live",
  advertiser: "a",
  title: "t",
  url: "https://example.com/",
  model: "per-thousand",
};

describe("pullBundle", () => {
  it("takes a bundle that fits the schema", async () => {
    const ok = await pullBundle("http://x/", reply({ version: 1, generatedAt: "now", ads: [ad] }));
    expect(ok).toBe(true);
  });
  it("keeps what it has on a missing, broken or unreachable bundle", async () => {
    expect(await pullBundle("http://x", reply({}, 404))).toBe(false);
    expect(await pullBundle("http://x", reply({ version: "one" }))).toBe(false);
    expect(await pullBundle("http://x", () => Promise.reject(new Error("offline")))).toBe(false);
  });
});
