import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, type Plugin } from "vite";

/**
 * While the panel runs in development, its server answers the bundle route of docs/ads-api.md, so
 * a client running locally (the new tab with `VITE_ADS_URL=http://localhost:5190`) draws what was
 * just published: «انتشار» POSTs the bundle here and `GET /v1/ads/bundle` hands it out. The last
 * bundle is kept in `.dev/bundle.json` across restarts. Not signed; the real server signs it.
 */
function devBundleRoute(): Plugin {
  const file = resolve(import.meta.dirname, ".dev/bundle.json");
  let bundle: string | undefined;
  try {
    bundle = readFileSync(file, "utf8");
  } catch {
    bundle = undefined;
  }
  return {
    name: "dev-bundle-route",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/v1/ads/bundle", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "content-type");
        res.setHeader("Cache-Control", "no-store");
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString("utf8");
          });
          req.on("end", () => {
            try {
              JSON.parse(body);
            } catch {
              res.statusCode = 400;
              res.end();
              return;
            }
            bundle = body;
            mkdirSync(resolve(file, ".."), { recursive: true });
            writeFileSync(file, body);
            res.statusCode = 204;
            res.end();
          });
          return;
        }
        if (bundle === undefined) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(bundle);
      });
    },
  };
}

/** The NX Ads panel: a plain single-page app, served from its own port while it is built. */
export default defineConfig({
  base: "./",
  plugins: [devBundleRoute()],
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2023" },
  server: { port: Number(process.env.PORT ?? 5190) },
});
