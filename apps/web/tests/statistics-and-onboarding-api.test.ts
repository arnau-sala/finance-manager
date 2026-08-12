import { afterEach, describe, expect, it, vi } from "vitest";

import { financialQueryKeys } from "../src/cache/financial-query-keys";
import {
  getStatisticsAvailability,
  getStatisticsCharts,
  getStatisticsOverview,
  StatisticsApiError,
  statisticsAvailabilityQueryOptions,
  statisticsChartsQueryOptions,
  statisticsOverviewQueryOptions,
} from "../src/features/statistics/statistics-api";
import {
  saveStartingNetWorth,
  skipStartingNetWorth,
} from "../src/features/onboarding/starting-net-worth-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const period = {
  mode: "MONTH" as const,
  key: "2026-08",
  startDate: "2026-08-01",
  endDate: "2026-08-12",
};

const category = {
  id: "income-salary",
  name: "Salary",
  type: "INCOME" as const,
  amount: "2500.00",
  percentage: 100,
  transactionCount: 1,
  averageAmount: "2500.00",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("statistics API", () => {
  it("parses availability and creates its cache key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          availableMonths: ["2026-07", "2026-08"],
          minimumMonth: "2026-07",
          maximumMonth: "2026-08",
        }),
      ),
    );
    await expect(getStatisticsAvailability("user-1")).resolves.toEqual({
      availableMonths: ["2026-07", "2026-08"],
      minimumMonth: "2026-07",
      maximumMonth: "2026-08",
    });
    expect(statisticsAvailabilityQueryOptions("user-1").queryKey).toEqual(
      financialQueryKeys.statisticsAvailability("user-1"),
    );
  });

  it("parses overview money into numbers and sends month parameters", async () => {
    const overview = {
      period,
      money: {
        income: "2500.00",
        expenses: "500.25",
        balance: "1999.75",
        savingsPercentage: 80,
      },
      categories: [category],
      insights: {
        largestIncome: null,
        largestExpense: null,
        bestMonth: null,
        worstMonth: null,
        bestYear: null,
        worstYear: null,
        months: null,
        years: null,
      },
      expenses: {
        hasExpenseHistory: true,
        transactionCount: 2,
        typicalAmount: "20.00",
        averageAmount: "25.00",
        averagePeriodCount: 12,
        averagePeriodUnit: "DAY",
        currentStreak: {
          days: 1,
          startDate: "2026-08-12",
          endDate: "2026-08-12",
          lastExpenseDate: "2026-08-11",
        },
        longestStreak: {
          days: 4,
          startDate: "2026-07-01",
          endDate: "2026-07-04",
        },
        isLongestCurrent: false,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ overview }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getStatisticsOverview("user-1", {
      mode: "MONTH",
      month: "2026-08",
    });
    expect(result.money).toEqual({
      income: 2500,
      expenses: 500.25,
      balance: 1999.75,
      savingsPercentage: 80,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/statistics/overview?period=month&month=2026-08",
    );
    expect(
      statisticsOverviewQueryOptions("user-1", { mode: "YEAR", year: 2026 })
        .queryKey,
    ).toEqual(
      financialQueryKeys.statisticsOverview("user-1", {
        mode: "YEAR",
        year: 2026,
      }),
    );
  });

  it("parses chart data and creates all-time cache keys", async () => {
    const charts = {
      period,
      netWorth: {
        status: "READY",
        openingAmount: "1000.00",
        points: [{ date: "2026-08-01", value: "1100.00" }],
      },
      financialIntervals: [
        {
          key: "2026-08-01",
          startDate: "2026-08-01",
          endDate: "2026-08-01",
          income: "100.00",
          expenses: "0.00",
          balance: "100.00",
        },
      ],
      categories: [category],
      categoryTimeline: {
        intervals: [
          {
            key: "week-1",
            label: "Week 1",
            startDate: "2026-08-01",
            endDate: "2026-08-07",
          },
        ],
        cells: [
          {
            categoryId: "income-salary",
            type: "INCOME",
            intervalKey: "week-1",
            amount: "100.00",
            percentage: 100,
            transactionCount: 1,
          },
        ],
      },
      weekdaySpending: {
        hasEnoughData: true,
        values: [
          {
            weekday: 1,
            averageAmount: "10.00",
            totalAmount: "20.00",
            transactionCount: 2,
          },
        ],
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ charts })));
    const result = await getStatisticsCharts("user-1", { mode: "ALL" });
    expect(result.netWorth.status).toBe("READY");
    expect(result.financialIntervals[0].income).toBe(100);
    expect(statisticsChartsQueryOptions("user-1", { mode: "ALL" }).queryKey).toEqual(
      financialQueryKeys.statisticsChart("user-1", { mode: "ALL" }),
    );
  });

  it("rejects invalid payloads, failed requests and network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ availableMonths: ["bad"] })));
    await expect(getStatisticsAvailability("user-1")).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(getStatisticsCharts("user-1", { mode: "ALL" })).rejects.toBeInstanceOf(
      StatisticsApiError,
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      getStatisticsOverview("user-1", { mode: "YEAR", year: 2026 }),
    ).rejects.toMatchObject({ status: 0 });
  });
});

describe("starting net worth API", () => {
  it("saves or skips onboarding and returns the updated user", async () => {
    const user = { id: "user-1", startingNetWorth: "1000.00" };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ user })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(saveStartingNetWorth("1000")).resolves.toEqual(user);
    await expect(skipStartingNetWorth()).resolves.toEqual(user);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))).toEqual([
      { action: "SET", amount: "1000" },
      { action: "SKIP" },
    ]);
  });

  it("uses API messages and a fallback for malformed errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ error: "Out of range" }, 400)));
    await expect(saveStartingNetWorth("999999999")).rejects.toMatchObject({ message: "Out of range", status: 400 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("not-json", { status: 500 })));
    await expect(skipStartingNetWorth()).rejects.toMatchObject({ message: "Unable to finish account setup", status: 500 });
  });
});
