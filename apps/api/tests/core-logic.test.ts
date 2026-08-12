import { describe, expect, it } from "vitest";

import {
  formatDateOnly,
  getMonthDateOnlyRange,
  getYearDateOnlyRange,
  parseDateOnly,
} from "../src/dates/date-only.js";
import { centsToDecimal } from "../src/money/cents.js";
import {
  getInclusiveDayCount,
  getMonthKeys,
  resolveStatisticsPeriod,
} from "../src/services/statistics-period.js";

describe("API date helpers", () => {
  it("creates exclusive month and year ranges", () => {
    expect(getMonthDateOnlyRange(2, 2024)).toEqual({
      from: "2024-02-01",
      to: "2024-03-01",
    });
    expect(getYearDateOnlyRange(2026)).toEqual({
      from: "2026-01-01",
      to: "2027-01-01",
    });
    expect(formatDateOnly(parseDateOnly("2026-08-12"))).toBe("2026-08-12");
  });
});

describe("statistics periods", () => {
  it("caps the current month at today", () => {
    expect(
      resolveStatisticsPeriod(
        { mode: "MONTH", month: "2026-08" },
        "2026-08-12",
        "2025-01-10",
      ),
    ).toEqual({
      mode: "MONTH",
      key: "2026-08",
      from: "2026-08-01",
      to: "2026-08-13",
      endDate: "2026-08-12",
    });
  });

  it("keeps complete historical periods and enumerates months", () => {
    expect(
      resolveStatisticsPeriod(
        { mode: "YEAR", year: 2025 },
        "2026-08-12",
        "2025-01-10",
      ).endDate,
    ).toBe("2025-12-31");
    expect(getMonthKeys("2025-11-15", "2026-02-01")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(getInclusiveDayCount("2026-08-01", "2026-08-12")).toBe(12);
  });
});

describe("money conversion", () => {
  it("preserves signs and two decimal places", () => {
    expect(centsToDecimal(1200)).toBe("12.00");
    expect(centsToDecimal(-5)).toBe("-0.05");
  });
});
