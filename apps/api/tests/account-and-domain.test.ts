import { afterEach, describe, expect, it, vi } from "vitest";

import { startingNetWorthSchema } from "../src/account/starting-net-worth.js";
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
  toAuthenticatedUserResponse,
} from "../src/auth/authenticated-user.js";
import {
  supportsGoogleAuthentication,
  supportsPasswordAuthentication,
} from "../src/auth/auth-provider.js";
import {
  createLegalAcceptance,
  currentLegalVersion,
} from "../src/auth/legal-acceptance.js";
import {
  createAccountRecoveryCode,
  hashCanonicalRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodeSchema,
} from "../src/auth/recovery-code.js";
import {
  normalizeLoginIdentifier,
  usernameSchema,
} from "../src/auth/username-validation.js";
import { userNameSchema } from "../src/auth/user-validation.js";
import {
  getPaginatedResponse,
  getPaginationQuerySchema,
} from "../src/pagination.js";
import {
  getCurrentNetWorth,
  getNetWorthSeries,
} from "../src/services/net-worth-service.js";
import {
  getTransactionDetail,
  toTransactionResponse,
} from "../src/services/transaction-service.js";
import { db } from "../src/db/client.js";

afterEach(() => vi.restoreAllMocks());

describe("account domain rules", () => {
  it("detects the sign-in methods supported by every provider", () => {
    expect(supportsPasswordAuthentication("PASSWORD")).toBe(true);
    expect(supportsPasswordAuthentication("PASSWORD_AND_GOOGLE")).toBe(true);
    expect(supportsPasswordAuthentication("GOOGLE")).toBe(false);
    expect(supportsGoogleAuthentication("GOOGLE")).toBe(true);
    expect(supportsGoogleAuthentication("PASSWORD_AND_GOOGLE")).toBe(true);
    expect(supportsGoogleAuthentication("PASSWORD")).toBe(false);
  });

  it("normalizes usernames and enforces account limits", () => {
    expect(normalizeLoginIdentifier("  Arnau_01  ")).toBe("arnau_01");
    expect(usernameSchema.parse("  Arnau_01  ")).toBe("arnau_01");
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("_arnau").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(16)).success).toBe(false);
    expect(userNameSchema.parse("  Arnau  ")).toBe("Arnau");
    expect(userNameSchema.safeParse(" ").success).toBe(false);
  });

  it("parses starting net worth values into signed cents", () => {
    expect(startingNetWorthSchema.parse("1250.50")).toBe(125050);
    expect(startingNetWorthSchema.parse(-12.3)).toBe(-1230);
    expect(startingNetWorthSchema.parse("10000000")).toBe(1_000_000_000);
    expect(startingNetWorthSchema.safeParse("10000000.01").success).toBe(false);
    expect(startingNetWorthSchema.safeParse("12.345").success).toBe(false);
  });

  it("creates timestamped legal acceptance data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T10:00:00.000Z"));
    expect(createLegalAcceptance()).toEqual({
      legalAcceptedAt: new Date("2026-08-12T10:00:00.000Z"),
      legalAcceptedVersion: currentLegalVersion,
    });
    vi.useRealTimers();
  });

  it("creates, normalizes and hashes one-use recovery codes", () => {
    const recovery = createAccountRecoveryCode();
    const canonical = recovery.displayCode.replaceAll("-", "");

    expect(canonical).toHaveLength(16);
    expect(recovery.displayCode).toMatch(/^.{4}-.{4}-.{4}-.{4}$/);
    expect(normalizeRecoveryCode(` ${recovery.displayCode} `)).toBe(canonical);
    expect(recoveryCodeSchema.parse(recovery.displayCode)).toBe(canonical);
    expect(recovery.codeHash).toBe(hashCanonicalRecoveryCode(canonical));
    expect(recoveryCodeSchema.safeParse("0000-0000-0000-0000").success).toBe(
      false,
    );
  });
});

