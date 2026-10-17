import { describe, expect, it } from "vitest";

import { API_BASE, cleanPhone } from "../src/data/auth";
import { MAX_IMPORT_CHARS, parseImport } from "../src/data/logic";
import { blankDraft, draftToInput } from "../src/data/slotForm";
import { validateAd } from "../src/data/validate";
import { CSP } from "../vite.config";

describe("sign-in", () => {
  it("reads a mobile number however it is typed, and refuses anything else", () => {
    expect(cleanPhone("09123456789")).toBe("09123456789");
    expect(cleanPhone("۰۹۱۲ ۳۴۵ ۶۷۸۹")).toBe("09123456789");
    expect(cleanPhone("+989123456789")).toBe("09123456789");
    expect(cleanPhone("0912345")).toBeNull();
    expect(cleanPhone("02112345678")).toBeNull();
    expect(cleanPhone("09123456789; drop")).toBeNull();
  });
  it("talks to Noghte through the dev proxy in development", () => {
    expect(API_BASE).toBe("/noghte");
  });
});

describe("what an ad may carry", () => {
  const draft = (url: string, image = "") => ({
    ...blankDraft(1, "x"),
    advertiser: "الف",
    title: "کاشی",
    tint: "#D9862B",
    url,
    image,
  });
  it("refuses links and pictures that are not https", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "http://example.com/", "ftp://x"])
      expect(validateAd(draftToInput(draft(url))).ok, url).toBe(false);
    expect(validateAd(draftToInput(draft("https://example.com/", "javascript:x"))).ok).toBe(false);
    expect(validateAd(draftToInput(draft("https://example.com/"))).ok).toBe(true);
  });
  it("refuses an import too big to read safely", () => {
    const r = parseImport(" ".repeat(MAX_IMPORT_CHARS + 1));
    expect(r).toMatchObject({ ok: false, error: "فایل بزرگ‌تر از ۵ مگابایت است." });
  });
});

describe("content security policy", () => {
  it("allows scripts and connections only from the panel's own origin, and no framing", () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).toContain("connect-src 'self'");
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("object-src 'none'");
    expect(CSP).not.toMatch(/script-src[^;]*unsafe/);
  });
});
