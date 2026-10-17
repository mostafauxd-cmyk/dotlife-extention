import { load, save } from "./platform";

/**
 * Links that send a phone to an app, each marked so a visit can be traced to where in the extension
 * the code was shown: `src=chrome`, `c` (the place, e.g. `signin`) and `r` (this install, an
 * anonymous id made once). Noghte goes through its own address, which counts the install and
 * redirects to the store page (`app=noghte`); Paket's is its own site, paket.life.
 */
const GET_URL = "https://noghte.life/get";
const PAKET_URL = "https://paket.life/";

export type App = "noghte" | "paket";

let id: Promise<string> | null = null;

/** An anonymous id for this install, made once and kept with the extension's data. */
export function installId(): Promise<string> {
  id ??= (async () => {
    const kept = await load<string>("installId");
    if (kept !== undefined) return kept;
    const made = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    await save("installId", made);
    return made;
  })();
  return id;
}

export function getLink(app: App, place: string, install: string): string {
  const u = new URL(app === "paket" ? PAKET_URL : GET_URL);
  if (app === "noghte") u.searchParams.set("app", app);
  u.searchParams.set("src", "chrome");
  u.searchParams.set("c", place);
  u.searchParams.set("r", install);
  return u.toString();
}
