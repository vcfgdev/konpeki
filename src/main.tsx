import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-serif/latin-400.css";
import "@fontsource/ibm-plex-serif/latin-500.css";
import "@fontsource/ibm-plex-serif/latin-600.css";
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-sans/latin-500.css";
import "@fontsource/noto-sans/latin-600.css";
import "@fontsource/hanken-grotesk/latin-400.css";
import "@fontsource/hanken-grotesk/latin-500.css";
import "@fontsource/hanken-grotesk/latin-600.css";
import { App } from "./app/App.tsx";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/chrome.css";
import "./styles/left-panel.css";
import "./styles/right-panel.css";
import "./styles/canvas.css";
import "./styles/component-previews.css";
import "./styles/feedback.css";
import "./styles/presentation.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
