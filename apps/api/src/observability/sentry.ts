import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";

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
    const url = new URL(value, "http://localhost");
    return url.pathname;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function sanitizeEventRequest<T extends Sentry.Event>(event: T) {
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: sanitizeUrl(event.request.url),
    };
  }

  event.user = event.user?.id ? { id: event.user.id } : undefined;
  return event;
}

export function initializeApiObservability() {
  const dsn = process.env.SENTRY_DSN?.trim();

  if (!dsn || process.env.NODE_ENV === "test") {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release:
      process.env.SENTRY_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      undefined,
    sendDefaultPii: false,
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "production" ? 0.1 : 0,
    ),
    beforeSend: sanitizeEventRequest,
    beforeSendTransaction: sanitizeEventRequest,
  });

  initialized = true;
  return true;
}

export function registerApiErrorMonitoring(app: FastifyInstance) {
  if (!initialized) {
    return;
  }

  Sentry.setupFastifyErrorHandler(app);
}
