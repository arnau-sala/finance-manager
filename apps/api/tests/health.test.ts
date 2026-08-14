import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const app = buildApp();

app.get("/__tests__/unhandled-error", async () => {
  throw new Error("SENSITIVE_INTERNAL_DETAIL");
});

app.post("/__tests__/write", async (_request, reply) => {
  return reply.code(204).send();
});

describe("API health", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("responds without requiring a database connection", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("describes the API at its root without requiring a database", async () => {
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: "Finance Manager API",
      status: "ok",
      health: "/health",
    });
  });

  it("does not expose internal exception messages", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__tests__/unhandled-error",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("SENSITIVE_INTERNAL_DETAIL");
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("rejects foreign and malformed origins on state-changing requests", async () => {
    for (const origin of ["https://evil.example", "null", "not-an-origin"]) {
      const response = await app.inject({
        method: "POST",
        url: "/__tests__/write",
        headers: { origin },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Origin not allowed" });
    }

    const crossSiteResponse = await app.inject({
      method: "POST",
      url: "/__tests__/write",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(crossSiteResponse.statusCode).toBe(403);
  });

  it("allows configured and originless state-changing requests", async () => {
    const allowedOrigin =
      process.env.ALLOWED_ORIGINS?.split(",")
        .map((origin) => origin.trim())
        .find(Boolean) ?? "http://localhost:5173";
    const configuredOrigin = await app.inject({
      method: "POST",
      url: "/__tests__/write",
      headers: { origin: allowedOrigin },
    });
    const originless = await app.inject({
      method: "POST",
      url: "/__tests__/write",
    });

    expect(configuredOrigin.statusCode).toBe(204);
    expect(originless.statusCode).toBe(204);
  });
});
