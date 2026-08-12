import type { ReactNode } from "react";

import { ActionButton } from "../components/ui/ActionButton";
import { Sentry } from "./sentry";

type SentryErrorBoundaryProps = {
  children: ReactNode;
};

function FatalErrorFallback() {
  return (
    <main className="app-error-fallback" role="alert">
      <img
        src="/icons/app-icon-512.png"
        width={72}
        height={72}
        draggable={false}
        alt=""
      />
      <h1>Something went wrong</h1>
      <p>The error has been recorded so it can be fixed</p>
      <ActionButton type="button" onClick={() => window.location.reload()}>
        Reload app
      </ActionButton>
    </main>
  );
}

export function SentryErrorBoundary({ children }: SentryErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary fallback={<FatalErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
