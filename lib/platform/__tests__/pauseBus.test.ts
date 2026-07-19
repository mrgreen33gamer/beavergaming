import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isGamePaused,
  setGamePaused,
  subscribeGamePause,
  __resetGamePause,
} from "@/lib/platform/pauseBus";

describe("pauseBus", () => {
  beforeEach(() => {
    __resetGamePause();
  });

  it("starts unpaused", () => {
    expect(isGamePaused()).toBe(false);
  });

  it("notifies subscribers when pause changes", () => {
    const cb = vi.fn();
    subscribeGamePause(cb);
    setGamePaused(true);
    expect(cb).toHaveBeenCalledWith(true);
    expect(isGamePaused()).toBe(true);
    setGamePaused(false);
    expect(cb).toHaveBeenCalledWith(false);
  });

  it("is a no-op when value is unchanged", () => {
    const cb = vi.fn();
    subscribeGamePause(cb);
    setGamePaused(true);
    cb.mockClear();
    setGamePaused(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it("unsubscribes cleanly", () => {
    const cb = vi.fn();
    const unsub = subscribeGamePause(cb);
    unsub();
    setGamePaused(true);
    expect(cb).not.toHaveBeenCalled();
  });
});
