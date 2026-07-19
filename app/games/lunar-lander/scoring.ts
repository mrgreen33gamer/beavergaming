/**
 * Landing score maths, extracted so it can be tested.
 *
 * This lived inline and shipped with a bug for as long as the game has
 * existed: the touchdown speed was read *after* the lander's velocity had
 * been zeroed, so `speed` was always 0 and every landing scored the maximum
 * pad bonus — a skill reward that ignored skill. Nothing failed visibly,
 * which is exactly why it survived.
 */

/** Speed at which the pad bonus bottoms out. */
const MAX_PENALTY_SPEED = 2;

/**
 * Pad bonus for a landing. Gentler touchdowns score more; the bonus is
 * multiplied by the pad's own difficulty multiplier.
 */
export function padBonusFor(mult: number, touchdownSpeed: number): number {
  const penalty = Math.min(10, Math.max(0, touchdownSpeed) * 5);
  return Math.floor(100 * mult * (1 + (10 - penalty)));
}

/** Remaining fuel converted to points. */
export function fuelBonusFor(fuel: number): number {
  return Math.floor(Math.max(0, fuel) * 0.5);
}

export { MAX_PENALTY_SPEED };