describe("pagination", () => {
  const schema = getPaginationQuerySchema({ defaultLimit: 20, maxLimit: 50 });

  it("applies defaults and coerces valid query strings", () => {
    expect(schema.parse({})).toEqual({ limit: 20, offset: 0 });
    expect(schema.parse({ limit: "10", offset: "30" })).toEqual({
      limit: 10,
      offset: 30,
    });
  });

  it("rejects invalid and unknown pagination values", () => {
    expect(schema.safeParse({ limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ limit: 51 }).success).toBe(false);
    expect(schema.safeParse({ offset: -1 }).success).toBe(false);
    expect(schema.safeParse({ extra: true }).success).toBe(false);
  });

  it("returns one look-ahead item as a next page signal", () => {
    expect(getPaginatedResponse([1, 2, 3], 2, 4)).toEqual({
      items: [1, 2],
      pagination: { limit: 2, offset: 4, nextOffset: 6 },
    });
    expect(getPaginatedResponse([1, 2], 2, 0).pagination.nextOffset).toBeNull();
  });
});

describe("API response mapping", () => {
  it("serializes authenticated users without exposing private fields", () => {
    const response = toAuthenticatedUserResponse({
      id: "user-1",
      email: "arnau@example.com",
      username: "arnau",
      name: "Arnau",
      authProvider: "PASSWORD_AND_GOOGLE",
      emailLoginEnabled: true,
      role: "USER",
      status: "APPROVED",
      sessionVersion: 3,
      startingNetWorthCents: 12345,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-12T00:00:00.000Z"),
    });

    expect(response).toEqual({
      id: "user-1",
      email: "arnau@example.com",
      username: "arnau",
      name: "Arnau",
      authProvider: "PASSWORD_AND_GOOGLE",
      emailLoginEnabled: true,
      role: "USER",
      status: "APPROVED",
      startingNetWorth: "123.45",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
    });
  });

  it("preserves null profile values and maps transaction money and dates", () => {
    const user = toAuthenticatedUserResponse({
      id: "user-2",
      email: null,
      username: "local-user",
      name: "Local",
      authProvider: "PASSWORD",
      emailLoginEnabled: false,
      role: "USER",
      status: "APPROVED",
      sessionVersion: 0,
      startingNetWorthCents: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });
    expect(user.startingNetWorth).toBeNull();
    expect(user.updatedAt).toBeNull();

    expect(
      toTransactionResponse({
        id: "tx-1",
        userId: "user-2",
        type: "EXPENSE",
        categoryId: "expense-groceries",
        amountCents: 1299,
        description: "Groceries",
        occurredOn: new Date("2026-08-05T00:00:00.000Z"),
        createdAt: new Date("2026-08-05T09:30:00.000Z"),
        category: {
          id: "expense-groceries",
          name: "Groceries",
          type: "EXPENSE",
        },
      }),
    ).toMatchObject({ amount: "12.99", date: "2026-08-05" });
  });

  it("rejects incomplete or stale sessions and resolves valid session users", async () => {
    const deleteSession = vi.fn();
    const sessionGet = vi.fn((key: string) =>
      key === "userId" ? "user-1" : undefined,
    );
    const request = { session: { get: sessionGet, delete: deleteSession } };
    await expect(getAuthenticatedUser(request as never)).resolves.toBeNull();
    expect(deleteSession).toHaveBeenCalledOnce();

    const user = {
      id: "user-1",
      email: null,
      username: "arnau",
      name: "Arnau",
      authProvider: "PASSWORD" as const,
      emailLoginEnabled: false,
      role: "USER" as const,
      status: "APPROVED" as const,
      sessionVersion: 2,
      startingNetWorthCents: 0,
      createdAt: new Date(),
      updatedAt: null,
    };
    sessionGet.mockImplementation((key: string) =>
      key === "userId" ? "user-1" : 2,
    );
    vi.spyOn(db.user, "findFirst").mockResolvedValueOnce(user);
    await expect(getAuthenticatedUser(request as never)).resolves.toBe(user);

    vi.spyOn(db.user, "findFirst").mockResolvedValueOnce(null);
    await expect(getAuthenticatedUserId(request as never)).resolves.toBeNull();
    expect(deleteSession).toHaveBeenCalledTimes(2);
  });

  it("does not query the database for a session without a user id", async () => {
    const findFirst = vi.spyOn(db.user, "findFirst");
    const request = {
      session: { get: vi.fn().mockReturnValue(undefined), delete: vi.fn() },
    };
    await expect(getAuthenticatedUserId(request as never)).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("net worth calculations", () => {
  it("returns null when no opening balance exists", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([
      { startingNetWorthCents: null, currentNetWorthCents: null },
    ]);
    await expect(getCurrentNetWorth("user-1", "2026-08-12")).resolves.toBeNull();
  });

  it("returns current net worth and a daily series", async () => {
    vi.spyOn(db, "$queryRaw")
      .mockResolvedValueOnce([
        { startingNetWorthCents: 100_000, currentNetWorthCents: 125_050n },
      ])
      .mockResolvedValueOnce([
        { startingNetWorthCents: 100_000, date: null, deltaCents: 0n },
        { startingNetWorthCents: 100_000, date: "2026-07-31", deltaCents: 5_000n },
        { startingNetWorthCents: 100_000, date: "2026-08-02", deltaCents: -2_500n },
      ]);

    await expect(getCurrentNetWorth("user-1", "2026-08-12")).resolves.toBe(
      "1250.50",
    );
    await expect(
      getNetWorthSeries("user-1", {
        mode: "MONTH",
        key: "2026-08",
        from: "2026-08-01",
        to: "2026-08-04",
        endDate: "2026-08-03",
      }),
    ).resolves.toEqual({
      status: "READY",
      openingAmount: "1000.00",
      points: [
        { date: "2026-08-01", value: "1050.00" },
        { date: "2026-08-02", value: "1025.00" },
        { date: "2026-08-03", value: "1025.00" },
      ],
    });
  });

  it("reduces all-time series to the opening point and month ends", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([
      { startingNetWorthCents: 10_000, date: null, deltaCents: 0n },
      { startingNetWorthCents: 10_000, date: "2026-01-15", deltaCents: 1_000n },
      { startingNetWorthCents: 10_000, date: "2026-02-01", deltaCents: 500n },
    ]);

    const result = await getNetWorthSeries("user-1", {
      mode: "ALL",
      key: "all",
      from: "2026-01-01",
      to: "2026-02-03",
      endDate: "2026-02-02",
    });

    expect(result.status).toBe("READY");
    expect(result.points.map((point) => point.date)).toEqual([
      "2026-01-01",
      "2026-01-31",
      "2026-02-02",
    ]);
  });

  it("requires an opening balance before building a series", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([
      { startingNetWorthCents: null, date: null, deltaCents: 0n },
    ]);
    await expect(
      getNetWorthSeries("user-1", {
        mode: "YEAR",
        key: "2026",
        from: "2026-01-01",
        to: "2027-01-01",
        endDate: "2026-08-12",
      }),
    ).resolves.toEqual({ status: "OPENING_BALANCE_REQUIRED", points: [] });
  });
});

describe("transaction details", () => {
  const aggregateRow = {
    id: "tx-1",
    userId: "user-1",
    type: "EXPENSE" as const,
    categoryId: "expense-dining",
    amountCents: 25,
    description: "Coffee",
    occurredOn: new Date("2026-08-12T00:00:00.000Z"),
    createdAt: new Date("2026-08-12T10:00:00.000Z"),
    categoryName: "Dining",
    categoryType: "EXPENSE" as const,
    trackedBalanceBeforeCents: 1000n,
    monthCategoryPosition: 1n,
    monthCategoryTotal: 2n,
    monthTypePosition: 2n,
    monthTypeTotal: 5n,
    monthTypeAmountCents: 10000n,
    yearCategoryPosition: 3n,
    yearCategoryTotal: 8n,
    yearTypePosition: 4n,
    yearTypeTotal: 20n,
    yearTypeAmountCents: 1000n,
    allCategoryPosition: 5n,
    allCategoryTotal: 10n,
    allTypePosition: 6n,
    allTypeTotal: 30n,
    allTypeAmountCents: 0n,
  };

  it("combines balance, rank and impact information", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([aggregateRow]);
    const detail = await getTransactionDetail("user-1", "tx-1");

    expect(detail).toMatchObject({
      transaction: { id: "tx-1", amount: "0.25" },
      trackedBalance: { before: "10.00", after: "9.75" },
      contexts: {
        month: {
          categoryRank: { position: 1, total: 2 },
          typeRank: { position: 2, total: 5 },
          periodImpactPercentage: 0.3,
        },
        year: { periodImpactPercentage: 3 },
        all: { periodImpactPercentage: 0 },
      },
    });
  });

  it("returns null for an inaccessible transaction", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([]);
    await expect(getTransactionDetail("user-1", "missing")).resolves.toBeNull();
  });

  it("rejects aggregate values outside JavaScript's safe range", async () => {
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([
      {
        ...aggregateRow,
        trackedBalanceBeforeCents: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      },
    ]);
    await expect(getTransactionDetail("user-1", "tx-1")).rejects.toThrow(
      "aggregate exceeds the safe range",
    );
  });
});
