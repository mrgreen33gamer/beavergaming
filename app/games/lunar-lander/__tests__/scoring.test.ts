import { describe, expect, it } from "vitest";
import { fuelBonusFor, padBonusFor } from "../scoring";

// From index.tsx — the fastest touchdown still counted as a good landing.
const SAFE_VY = 1.5;
const SAFE_VX = 0.9;
const MAX_SAFE_SPEED = Math.hypot(SAFE_VX, SAFE_VY);

describe("padBonusFor", () => {
  /**
   * The regression this exists for: touchdown speed was read after the
   * lander's velocity had been zeroed, so it was always 0 and every landing
   * scored the maximum bonus. Nothing failed visibly — the game just quietly
   * stopped rewarding skill.
   */
  it("pays strictly less the faster you land", () => {
    const speeds = [0, 0.25, 0.5, 1, 1.5, MAX_SAFE_SPEED];
    const bonuses = speeds.map((v) => padBonusFor(1, v));
    for (let i = 1; i < bonuses.length; i++) {
      expect(bonuses[i], `speed ${speeds[i]}`).toBeLessThan(bonuses[i - 1]);
    }
  });

  it("does not pay a hard landing the same as a perfect one", () => {
    expect(padBonusFor(1, MAX_SAFE_SPEED)).toBeLessThan(padBonusFor(1, 0));
  });

  it("scales with the pad multiplier", () => {
    expect(padBonusFor(5, 0.5)).toBe(padBonusFor(1, 0.5) * 5);
  });

  it("bottoms out rather than going negative at absurd speed", () => {
    expect(padBonusFor(1, 999)).toBeGreaterThan(0);
    expect(padBonusFor(1, 999)).toBe(padBonusFor(1, 2));
  });

  it("treats negative speed as zero rather than paying a bonus above maximum", () => {
    expect(padBonusFor(1, -5)).toBe(padBonusFor(1, 0));
  });

  it("returns whole points", () => {
    for (const v of [0, 0.33, 0.7, 1.21]) {
      expect(Number.isInteger(padBonusFor(3, v)), `speed ${v}`).toBe(true);
    }
  });
});

describe("fuelBonusFor", () => {
  it("pays half of remaining fuel, rounded down", () => {
    expect(fuelBonusFor(700)).toBe(350);
    expect(fuelBonusFor(101)).toBe(50);
  });

  it("never pays for negative fuel", () => {
    expect(fuelBonusFor(-50)).toBe(0);
  });
});
