import { afterEach, describe, expect, it } from "vitest";

import { setLang } from "../src/i18n";
import { folderLabel, siteLabel } from "../src/siteNames";

describe("the quick-access row in English", () => {
  afterEach(() => {
    setLang("fa");
  });

  it("names a built-in site in English, and leaves Persian as it was", () => {
    const yt = { title: "یوتیوب", url: "https://www.youtube.com/" };
    expect(siteLabel(yt)).toBe("یوتیوب");
    setLang("en");
    expect(siteLabel(yt)).toBe("YouTube");
  });

  it("keeps a name the person gave, and any site of their own", () => {
    setLang("en");
    expect(siteLabel({ title: "ویدیوهام", url: "https://www.youtube.com/" })).toBe("ویدیوهام");
    expect(siteLabel({ title: "سایت من", url: "https://example.com/" })).toBe("سایت من");
  });

  it("names a persona's folder in English only while it keeps its name", () => {
    setLang("en");
    const f = {
      kind: "folder" as const,
      id: "persona-dev",
      name: "برنامه‌نویسی",
      items: [],
      persona: "dev",
    };
    expect(folderLabel(f)).toBe("Programming");
    expect(folderLabel({ ...f, name: "کدها" })).toBe("کدها");
    const { persona: _p, ...own } = f;
    expect(folderLabel(own)).toBe("برنامه‌نویسی");
  });
});
