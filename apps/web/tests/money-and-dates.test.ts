import { describe, expect, it } from "vitest";

import {
  getTodayDateOnly,
  parseLocalDateOnly,
} from "../src/dates/date-only";
import { formatEuroAmount } from "../src/money/format-euro";
import {
  isEditableStartingNetWorth,
  parseStartingNetWorth,
} from "../src/money/starting-net-worth-validation";

describe("money formatting and validation", () => {
  it("formats whole, decimal, and signed euro amounts", () => {
    expect(formatEuroAmount(12, { fractionDigits: 0 })).toBe("12€");
    expect(formatEuroAmount("12.5")).toBe("12,50€");
    expect(formatEuroAmount(12, { showSign: true, fractionDigits: 0 })).toBe(
      "+12€",
    );
    expect(formatEuroAmount("invalid")).toBe("Amount unavailable");
  });

  it("accepts editable partial amounts but validates final bounds", () => {
    expect(isEditableStartingNetWorth("-1234,")).toBe(true);
    expect(parseStartingNetWorth("-1234,50")).toBe("-1234.50");
    expect(parseStartingNetWorth("10000001")).toBeNull();
    expect(parseStartingNetWorth("12.345")).toBeNull();
  });
});

describe("local date helpers", () => {
  it("formats a local date without shifting its day", () => {
    expect(getTodayDateOnly(new Date(2026, 7, 12, 23, 30))).toBe("2026-08-12");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseLocalDateOnly("2026-02-28")).toBeInstanceOf(Date);
    expect(parseLocalDateOnly("2026-02-30")).toBeNull();
    expect(parseLocalDateOnly("not-a-date")).toBeNull();
  });
});
