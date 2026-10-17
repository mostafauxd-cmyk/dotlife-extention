import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";
import { installMorph } from "./ui/morph";

// never drawn inside another site's frame (the host's frame-ancestors header is the real guard)
if (window.top !== window.self) throw new Error("NX Ads does not run inside a frame");

installMorph();

const root = document.getElementById("root");
if (root === null) throw new Error("#root is missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
