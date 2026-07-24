import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { lockPortraitOrientation } from "./app/portrait-orientation";
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "./styles/tokens.css";
import "./styles/global.css";

lockPortraitOrientation();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
