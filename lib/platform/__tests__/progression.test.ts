import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  MAX_EARN_MULTIPLIER,
  RANKS,
  cumulativeXpFor,
  earnMultiplier,
  levelFromXp,
  levelProgress,
  rankFor,
  xpForLevel,
  xpForTokens,
} from "../progression";
import { GLOBAL_DAILY_CAP } from "../earnRates";

describe("level curve", () => {
  it("costs more per level as you climb", () => {
    expect(xpForLevel(1)).toBe(50);
    expect(xpForLevel(500)).toBeGreaterThan(xpForLevel(100));
    expect(xpForLevel(999)).toBeGreaterThan(xpForLevel(500));
  });

  it("round-trips level → cumulative xp → level", () => {
    for (const level of [1, 2, 5, 37, 100, 499, 500, 862, 999, 1000]) {
      expect(levelFromXp(cumulativeXpFor(level)), `level ${level}`).toBe(level);
    }
  });

  it("does not advance a level one xp short of the requirement", () => {
    for (const level of [2, 50, 300, 1000]) {
      expect(levelFromXp(cumulativeXpFor(level) - 1)).toBe(level - 1);
    }
  });

  it("starts at level 1 for no xp and never goes below it", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(-500)).toBe(1);
    expect(levelFromXp(NaN)).toBe(1);
  });

  it("clamps at MAX_LEVEL rather than running away", () => {
    expect(levelFromXp(cumulativeXpFor(MAX_LEVEL) * 10)).toBe(MAX_LEVEL);
  });

  it("keeps level 1000 hard but reachable in a sane amount of time", () => {
    const total = cumulativeXpFor(MAX_LEVEL);
    // XP is derived from granted tokens, so the daily cap bounds daily XP.
    const perDay = xpForTokens(GLOBAL_DAILY_CAP);
    const days = total / perDay;
    // Roughly two and a half years of maxing the cap every single day.
    expect(days).toBeGreaterThan(700);
    expect(days).toBeLessThan(1200);
  });

  it("reports progress within the current level", () => {
    const xp = cumulativeXpFor(10) + 20;
    const p = levelProgress(xp);
    expect(p.level).toBe(10);
    expect(p.intoLevel).toBe(20);
    expect(p.needed).toBe(xpForLevel(10));
  });

  it("reports no remaining progress at max level", () => {
    const p = levelProgress(cumulativeXpFor(MAX_LEVEL));
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.needed).toBe(0);
  });
});

describe("ranks", () => {
  it("maps every level from 1 to MAX_LEVEL to exactly one rank", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const rank = rankFor(level);
      expect(RANKS, `level ${level}`).toContain(rank);
    }
  });

  it("never goes backwards as level rises", () => {
    let lastIndex = 0;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const index = RANKS.indexOf(rankFor(level));
      expect(index, `level ${level}`).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = index;
    }
  });

  it("puts the boundaries exactly where the tiers say", () => {
    for (const rank of RANKS) {
      expect(rankFor(rank.minLevel).name).toBe(rank.name);
      if (rank.minLevel > 1) {
        expect(rankFor(rank.minLevel - 1).name).not.toBe(rank.name);
      }
    }
  });

  it("tops out at Beaver Lord", () => {
    expect(rankFor(MAX_LEVEL).name).toBe("Beaver Lord");
  });
});

describe("earn multiplier", () => {
  it("is 1x at level 1 and the maximum at level 1000", () => {
    expect(earnMultiplier(1)).toBe(1);
    expect(earnMultiplier(MAX_LEVEL)).toBeCloseTo(MAX_EARN_MULTIPLIER, 10);
  });

  it("never decreases with level", () => {
    let last = 0;
    for (let level = 1; level <= MAX_LEVEL; level += 7) {
      const m = earnMultiplier(level);
      expect(m, `level ${level}`).toBeGreaterThanOrEqual(last);
      last = m;
    }
  });

  it("stays modest — this is the whole anti-farming argument", () => {
    // If the multiplier could grow without bound, or the caps moved with it,
    // "rank earns faster" plus "xp comes from earning" becomes a compounding
    // farm. It is safe only because this is small and the cap is fixed.
    for (let level = 1; level <= MAX_LEVEL; level += 13) {
      expect(earnMultiplier(level)).toBeLessThanOrEqual(MAX_EARN_MULTIPLIER);
    }
  });

  it("clamps out-of-range levels rather than extrapolating", () => {
    expect(earnMultiplier(0)).toBe(1);
    expect(earnMultiplier(-50)).toBe(1);
    expect(earnMultiplier(MAX_LEVEL * 5)).toBeCloseTo(MAX_EARN_MULTIPLIER, 10);
  });
});

describe("xpForTokens", () => {
  it("pays xp in proportion to tokens actually granted", () => {
    expect(xpForTokens(30)).toBe(300);
    expect(xpForTokens(1)).toBe(10);
  });

  it("pays nothing for a zero or negative grant", () => {
    expect(xpForTokens(0)).toBe(0);
    expect(xpForTokens(-10)).toBe(0);
    expect(xpForTokens(NaN)).toBe(0);
  });
});
