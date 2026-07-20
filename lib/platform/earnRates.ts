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
 * Per-game overrides, normalised against a target of roughly 30 B-Tokens for
 * a strong three-minute run.
 *
 * Normalising matters more than it looks: reported score scales span three
 * orders of magnitude across the catalogue. Stack Tower counts floors and a
 * great run is ~50; 2048 sums merges and a great run is ~6,000. One shared
 * rate would make Stack Tower pay half a token while 2048 paid sixty, and the
 * whole library would funnel into whichever game happened to inflate hardest.
 *
 * Every figure below is derived from the actual point values in each game's
 * source, not guessed — but they are still estimates from reading code rather
 * than from telemetry, and should be revisited once real score distributions
 * exist.
 */
export const GAME_RATES: Record<string, Partial<EarnRate>> = {
  // --- score ~10 ------------------------------------------------------
  "tank-shooter": { tokensPerPoint: 3.5 },   // waves cleared, ~8/run
  simon: { tokensPerPoint: 2 },              // round reached, ~15/run

  // --- score ~50 ------------------------------------------------------
  "stack-tower": { tokensPerPoint: 0.55 },   // floors, ~52/run

  // --- score ~300 -----------------------------------------------------
  plinko: { tokensPerPoint: 0.1 },           // peak credits, ~300/run

  // --- score ~500-1,500 -----------------------------------------------
  snake: { tokensPerPoint: 0.06 },           // ~500/run
  "bubble-shooter": { tokensPerPoint: 0.025 }, // ~1,150/run
  "tower-defense": { tokensPerPoint: 0.024 }, // ~1,250/run
  "whack-a-mole": { tokensPerPoint: 0.022 },  // ~1,350/run (30s rounds)
  "match-three": { tokensPerPoint: 0.02 },   // ~1,500/run
  "sky-hop": { tokensPerPoint: 0.02 },       // ~1,500/run

  // --- score ~2,000-3,500 ---------------------------------------------
  // Weighted destruction + combo: a strong pile-driver run totals ~4,500
  // (mixed props at x2-x6 combos), so this lands near the ~30-token target.
  "crash-course": { tokensPerPoint: 0.007 }, // ~4,500/run
  "zombie-shooter": { tokensPerPoint: 0.015 }, // ~2,000/run
  "dino-runner": { tokensPerPoint: 0.013 },  // ~2,150/run
  breakout: { tokensPerPoint: 0.01 },        // ~2,750/run
  centipede: { tokensPerPoint: 0.01 },       // ~2,750/run
  helicopter: { tokensPerPoint: 0.01 },      // ~3,000/run
  "apple-shooter": { tokensPerPoint: 0.0085 }, // ~3,250/run

  // --- score ~4,000-8,000 ---------------------------------------------
  pacman: { tokensPerPoint: 0.0075 },        // ~4,000/run
  "missile-command": { tokensPerPoint: 0.0075 }, // ~4,000/run
  "dam-rush": { tokensPerPoint: 0.0075 },    // ~4,000/run
  galaga: { tokensPerPoint: 0.007 },         // ~4,250/run
  "space-invaders": { tokensPerPoint: 0.0065 }, // ~4,500/run
  frogger: { tokensPerPoint: 0.006 },        // ~5,000/run
  tetris: { tokensPerPoint: 0.006 },         // ~5,000/run
  "2048": { tokensPerPoint: 0.005 },         // ~6,000/run
  asteroids: { tokensPerPoint: 0.002 },      // inflated scale

  // --- score ~10,000 --------------------------------------------------
  // Was 0.003 when every landing silently scored the maximum pad bonus. That
  // bug is fixed, so a competent landing now scores ~6,800 rather than
  // ~10,000 and the rate rises to keep the payout at target.
  "lunar-lander": { tokensPerPoint: 0.0045 }, // ~6,800/run

  /**
   * Event-paid games. These report a score so it can be tracked as a high
   * score, but are paid through EVENT_REWARDS — a rate of 0 keeps the
   * leaderboard working without paying twice for the same achievement.
   */
  "lights-out": { tokensPerPoint: 0 },
};

/**
 * Flat rewards for games with no meaningful score. Unknown events are worth
 * nothing, which is the safety property that keeps a game from inventing its
 * own currency by emitting a made-up event name.
 */
export const EVENT_REWARDS: Record<string, number> = {
  level_cleared: 5,
  match_won: 10,
  puzzle_solved: 5,
};

/**
 * Per-game event overrides.
 *
 * A flat table cannot normalise these: "level_cleared" means eight levels in
 * three minutes in Pipes and one or two in Sokoban. Paying both the same per
 * clear makes one of them either trivial or the best farm in the catalogue.
 * The same applies to matches — a Tron round takes seconds, a Reversi match
 * takes minutes.
 */
export const GAME_EVENT_REWARDS: Record<string, Record<string, number>> = {
  // Slow, deliberate clears — few per run.
  sokoban: { level_cleared: 20 },
  minesweeper: { puzzle_solved: 20 },
  mastermind: { puzzle_solved: 20 },
  "memory-match": { puzzle_solved: 12 },
  "slide-puzzle": { puzzle_solved: 12 },
  "word-search": { puzzle_solved: 25 },

  // Head-to-head matches, priced by how long one takes.
  reversi: { match_won: 30 },
  battleship: { match_won: 25 },
  "air-hockey": { match_won: 25 },
  "connect-four": { match_won: 25 },
  tron: { match_won: 20 },
  hangman: { match_won: 12 },

  // Fast repeated clears keep the default 5 — pipes and mini-golf clear
  // several per run and already land near target.
};

/** Ceiling across all games per UTC day — prevents farming many games. */
export const GLOBAL_DAILY_CAP = 500;

export function rateFor(gameId: string): EarnRate {
  return { ...DEFAULT_RATE, ...(GAME_RATES[gameId] ?? {}) };
}

/**
 * Reward for a named event. `gameId` selects a per-game override where one
 * exists; without it the flat default applies, and an unknown event is worth
 * nothing either way.
 */
export function rewardForEvent(name: string, gameId?: string): number {
  const perGame = gameId ? GAME_EVENT_REWARDS[gameId]?.[name] : undefined;
  return perGame ?? EVENT_REWARDS[name] ?? 0;
}
