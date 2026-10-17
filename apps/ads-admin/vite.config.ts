import { defineConfig } from "vite";

/** The ads admin panel: a plain single-page app, served from its own port while it is built. */
export default defineConfig({
  base: "./",
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2023" },
  server: { port: Number(process.env.PORT ?? 5190) },
});
