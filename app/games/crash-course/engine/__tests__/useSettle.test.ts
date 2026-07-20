import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSettle } from "../useSettle";
import { SETTLE } from "../../config";

describe("useSettle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once after the car stays at rest for restHoldMs", () => {
    const speed = { current: 0 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(true, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.restHoldMs + 200);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does not fire while the car is still moving fast", () => {
    const speed = { current: SETTLE.restSpeed + 10 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(true, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.restHoldMs + 200);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("fires by the hard cap even if the body never fully rests", () => {
    const speed = { current: SETTLE.restSpeed + 10 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(true, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.maxCrashMs + 200);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does nothing while inactive", () => {
    const speed = { current: 0 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(false, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.maxCrashMs + 500);
    expect(onSettled).not.toHaveBeenCalled();
  });
});
