/**
 * EXP, levels and ranks.
 *
 * Platform-owned, like earn rates. Games never see any of this — XP is
 * derived from tokens the platform already decided to grant, so progression
 * inherits every anti-farming property the economy has instead of needing its
 * own. A game cannot mint XP any more than it can mint tokens.
 */

export const MAX_LEVEL = 1000;

/** XP per token actually granted (post-cap). */
export const XP_PER_TOKEN = 10;

/**
 * XP required to advance from `level` to `level + 1`.
 *
 * Linear growth on purpose. Level 2 costs 50; level 1000 costs ~9,041.
 * Cumulative to MAX_LEVEL is ~4.55M XP which, against the 500-token daily cap
 * (5,000 XP), is roughly 910 days of maxed-out play. Hard, clearly reachable,
 * and impossible to shortcut — an exponential curve would have made the last
 * few hundred levels purely theoretical.
 */
export function xpForLevel(level: number): number {
  if (level < 1) return 0;
  return 50 + 9 * (level - 1);
}

/** Total XP needed to reach `level` from zero. Closed form, not a loop. */
export function cumulativeXpFor(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const steps = l - 1;
  // Sum of an arithmetic series: steps * first + 9 * (steps-1)*steps/2
  return steps * 50 + (9 * (steps - 1) * steps) / 2;
}

/** Level for a total XP amount, clamped to [1, MAX_LEVEL]. */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  // Invert the arithmetic series rather than looping to 1000.
  //   xp = 50s + 4.5s(s-1)  →  4.5s² + 45.5s - xp = 0
  const s = (-45.5 + Math.sqrt(45.5 * 45.5 + 18 * xp)) / 9;
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(s) + 1));
}

/** XP progress within the current level, for a progress bar. */
export function levelProgress(xp: number): {
  level: number;
  intoLevel: number;
  needed: number;
} {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, intoLevel: 0, needed: 0 };
  const base = cumulativeXpFor(level);
  return { level, intoLevel: Math.max(0, xp - base), needed: xpForLevel(level) };
}

export interface Rank {
  name: string;
  minLevel: number;
}

/** Ten tiers, so progress is legible without reading a raw number. */
export const RANKS: Rank[] = [
  { name: "Rookie", minLevel: 1 },
  { name: "Bronze", minLevel: 10 },
  { name: "Silver", minLevel: 50 },
  { name: "Gold", minLevel: 100 },
  { name: "Platinum", minLevel: 200 },
  { name: "Diamond", minLevel: 350 },
  { name: "Master", minLevel: 500 },
  { name: "Grandmaster", minLevel: 700 },
  { name: "Legend", minLevel: 850 },
  { name: "Beaver Lord", minLevel: 950 },
];

export function rankFor(level: number): Rank {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (l >= rank.minLevel) current = rank;
    else break;
  }
  return current;
}

/** Highest earn multiplier, reached at MAX_LEVEL. */
export const MAX_EARN_MULTIPLIER = 1.25;

/**
 * Earn multiplier for a level: a linear ramp to +25% at MAX_LEVEL.
 *
 * Deliberately modest, and applied *before* the daily caps. "Higher rank
 * earns faster" plus "XP comes from earning" is a compounding loop, and the
 * only thing stopping it becoming a farming incentive is that the ceiling
 * never moves. A level 1000 player reaches the cap sooner; they cannot
 * exceed it.
 */
export function earnMultiplier(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const ramp = (l - 1) / (MAX_LEVEL - 1);
  return 1 + (MAX_EARN_MULTIPLIER - 1) * ramp;
}

/** XP awarded for a grant of `tokens`. */
export function xpForTokens(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  return Math.floor(tokens) * XP_PER_TOKEN;
}
