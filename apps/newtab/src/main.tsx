import { createRoot } from "react-dom/client";

import { App } from "./App";
import { loadGoogle } from "./google";
import { loadPaket } from "./paket";
import { startSync } from "./noghte/sync";
import { loadSettings } from "./settings";
import "./styles.css";
import { installMorph } from "./ui/morph";

/** Settings and the session first (from the extension's own storage, a few ms), then the page. */
async function start(): Promise<void> {
  await loadSettings();
  await startSync();
  await loadGoogle();
  await loadPaket();
  const root = document.getElementById("root");
  if (root !== null) createRoot(root).render(<App />);
  installMorph();
}

void start();
