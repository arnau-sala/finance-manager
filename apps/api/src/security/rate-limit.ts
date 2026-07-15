import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";

function getBodyEmail(request: FastifyRequest) {
  const body = request.body;

  if (!body || typeof body !== "object" || !("email" in body)) {
    return "unknown";
  }

  const email = (body as { email?: unknown }).email;

  return typeof email === "string" ? email.trim().toLowerCase() : "unknown";
}

function getSessionUserId(request: FastifyRequest) {
  return request.session?.get("userId") ?? null;
}

function getSessionOrIpKey(request: FastifyRequest, scope: string) {
  return `${scope}:${getSessionUserId(request) ?? request.ip}`;
}

export function registerRateLimit(app: FastifyInstance) {
  app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: "Too many requests.",
      message: `Rate limit exceeded. Retry in ${context.after}.`,
      retryAfter: context.after,
    }),
  });
}

export const authLoginRateLimit = {
  hook: "preHandler" as const,
  max: 20,
  timeWindow: "15 minutes",
  keyGenerator: (request: FastifyRequest) =>
    `auth-login:${request.ip}:${getBodyEmail(request)}`,
};

export const authRegisterRateLimit = {
  hook: "preHandler" as const,
  max: 8,
  timeWindow: "15 minutes",
  keyGenerator: (request: FastifyRequest) =>
    `auth-register:${request.ip}:${getBodyEmail(request)}`,
};

export const authLogoutRateLimit = {
  hook: "preHandler" as const,
  max: 30,
  timeWindow: "1 minute",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "auth-logout"),
};

export const accountDeletionRateLimit = {
  hook: "preHandler" as const,
  max: 5,
  timeWindow: "15 minutes",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "account-deletion"),
};

export const accountWriteRateLimit = {
  hook: "preHandler" as const,
  max: 30,
  timeWindow: "15 minutes",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "account-write"),
};

export const passwordChangeRateLimit = {
  hook: "preHandler" as const,
  max: 5,
  timeWindow: "15 minutes",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "password-change"),
};

export const authGoogleRateLimit = {
  hook: "preHandler" as const,
  max: 30,
  timeWindow: "15 minutes",
  keyGenerator: (request: FastifyRequest) => `auth-google:${request.ip}`,
};

export const accessRequestRateLimit = {
  hook: "preHandler" as const,
  max: 10,
  timeWindow: "1 hour",
  keyGenerator: (request: FastifyRequest) =>
    `access-request:${request.ip}:${getBodyEmail(request)}`,
};

export const financialReadRateLimit = {
  hook: "preHandler" as const,
  max: 180,
  timeWindow: "1 minute",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "financial-read"),
};

export const financialWriteRateLimit = {
  hook: "preHandler" as const,
  max: 60,
  timeWindow: "1 minute",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "financial-write"),
};

export const adminRateLimit = {
  max: 120,
  timeWindow: "1 minute",
  keyGenerator: (request: FastifyRequest) =>
    getSessionOrIpKey(request, "admin"),
};
