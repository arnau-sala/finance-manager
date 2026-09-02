import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  feedbackCreate: vi.fn(),
  categoryFindMany: vi.fn(),
}));

vi.mock("../src/auth/authenticated-user.js", () => authMocks);
vi.mock("../src/db/client.js", () => ({
  db: {
    feedbackEntry: { create: dbMocks.feedbackCreate },
    category: { findMany: dbMocks.categoryFindMany },
  },
}));

import { categoryRoutes } from "../src/routes/categories.js";
import { feedbackRoutes } from "../src/routes/feedback.js";

async function createRoutesApp() {
  const app = Fastify();
  await app.register(feedbackRoutes, { prefix: "/api" });
  await app.register(categoryRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("financial routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedUser.mockResolvedValue({
      id: "user-1",
      email: "account@example.com",
    });
    authMocks.getAuthenticatedUserId.mockResolvedValue("user-1");
    dbMocks.feedbackCreate.mockResolvedValue({ id: "feedback-1" });
    dbMocks.categoryFindMany.mockResolvedValue([]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("stores authenticated suggestions with account data", async () => {
    const app = await createRoutesApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: { type: "suggestion", message: "Custom categories" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: "created" });
    expect(dbMocks.feedbackCreate).toHaveBeenCalledWith({
      data: {
        type: "SUGGESTION",
        message: "Custom categories",
        userId: "user-1",
        name: null,
        email: "account@example.com",
      },
    });
    await app.close();
  });

  it("keeps anonymous and landing feedback detached from users", async () => {
    const app = await createRoutesApp();
    const anonymous = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        type: "general",
        message: "Useful app",
        email: "reply@example.com",
        anonymous: true,
      },
    });
    expect(anonymous.statusCode).toBe(201);
    expect(dbMocks.feedbackCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ userId: null, name: null }),
    });

    authMocks.getAuthenticatedUser.mockResolvedValueOnce(null);
    const landing = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        type: "landing",
        message: "Desktop feedback",
        name: "Visitor",
        email: "visitor@example.com",
      },
    });
    expect(landing.statusCode).toBe(201);
    expect(dbMocks.feedbackCreate).toHaveBeenLastCalledWith({
      data: {
        type: "LANDING",
        message: "Desktop feedback",
        userId: null,
        name: "Visitor",
        email: "visitor@example.com",
      },
    });
    await app.close();
  });

  it("stores explicit feedback emails and trims optional landing contact data", async () => {
    const app = await createRoutesApp();

    const general = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        type: "general",
        message: "Something feels off",
        email: "custom@example.com",
      },
    });
    expect(general.statusCode).toBe(201);
    expect(dbMocks.feedbackCreate).toHaveBeenLastCalledWith({
      data: {
        type: "GENERAL",
        message: "Something feels off",
        userId: "user-1",
        name: null,
        email: "custom@example.com",
      },
    });

    authMocks.getAuthenticatedUser.mockResolvedValueOnce(null);
    const landing = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        type: "landing",
        message: "Landing modal feedback",
        name: "   ",
        email: "   ",
      },
    });
    expect(landing.statusCode).toBe(201);
    expect(dbMocks.feedbackCreate).toHaveBeenLastCalledWith({
      data: {
        type: "LANDING",
        message: "Landing modal feedback",
        userId: null,
        name: null,
        email: null,
      },
    });

    await app.close();
  });

  it("rejects unauthenticated account feedback and invalid payloads", async () => {
    const app = await createRoutesApp();
    authMocks.getAuthenticatedUser.mockResolvedValue(null);

    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: { type: "general", message: "Hello" },
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: { type: "landing", message: "", extra: true },
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(400);
    expect(dbMocks.feedbackCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns categories in UI order and keeps Other last", async () => {
    dbMocks.categoryFindMany.mockResolvedValue([
      { id: "i-o", name: "Other", type: "INCOME" },
      { id: "e-o", name: "Other", type: "EXPENSE" },
      { id: "i-s", name: "Salary", type: "INCOME" },
      { id: "e-d", name: "Dining", type: "EXPENSE" },
      { id: "e-c", name: "Car", type: "EXPENSE" },
    ]);
    const app = await createRoutesApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/categories?type=EXPENSE",
    });

    expect(response.statusCode).toBe(200);
    expect(dbMocks.categoryFindMany).toHaveBeenCalledWith({
      where: { type: "EXPENSE" },
      select: { id: true, name: true, type: true },
    });
    expect(response.json().categories.map((item: { id: string }) => item.id)).toEqual([
      "e-c",
      "e-d",
      "e-o",
      "i-s",
      "i-o",
    ]);
    await app.close();
  });

  it("protects category reads and validates query parameters", async () => {
    const app = await createRoutesApp();
    authMocks.getAuthenticatedUserId.mockResolvedValueOnce(null);
    expect(
      (await app.inject({ method: "GET", url: "/api/categories" })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/categories?type=TRANSFER",
        })
      ).statusCode,
    ).toBe(400);
    await app.close();
  });
});
