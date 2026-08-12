import * as Sentry from "@sentry/react";

let initialized = false;

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

function sanitizeUrl(value: string | undefined) {
  if (!value) {
    return value;
  }

  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

export function initializeWebObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

  if (!dsn || import.meta.env.MODE === "test") {
    return false;
  }

  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      import.meta.env.PROD ? 0.1 : 0,
    ),
    tracePropagationTargets: [/^\/api(?:\/|$)/],
    beforeSend(event) {
      if (event.request) {
        event.request = {
          method: event.request.method,
          url: sanitizeUrl(event.request.url),
        };
      }

      event.user = event.user?.id ? { id: event.user.id } : undefined;
      return event;
    },
    beforeSendTransaction(event) {
      if (event.request) {
        event.request = {
          method: event.request.method,
          url: sanitizeUrl(event.request.url),
        };
      }

      return event;
    },
  });

  initialized = true;
  return true;
}

export function setObservabilityUser(userId: string | null) {
  if (!initialized) {
    return;
  }

  Sentry.setUser(userId ? { id: userId } : null);
}

export { Sentry };
