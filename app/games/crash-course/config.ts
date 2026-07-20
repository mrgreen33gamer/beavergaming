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
  spawn: [0, 0.75, 8] as const, // basically on the ground so the drop can't dent it
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
  width: 34, // wide open — plenty of room to line up hits and weave
  length: 150, // runs from +z (start) toward -z (pile)
  wallHeight: 2.5,
  /** Slight downhill toward the pile so speed builds into the finale. */
  drop: 6,
  pileZ: -66, // where the destruction zone sits
};

// --- Impact detection -----------------------------------------------------
export const IMPACT = {
  /** Contact-force magnitude that counts a destructible as destroyed. Lower =
   *  easier to knock things over (styrofoam props barely resist). */
  destroyForce: 280,
  /** Contact-force on the car that dents/crumples the body + sheds a part.
   *  High: the car is tough, so it takes a real car-to-car slam to damage it,
   *  never a foam crate or a scrape. */
  carDamageForce: 1100,
  /** Min ms between successive car-damage events (rate limit). */
  carDamageCooldownMs: 220,
  /** Extra impulse added to a destroyed body for drama. */
  scatterImpulse: 14,
};

/** Props ignore impacts for this long after a run starts, so the settling
 *  pile never counts as "smashed". */
export const ARM_GRACE_MS = 1200;

/** Min ms between spark bursts on the player car — stops a prop resting on the
 *  roof from spawning particles every single frame. */
export const CAR_FX_COOLDOWN_MS = 90;

/** Shed-debris housekeeping so parts never accumulate or rest on the car. */
export const DEBRIS = {
  maxAlive: 16,
  lifetimeMs: 5000,
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
