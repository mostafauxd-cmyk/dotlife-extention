import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts", "apps/newtab", "apps/ads-admin"],
    passWithNoTests: false,
  },
});
