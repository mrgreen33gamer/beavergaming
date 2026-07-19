/**
 * Platform-owned economy configuration.
 *
 * Game code must never be able to reach this. Third-party creators set none
 * of these values — that is what prevents "Click Button → 1,000,000 B-Tokens".
 *
 * All tuning happens in this one file.
 */

export interface EarnRate {
  /** B-Tokens granted per point of reported score. */
  tokensPerPoint: number;
  /** Max B-Tokens earnable from this game per UTC day. */
  dailyCap: number;
}

export const DEFAULT_RATE: EarnRate = {
  tokensPerPoint: 0.01,
  dailyCap: 200,
};

/**
 * Per-game overrides. Games with inflated score scales get lower rates so a
 * point is worth roughly the same across the catalogue.
 *
 * Rates are normalised against a target of roughly 30 B-Tokens for a strong
 * three-minute run, derived from each game's actual point values:
 *
 *   helicopter  gems 25-100, coins 10   → ~3,000 pts/run
 *   pacman      pellets 10, ghosts 200  → ~4,000 pts/run
 *   tetris      line clears + hard drop → ~5,000 pts/run
 *   snake       per-food, small scale   → ~500 pts/run
 *
 * These are first-pass estimates from reading the scoring code, not from
 * telemetry. They should be revisited once real score distributions exist.
 */
export const GAME_RATES: Record<string, Partial<EarnRate>> = {
  asteroids: { tokensPerPoint: 0.002 },
  breakout: { tokensPerPoint: 0.005 },
  "apple-shooter": { tokensPerPoint: 0.005 },
  "dam-rush": { tokensPerPoint: 0.005 },
  helicopter: { tokensPerPoint: 0.01 },
  pacman: { tokensPerPoint: 0.0075 },
  tetris: { tokensPerPoint: 0.006 },
  snake: { tokensPerPoint: 0.06 },

  /**
   * Event-paid games. These report a score so it can be tracked as a high
   * score, but are paid through EVENT_REWARDS — a rate of 0 keeps the
   * leaderboard working without paying twice for the same achievement.
   */
  "lights-out": { tokensPerPoint: 0 },
};

/** Flat rewards for non-score games. Unknown events are worth nothing. */
export const EVENT_REWARDS: Record<string, number> = {
  level_cleared: 5,
  match_won: 10,
  puzzle_solved: 5,
};

/** Ceiling across all games per UTC day — prevents farming many games. */
export const GLOBAL_DAILY_CAP = 500;

export function rateFor(gameId: string): EarnRate {
  return { ...DEFAULT_RATE, ...(GAME_RATES[gameId] ?? {}) };
}

export function rewardForEvent(name: string): number {
  return EVENT_REWARDS[name] ?? 0;
}
