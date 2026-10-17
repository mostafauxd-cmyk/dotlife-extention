import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, type Plugin } from "vite";

/**
 * While the panel runs in development, its server answers the bundle route of docs/ads-api.md, so
 * a client running locally (the new tab with `VITE_ADS_URL=http://localhost:5190`) draws what was
 * just published: «انتشار» POSTs the bundle here and `GET /v1/ads/bundle` hands it out. The last
 * bundle is kept in `.dev/bundle.json` across restarts. Not signed; the real server signs it.
 */
const MAX_BUNDLE = 5_000_000;

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
          let tooBig = false;
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString("utf8");
            if (body.length > MAX_BUNDLE) tooBig = true;
          });
          req.on("end", () => {
            if (tooBig) {
              res.statusCode = 413;
              res.end();
              return;
            }
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

/**
 * The rules the browser enforces on the panel (docs/ads-security.md): scripts and connections only
 * from its own origin, pictures from https only, no plugins, no framing, no <base> tricks. The built
 * page carries it as a meta tag; the server that hosts it must also send it, with frame-ancestors,
 * as a header (a meta tag cannot forbid framing).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React's style props are inline style attributes
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Sent by the dev and preview servers too, so what breaks under them breaks here first. */
const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      // frame-ancestors is ignored in a meta tag; the host's header carries it
      const meta = CSP.split("; ")
        .filter((d) => !d.startsWith("frame-ancestors"))
        .join("; ");
      return html.replace(
        '<meta charset="utf-8" />',
        `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${meta}" />\n    <meta name="referrer" content="no-referrer" />`,
      );
    },
  };
}

const noghteProxy = {
  target: process.env.NOGHTE_API_URL ?? "https://noghte.life/api",
  changeOrigin: true,
  rewrite: (path: string): string => path.replace(/^\/noghte/, ""),
};

/** The NX Ads panel: a plain single-page app, served from its own port while it is built. */
export default defineConfig({
  base: "./",
  plugins: [devBundleRoute(), cspMeta()],
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2023" },
  // Noghte's server sends no CORS headers, so the panel reaches it through its own server:
  // `/noghte/admin/api/promos` → `<NOGHTE_API_URL>/admin/api/promos` (the live one by default)
  server: {
    port: Number(process.env.PORT ?? 5190),
    // only this machine, never the network
    host: "localhost",
    headers: SECURITY_HEADERS,
    proxy: { "/noghte": noghteProxy },
  },
  preview: {
    host: "localhost",
    headers: { ...SECURITY_HEADERS, "Content-Security-Policy": CSP },
    proxy: { "/noghte": noghteProxy },
  },
});
