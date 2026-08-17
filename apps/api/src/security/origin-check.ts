import type { FastifyInstance } from "fastify";

import { getProductionAllowedOrigins } from "../config/deployment.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEVELOPMENT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function getConfiguredAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

function getAllowedOrigins() {
  const configuredAllowedOrigins = getConfiguredAllowedOrigins();

  if (configuredAllowedOrigins.length > 0) {
    return configuredAllowedOrigins;
  }

  if (process.env.NODE_ENV === "production") {
    return getProductionAllowedOrigins();
  }

  return DEVELOPMENT_ALLOWED_ORIGINS;
}

export function registerOriginCheck(app: FastifyInstance) {
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("preHandler", async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) {
      return;
    }

    if (request.headers["sec-fetch-site"] === "cross-site") {
      return reply.code(403).send({ error: "Origin not allowed" });
    }

    const originHeader = request.headers.origin;

    if (originHeader === undefined) {
      return;
    }

    const origin =
      typeof originHeader === "string" ? normalizeOrigin(originHeader) : null;

    if (!origin || !allowedOrigins.has(origin)) {
      return reply.code(403).send({ error: "Origin not allowed" });
    }
  });
}
