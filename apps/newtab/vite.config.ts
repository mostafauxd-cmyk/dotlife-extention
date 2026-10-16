import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, type Plugin } from "vite";

/**
 * A build against another server (`VITE_API_URL`, e.g. the local one on :3100, or Paket's
 * `VITE_PAKET_API_URL`) must be allowed to reach it: its origin joins the manifest's host
 * permissions. The store build has only noghte.life and Paket's own.
 */
function apiHostPermission(): Plugin {
  return {
    name: "api-host-permission",
    closeBundle() {
      const extra = [process.env.VITE_API_URL, process.env.VITE_PAKET_API_URL]
        .filter((u): u is string => u !== undefined && u !== "")
        .map((u) => `${new URL(u).origin}/*`);
      if (extra.length === 0) return;
      const file = resolve(import.meta.dirname, "dist/manifest.json");
      const manifest = JSON.parse(readFileSync(file, "utf8")) as { host_permissions: string[] };
      for (const o of extra)
        if (!manifest.host_permissions.includes(o)) manifest.host_permissions.push(o);
      writeFileSync(file, JSON.stringify(manifest, null, 2));
    },
  };
}

/**
 * The new tab is an unpacked Chrome extension: `dist/` holds the page, its scripts and `public/`
 * (manifest, fonts, icons). Paths stay relative so they resolve under chrome-extension://<id>/.
 */
export default defineConfig({
  base: "./",
  plugins: [apiHostPermission()],
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  build: { outDir: "dist", emptyOutDir: true, target: "chrome120", assetsInlineLimit: 0 },
  server: { port: Number(process.env.PORT ?? 8098) },
});
