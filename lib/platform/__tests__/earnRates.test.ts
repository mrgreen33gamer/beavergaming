import { describe, it, expect } from "vitest";
import {
  rateFor,
  rewardForEvent,
  DEFAULT_RATE,
  GLOBAL_DAILY_CAP,
} from "@/lib/platform/earnRates";

describe("rateFor", () => {
  it("falls back to the default for unknown games", () => {
    expect(rateFor("does-not-exist")).toEqual(DEFAULT_RATE);
  });

  it("applies a per-game override", () => {
    // asteroids scores in the thousands, so its rate is lowered.
    expect(rateFor("asteroids").tokensPerPoint).toBeLessThan(DEFAULT_RATE.tokensPerPoint);
  });

  it("merges partial overrides over the default", () => {
    const rate = rateFor("asteroids");
    expect(rate.dailyCap).toBeGreaterThan(0);
    expect(typeof rate.tokensPerPoint).toBe("number");
  });
});

describe("rewardForEvent", () => {
  it("rewards known events", () => {
    expect(rewardForEvent("level_cleared")).toBeGreaterThan(0);
    expect(rewardForEvent("match_won")).toBeGreaterThan(0);
  });

  it("returns 0 for unknown events so games cannot invent rewards", () => {
    expect(rewardForEvent("i_win_a_million")).toBe(0);
  });
});

describe("caps", () => {
  it("has a global daily cap at least as large as a single game cap", () => {
    expect(GLOBAL_DAILY_CAP).toBeGreaterThanOrEqual(DEFAULT_RATE.dailyCap);
  });
});
