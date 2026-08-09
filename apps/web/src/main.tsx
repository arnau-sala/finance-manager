import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import { App } from "./app/App";
import { lockPortraitOrientation } from "./app/portrait-orientation";
import { StandaloneGate } from "./app/StandaloneGate";
import { queryClient } from "./cache/query-client";
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "./styles/tokens.css";
import "./styles/text-fields.css";
import "./styles/global.css";
import "./styles/buttons.css";

lockPortraitOrientation();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StandaloneGate>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StandaloneGate>
  </StrictMode>
);
