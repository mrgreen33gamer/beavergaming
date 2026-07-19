import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setGamePaused, __resetGamePause } from "@/lib/platform/pauseBus";
import {
  installPauseFreeze,
  __resetPauseFreezeForTests,
} from "@/lib/platform/pauseFreeze";

describe("pauseFreeze", () => {
  beforeEach(() => {
    __resetGamePause();
    __resetPauseFreezeForTests();
    installPauseFreeze();
  });

  afterEach(() => {
    __resetGamePause();
    __resetPauseFreezeForTests();
  });

  it("defers rAF callbacks while paused and runs them on resume", async () => {
    const cb = vi.fn();
    setGamePaused(true);
    requestAnimationFrame(cb);
    // Flush microtasks / real rAF if any scheduled
    await new Promise((r) => setTimeout(r, 20));
    expect(cb).not.toHaveBeenCalled();

    setGamePaused(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(cb).toHaveBeenCalled();
  });

  it("runs rAF immediately when not paused", async () => {
    const cb = vi.fn();
    setGamePaused(false);
    requestAnimationFrame(cb);
    await new Promise((r) => setTimeout(r, 40));
    expect(cb).toHaveBeenCalled();
  });
});
