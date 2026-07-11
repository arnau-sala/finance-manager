import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { lockPortraitOrientation } from "./app/portrait-orientation";
import "./styles/global.css";

lockPortraitOrientation();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
