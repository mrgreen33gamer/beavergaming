/**
 * Physics safety — pure guards that stop Rapier from propagating an explosion.
 * A body that goes NaN, exceeds a sane speed, or falls through the world is
 * caught here and corrected by the caller. No React, no Three.
 */

export interface Vec3 { x: number; y: number; z: number }

/** Anything below this Y has fallen out of the world (heightfield tunnelling). */
export const KILL_PLANE_Y = -25;

/** No body should ever move faster than this (m/s); a spike gets clamped. */
export const MAX_SPEED = 120;

export function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function sanitizeVec(v: Vec3, fallback: Vec3): Vec3 {
  return isFiniteVec(v) ? v : { ...fallback };
}

/** Clamp a velocity to `maxSpeed`, preserving direction. NOTE: call
 *  `sanitizeVec` first — a NaN component makes `mag` NaN, which fails both
 *  guards below and returns a NaN-scaled vector unchanged. */
export function clampSpeed(v: Vec3, maxSpeed: number = MAX_SPEED): Vec3 {
  const mag = Math.hypot(v.x, v.y, v.z);
  if (mag <= maxSpeed || mag === 0) return v;
  const s = maxSpeed / mag;
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function isBelowKillPlane(y: number, killY: number = KILL_PLANE_Y): boolean {
  return y < killY;
}
