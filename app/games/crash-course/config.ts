/**
 * Crash Course — all tunables in one place.
 *
 * Physics feel is tuning, not logic. Keeping every knob here means a
 * playtesting pass edits one file and never hunts through the scene code.
 */

import type { PropKind } from "./scoring";

// --- Car / handling (arcade: grippy, forgiving) ---------------------------
export const CAR = {
  topSpeed: 34, // m/s, cruising ceiling without nitrous
  accel: 26, // how hard throttle eases velocity toward target
  reverseSpeed: 10,
  brake: 40,
  steerRate: 2.4, // yaw rad/s at speed
  /** Steering fades in with speed so you can't spin on the spot. */
  steerSpeedRef: 12,
  linearDamping: 0.6,
  angularDamping: 4,
  density: 1.1, // Rapier derives mass from collider density
  spawn: [0, 1.2, 6] as const, // start near the top of the track
};

// --- Nitrous: 3 charges, moderate boost, control not launch ---------------
export const NITROUS = {
  charges: 3,
  durationMs: 2000,
  /** Multipliers applied to top speed and accel while active. Moderate. */
  speedMult: 1.5,
  accelMult: 1.8,
};

// --- Track ----------------------------------------------------------------
export const TRACK = {
  width: 22,
  length: 150, // runs from +z (start) toward -z (pile)
  wallHeight: 2,
  /** Slight downhill toward the pile so speed builds into the finale. */
  drop: 6,
  pileZ: -66, // where the destruction zone sits
};

// --- Impact detection -----------------------------------------------------
export const IMPACT = {
  /** Contact-force magnitude that counts a destructible as destroyed. */
  destroyForce: 900,
  /** Contact-force on the car that knocks a panel off + squashes the body. */
  carDamageForce: 1600,
  /** Min ms between successive car-damage events (rate limit). */
  carDamageCooldownMs: 250,
  /** Extra impulse added to a destroyed body for drama. */
  scatterImpulse: 6,
};

// --- Run settle -----------------------------------------------------------
export const SETTLE = {
  /** Below this speed (m/s) everything is considered "at rest". */
  restSpeed: 1.2,
  /** How long things must stay at rest before results show (ms). */
  restHoldMs: 1400,
  /** Hard cap so a jittering body can never hang the run (ms). */
  maxCrashMs: 6000,
};

// --- Colours per prop kind (also drives point value via scoring.ts) -------
export const PROP_COLOR: Record<PropKind, string> = {
  crate: "#9a9a9a",
  box: "#b0803f",
  barrel: "#d63d3d",
  gold: "#ffd24a",
  car: "#4a7bd6",
};
