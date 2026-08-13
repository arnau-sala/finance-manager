import type { ReactNode } from "react";

import { FatalErrorFallback } from "./FatalErrorFallback";
import { Sentry } from "./sentry";

type SentryErrorBoundaryProps = {
  children: ReactNode;
};

export function SentryErrorBoundary({ children }: SentryErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary fallback={<FatalErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
