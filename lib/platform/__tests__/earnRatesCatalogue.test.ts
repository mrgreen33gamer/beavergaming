import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { GAME_RATES, rateFor, DEFAULT_RATE, GLOBAL_DAILY_CAP } from "../earnRates";
import { games } from "@/lib/games";

const GAMES_DIR = path.resolve(__dirname, "..", "..", "..", "app", "games");

/**
 * Slugs whose game code reports a numeric score, so their payout comes from
 * GAME_RATES. Games that only report events (pong, lights-out) are priced by
 * EVENT_REWARDS instead and correctly have no rate entry.
 */
function scoreReportingSlugs(): string[] {
  return readdirSync(GAMES_DIR).filter((entry) => {
    const file = path.join(GAMES_DIR, entry, "index.tsx");
    if (!existsSync(file)) return false;
    return /reportScore\(/.test(readFileSync(file, "utf8"));
  });
}

describe("earn rate catalogue", () => {
  it("has no rate keyed to a slug that does not exist", () => {
    // A typo here fails silently — the game just quietly earns the default
    // rate forever, which is exactly the kind of bug nobody notices.
    const realSlugs = new Set(games.map((g) => g.slug));
    const unknown = Object.keys(GAME_RATES).filter((slug) => !realSlugs.has(slug));
    expect(unknown).toEqual([]);
  });

  it("gives every score-reporting game an explicit tuned rate", () => {
    // Games not yet wired to the cartridge are allowed to use the default —
    // they earn nothing regardless. But once a game reports a score, an
    // untuned rate means its payout is an accident rather than a decision.
    const untuned = scoreReportingSlugs().filter(
      (slug) => games.some((g) => g.slug === slug) && !(slug in GAME_RATES),
    );
    expect(untuned).toEqual([]);
  });

  it("keeps every configured rate non-negative and sane", () => {
    for (const [slug, rate] of Object.entries(GAME_RATES)) {
      const resolved = rateFor(slug);
      // Zero is meaningful and deliberate: an event-paid game reports a score
      // for its leaderboard but must not also be paid for it.
      expect(resolved.tokensPerPoint, slug).toBeGreaterThanOrEqual(0);
      // An order of magnitude above default would let one game dominate.
      expect(resolved.tokensPerPoint, slug).toBeLessThanOrEqual(
        DEFAULT_RATE.tokensPerPoint * 10,
      );
      expect(resolved.dailyCap, slug).toBeGreaterThan(0);
      expect(rate).toBeTruthy();
    }
  });

  it("keeps per-game caps below the global cap so the global one still binds", () => {
    for (const slug of Object.keys(GAME_RATES)) {
      expect(rateFor(slug).dailyCap, slug).toBeLessThanOrEqual(GLOBAL_DAILY_CAP);
    }
    expect(DEFAULT_RATE.dailyCap).toBeLessThanOrEqual(GLOBAL_DAILY_CAP);
  });

  it("pays a comparable amount for a representative run across games", () => {
    // Guards the normalisation itself: if someone retunes one game in
    // isolation, this catches the catalogue drifting out of balance.
    const runs: Record<string, number> = {
      helicopter: 3000,
      pacman: 4000,
      tetris: 5000,
      snake: 500,
    };
    for (const [slug, points] of Object.entries(runs)) {
      const tokens = points * rateFor(slug).tokensPerPoint;
      expect(tokens, `${slug} pays ${tokens} for a typical run`).toBeGreaterThanOrEqual(15);
      expect(tokens, `${slug} pays ${tokens} for a typical run`).toBeLessThanOrEqual(60);
    }
  });
});
