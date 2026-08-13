import { describe, expect, it } from "vitest";

import {
  getTodayDateOnly,
  parseLocalDateOnly,
} from "../src/dates/date-only";
import {
  formatEuroAmount,
  formatEuroInputAmount,
} from "../src/money/format-euro";
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
    expect(formatEuroAmount(1234, { fractionDigits: 0 })).toBe(
      "1\u202f234\u20ac",
    );
    expect(formatEuroAmount("1234567.5")).toBe(
      "1\u202f234\u202f567,50\u20ac",
    );
    expect(formatEuroAmount(-1234, { showSign: true, fractionDigits: 0 })).toBe(
      "-1\u202f234\u20ac",
    );
    expect(formatEuroAmount("invalid")).toBe("Amount unavailable");
  });

  it("formats editable euro input amounts without changing decimals", () => {
    expect(formatEuroInputAmount("1234.5")).toBe("1\u202f234,5\u20ac");
    expect(formatEuroInputAmount("1234567,89")).toBe(
      "1\u202f234\u202f567,89\u20ac",
    );
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
