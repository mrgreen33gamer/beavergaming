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
 */
export const GAME_RATES: Record<string, Partial<EarnRate>> = {
  asteroids: { tokensPerPoint: 0.002 },
  breakout: { tokensPerPoint: 0.005 },
  "apple-shooter": { tokensPerPoint: 0.005 },
  "dam-rush": { tokensPerPoint: 0.005 },
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
