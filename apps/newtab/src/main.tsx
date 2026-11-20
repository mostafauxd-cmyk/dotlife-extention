import { createRoot } from "react-dom/client";

import { App } from "./App";
import { loadGoogle } from "./google";
import { loadPaket } from "./paket";
import { watchInbox } from "./noghte/inbox";
import { startSync } from "./noghte/sync";
import { loadSettings } from "./settings";
import "./styles.css";
import { installMorph } from "./ui/morph";

/**
 * Settings first (the language and the layout come from them), then the session, Google and Paket
 * together — each reads only the extension's own storage, a few ms — then the page. Not one after
 * the other: the search box appears as soon as it can (public/focus.js).
 */
async function start(): Promise<void> {
  await loadSettings();
  await Promise.all([
    startSync().then(() => {
      // the records are open: pages kept from the right-click menu become tasks
      watchInbox();
    }),
    loadGoogle(),
    loadPaket(),
  ]);
  const root = document.getElementById("root");
  if (root !== null) createRoot(root).render(<App />);
  installMorph();
}

/** public/focus.js: this load only moves the tab to its own address; the next one draws. */
const w = window as Window & { __noghteMoving?: boolean; __noghteStart?: () => void };
if (w.__noghteMoving === true) w.__noghteStart = () => void start();
else void start();
