import { describe, expect, it } from "vitest";

import { compareVersions, parseExtensionInfo } from "../src/update";

describe("updates", () => {
  it("orders versions by number, not by text", () => {
    expect(compareVersions("0.1.10", "0.1.3")).toBe(1);
    expect(compareVersions("0.1.3", "0.1.3")).toBe(0);
    expect(compareVersions("0.1", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.3", "0.2.0")).toBe(-1);
  });

  it("reads only a well-formed extension block from نقطه's config", () => {
    expect(parseExtensionInfo({ extension: { latestVersion: "0.2.0" } })).toEqual({
      latestVersion: "0.2.0",
      downloadUrl: null,
    });
    expect(
      parseExtensionInfo({
        extension: { latestVersion: "0.2.0", downloadUrl: "https://noghte.life/x.zip" },
      })?.downloadUrl,
    ).toBe("https://noghte.life/x.zip");
    expect(
      parseExtensionInfo({ extension: { latestVersion: "0.2.0", downloadUrl: "javascript:x" } })
        ?.downloadUrl,
    ).toBeNull();
    expect(parseExtensionInfo({ extension: { latestVersion: "new" } })).toBeNull();
    expect(parseExtensionInfo({ minVersion: "1.0.0" })).toBeNull();
    expect(parseExtensionInfo(null)).toBeNull();
  });
});
