import { describe, it, expect, vi } from "vitest";
import {
  notifyBalanceChanged,
  subscribeBalance,
} from "@/lib/platform/balanceBus";

describe("balanceBus", () => {
  it("notifies subscribers of balance updates", () => {
    const cb = vi.fn();
    const unsub = subscribeBalance(cb);
    notifyBalanceChanged(42);
    expect(cb).toHaveBeenCalledWith(42);
    unsub();
    notifyBalanceChanged(99);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
