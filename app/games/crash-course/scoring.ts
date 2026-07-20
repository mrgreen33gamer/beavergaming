/**
 * Crash Course — pure run logic. No React, no Three, no side effects.
 *
 * The scene reports what it destroyed and when; this module decides what it is
 * worth. Data flow is one-way — scoring never reaches back into the scene — so
 * all of it is trivially unit-testable.
 */

// --- Destructibles --------------------------------------------------------

export type PropKind = "crate" | "box" | "barrel" | "gold" | "car";

/** Weighted destruction: colour/type carries the value. */
export const PROP_VALUES: Record<PropKind, number> = {
  crate: 10,
  box: 25,
  barrel: 50,
  gold: 200,
  car: 300,
};

// --- Combo scoring --------------------------------------------------------

/** Destructions chained within this window escalate the multiplier. */
export const COMBO_WINDOW_MS = 900;

/** Hard ceiling on the combo multiplier — keeps a dense pile from spiking it
 *  to nonsense while still letting it climb well past x10. */
export const COMBO_MAX = 15;

export interface ScoreState {
  total: number;
  destroyed: number;
  /** Current combo multiplier (1 = no combo). */
  multiplier: number;
  bestMultiplier: number;
  /** Timestamp of the last destruction, or null before the first. */
  lastHitMs: number | null;
}

export function initialScore(): ScoreState {
  return { total: 0, destroyed: 0, multiplier: 1, bestMultiplier: 1, lastHitMs: null };
}

/**
 * Register one destroyed object. Returns a new state (pure). A destruction
 * within `windowMs` of the previous one bumps the multiplier (x2, x3, x4…);
 * otherwise the combo resets to x1.
 */
export function registerDestruction(
  state: ScoreState,
  kind: PropKind,
  timeMs: number,
  windowMs: number = COMBO_WINDOW_MS,
): ScoreState {
  const chained =
    state.lastHitMs !== null && timeMs - state.lastHitMs <= windowMs;
  const multiplier = chained ? Math.min(COMBO_MAX, state.multiplier + 1) : 1;
  const gained = PROP_VALUES[kind] * multiplier;
  return {
    total: state.total + gained,
    destroyed: state.destroyed + 1,
    multiplier,
    bestMultiplier: Math.max(state.bestMultiplier, multiplier),
    lastHitMs: timeMs,
  };
}

/**
 * Screen-shake amount in [0..1] for a given combo multiplier. Modest at x1 and
 * climbs with the combo so a big chain rattles the camera harder. Pure.
 */
export function comboShake(multiplier: number): number {
  return Math.min(1, 0.25 + (multiplier - 1) * 0.06);
}

// --- Nitrous accounting ---------------------------------------------------

export interface NitrousState {
  charges: number;
  /** Time the current boost ends, or null when idle. */
  activeUntilMs: number | null;
}

export function initialNitrous(charges: number): NitrousState {
  return { charges, activeUntilMs: null };
}

/**
 * Spend one charge if any remain and a boost is not already active. Returns
 * unchanged state when it cannot fire, so the caller can compare identity.
 */
export function spendNitrous(
  state: NitrousState,
  nowMs: number,
  durationMs: number,
): NitrousState {
  if (state.charges <= 0) return state;
  if (nitrousActive(state, nowMs)) return state;
  return { charges: state.charges - 1, activeUntilMs: nowMs + durationMs };
}

export function nitrousActive(state: NitrousState, nowMs: number): boolean {
  return state.activeUntilMs !== null && nowMs < state.activeUntilMs;
}

// --- Car damage state -----------------------------------------------------

/** Panels shed, in order, on successive heavy impacts. */
export const DAMAGE_PANELS = ["roof", "bumper", "wheel"] as const;
export type DamagePanel = (typeof DAMAGE_PANELS)[number];

export interface DamageState {
  /** How many heavy hits have landed (also the squash level). */
  hits: number;
  /** Panels still attached to the car. */
  attached: DamagePanel[];
  /** Timestamp of the last damage event, for rate limiting. */
  lastDamageMs: number | null;
}

export function initialDamage(): DamageState {
  return { hits: 0, attached: [...DAMAGE_PANELS], lastDamageMs: null };
}

export interface DamageResult {
  state: DamageState;
  /** The panel that detached this hit, or null if none was available. */
  detached: DamagePanel | null;
  /** True when this call actually registered damage (past the cooldown). */
  applied: boolean;
}

/**
 * Apply one heavy impact if the cooldown has elapsed. Detaches the next panel
 * (if any remain) and increments the squash level. Pure: returns the outcome.
 */
export function applyDamage(
  state: DamageState,
  nowMs: number,
  cooldownMs: number,
): DamageResult {
  if (state.lastDamageMs !== null && nowMs - state.lastDamageMs < cooldownMs) {
    return { state, detached: null, applied: false };
  }
  const detached = state.attached[0] ?? null;
  const attached = detached ? state.attached.slice(1) : state.attached;
  return {
    state: { hits: state.hits + 1, attached, lastDamageMs: nowMs },
    detached,
    applied: true,
  };
}

/**
 * Squash factor for the chassis given the current hit count. Clamped so a
 * heavily wrecked car never inverts or vanishes.
 */
export function squashScale(hits: number): number {
  return Math.max(0.45, 1 - hits * 0.12);
}

// --- Metal crumple budget --------------------------------------------------

/**
 * How much cumulative plastic deformation (in world metres of vertex push) a
 * car body may accrue over one run before it stops caving further. Bounds the
 * wreck so the body crumples progressively but never turns inside-out.
 */
export const PANEL_DEFORM_BUDGET = 2.4;

export interface DeformResult {
  /** New cumulative deformation total. */
  used: number;
  /** How much of `amount` was actually allowed this hit (0 when spent). */
  applied: number;
}

/**
 * Accrue deformation toward the budget. Returns the new total and the amount
 * actually allowed this hit, clamped so `used` never exceeds `max` and a
 * negative `amount` is a no-op. Pure.
 */
export function accrueDeform(used: number, amount: number, max: number): DeformResult {
  const room = Math.max(0, max - used);
  const applied = Math.max(0, Math.min(amount, room));
  return { used: used + applied, applied };
}
