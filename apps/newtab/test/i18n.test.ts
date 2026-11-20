import { afterEach, describe, expect, it } from "vitest";

import { setLang, t } from "../src/i18n";
import { PARTS } from "../src/i18n/en";
import { fa } from "../src/ui/fa";

describe("languages", () => {
  afterEach(() => {
    setLang("fa");
  });

  it("gives the Persian as written, and English when chosen", () => {
    expect(t("فعلاً نه")).toBe("فعلاً نه");
    setLang("en");
    expect(t("فعلاً نه")).toBe("Not now");
  });

  it("fills the blanks after the lookup, and keeps a missing line in Persian", () => {
    setLang("en");
    expect(t("کد تازه تا {wait}", { wait: "30 s" })).toBe("New code in 30 s");
    expect(t("متنی که ترجمه ندارد")).toBe("متنی که ترجمه ندارد");
  });

  it("writes digits in the page's language", () => {
    expect(fa("12٬500")).toBe("۱۲٬۵۰۰");
    setLang("en");
    expect(fa("12٬500")).toBe("12,500");
    expect(fa("۳۴")).toBe("34");
  });

  it("has every English line once, with the same blanks as its Persian", () => {
    const seen = new Map<string, string>();
    for (const [part, lines] of Object.entries(PARTS)) {
      for (const [key, value] of Object.entries(lines)) {
        expect(
          seen.get(key),
          `«${key}» is in both ${seen.get(key) ?? ""} and ${part}`,
        ).toBeUndefined();
        seen.set(key, part);
        const blanks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(blanks(value), `«${key}» (${part})`).toEqual(blanks(key));
        expect(value.trim(), `«${key}» (${part}) is empty`).not.toBe("");
      }
    }
  });
});

describe("one Persian word, two meanings", () => {
  afterEach(() => {
    setLang("fa");
  });
  it("shows the Persian without its context, and each meaning's own English", () => {
    expect(t("برگرداندن|note")).toBe("برگرداندن");
    setLang("en");
    expect(t("برگرداندن|note")).toBe("Restore");
    expect(t("برگرداندن")).toBe("Mark as not done");
  });
});
