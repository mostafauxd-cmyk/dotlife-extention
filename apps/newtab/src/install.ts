import { load, save } from "./platform";

/**
 * Links that send a phone to an app store. Each one goes through Noghte's own address, not straight
 * to Cafe Bazaar, so the server can count installs by where in the extension the code was shown:
 * `app` (noghte | paket), `src=chrome`, `c` (the place, e.g. `signin`) and `r` (this install, an
 * anonymous id made once). The server answers with a redirect to the app's store page.
 */
const GET_URL = "https://noghte.life/get";

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
  const u = new URL(GET_URL);
  u.searchParams.set("app", app);
  u.searchParams.set("src", "chrome");
  u.searchParams.set("c", place);
  u.searchParams.set("r", install);
  return u.toString();
}
