import { describe, expect, it, vi } from "vitest";

import { lockAppHorizontalNavigation } from "../src/app/app-navigation-guard";
import { financialQueryKeys } from "../src/cache/financial-query-keys";

function touchEvent(type: string, clientX: number, cancelable = true) {
  const event = new Event(type, { cancelable });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX }],
  });
  return event;
}

describe("app navigation protection", () => {
  it("blocks edge gestures and horizontal wheel navigation", () => {
    const dispose = lockAppHorizontalNavigation();
    const edgeStart = touchEvent("touchstart", 5);
    window.dispatchEvent(edgeStart);
    expect(edgeStart.defaultPrevented).toBe(true);

    const move = touchEvent("touchmove", 50);
    window.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);

    window.dispatchEvent(touchEvent("touchend", 0));
    const moveAfterEnd = touchEvent("touchmove", 50);
    window.dispatchEvent(moveAfterEnd);
    expect(moveAfterEnd.defaultPrevented).toBe(false);

    const horizontalWheel = new WheelEvent("wheel", {
      deltaX: 20,
      deltaY: 2,
      cancelable: true,
    });
    document.dispatchEvent(horizontalWheel);
    expect(horizontalWheel.defaultPrevented).toBe(true);
    dispose();
  });

  it("does not block central touches and only installs once", () => {
    vi.spyOn(window, "addEventListener");
    const dispose = lockAppHorizontalNavigation();
    const duplicateDispose = lockAppHorizontalNavigation();
    const center = touchEvent("touchstart", window.innerWidth / 2);
    window.dispatchEvent(center);
    expect(center.defaultPrevented).toBe(false);
    expect(duplicateDispose()).toBeUndefined();
    dispose();
  });
});

describe("financial query keys", () => {
  it("keeps each cache branch scoped to its owner and resource", () => {
    const request = {
      search: "lunch",
      type: "EXPENSE" as const,
      currency: "ALL" as const,
      categoryIds: ["expense-dining"],
      exactAmountCents: null,
      minimumAmountCents: 1000,
      maximumAmountCents: null,
      exactDate: null,
      startDate: "2026-08-01",
      endDate: null,
    };
    expect(financialQueryKeys.transactionList("user-1", request)).toEqual([
      "financial-data",
      "user-1",
      "transactions",
      "list",
      request,
    ]);
    expect(financialQueryKeys.transactionDetail("user-1", "tx-1")).toEqual([
      "financial-data",
      "user-1",
      "transactions",
      "detail",
      "tx-1",
    ]);
    expect(financialQueryKeys.statisticsChart("user-1", { mode: "ALL" })).toEqual([
      "financial-data",
      "user-1",
      "statistics",
      "charts",
      { mode: "ALL" },
    ]);
  });
});
