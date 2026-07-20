/**
 * Kenney "Car Kit" (CC0) model registry.
 *
 * Files live in public/models/ and are served statically. Each GLB is
 * self-contained (geometry + textures embedded), so nothing here fetches an
 * external host. See public/models/KENNEY-LICENSE.txt.
 *
 * ORIENTATION: Kenney car bodies have a native facing that may not match the
 * game's "forward = -Z". If a car looks like it's driving backwards or
 * sideways, adjust the single `MODEL_YAW` value below — that's the one knob.
 */

const BASE = "/models";

export const CAR_MODEL = `${BASE}/sedan-sports.glb`;

/** Junk/parked/slow-mover cars, chosen deterministically per prop. */
export const JUNK_CAR_MODELS = [
  `${BASE}/taxi.glb`,
  `${BASE}/van.glb`,
  `${BASE}/police.glb`,
  `${BASE}/delivery.glb`,
  `${BASE}/truck.glb`,
  `${BASE}/garbage-truck.glb`,
];

export const CRATE_MODEL = `${BASE}/box.glb`;

/** Real car parts that fly off on heavy hits. */
export const DEBRIS_MODELS = [
  `${BASE}/debris-bumper.glb`,
  `${BASE}/debris-door.glb`,
  `${BASE}/debris-tire.glb`,
  `${BASE}/debris-spoiler-a.glb`,
  `${BASE}/debris-plate-a.glb`,
];

/**
 * Yaw correction (radians) applied to each model so it faces the game's
 * forward (-Z). Tune per family if a model points the wrong way.
 */
export const MODEL_YAW = {
  car: Math.PI, // best-guess: Kenney bodies face +Z, we drive toward -Z
  junk: Math.PI,
  crate: 0,
  debris: 0,
};

/** Deterministic junk-car pick from a world position, so it's stable per run. */
export function junkCarFor(x: number, z: number): string {
  const i = Math.abs(Math.round(x * 3 + z * 7)) % JUNK_CAR_MODELS.length;
  return JUNK_CAR_MODELS[i];
}

/** Every model URL, for preloading. */
export const ALL_MODELS = [
  CAR_MODEL,
  ...JUNK_CAR_MODELS,
  CRATE_MODEL,
  ...DEBRIS_MODELS,
];
