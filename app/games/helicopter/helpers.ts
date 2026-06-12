import type {
  Vec, Obstacle, Pickup, PickupType, Particle, ObstacleType,
  Asteroid, Jet, Bullet,
} from "./types";
import {
  OBSTACLE_GAP_DEFAULT, OBSTACLE_GAP_NARROW, HEIGHT, MAX_PARTICLES,
  BLUE_GEM_CHANCE, GREEN_GEM_CHANCE, RED_GEM_CHANCE, GOLD_GEM_CHANCE, POWERUP_CHANCE,
  LASER_CYCLE, LASER_BAR_HEIGHT, WIDTH, JET_BULLET_SPEED,
} from "./constants";

let nextId = 1;
export const getId = () => nextId++;
export const resetIdCounter = () => { nextId = 1; };

export function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Cap-respecting particle push.
export function addBurst(
  arr: Particle[],
  count: number,
  factory: (i: number) => Particle
) {
  const allowed = Math.max(0, MAX_PARTICLES - arr.length);
  const n = Math.min(count, allowed);
  for (let i = 0; i < n; i++) arr.push(factory(i));
}

// Build an obstacle given a type and a gap-Y. gapBonus widens the gap (Easy mode).
export function makeObstacle(type: ObstacleType, x: number, gapY: number, gapBonus = 0): Obstacle {
  // Laser pillars are taller because they hold TWO openings split by the
  // middle bar — each opening needs to be flyable on its own.
  const baseGap =
    type === "laser" ? OBSTACLE_GAP_DEFAULT + LASER_BAR_HEIGHT + 30 :
    type === "narrow" ? OBSTACLE_GAP_NARROW :
    OBSTACLE_GAP_DEFAULT;
  const gap = baseGap + gapBonus;
  // Saws spawn clearly on one side (top or bottom) so the pole never flips
  let sawY = 0;
  if (type === "sawblade") {
    if (Math.random() < 0.5) {
      sawY = 55 + Math.random() * 100;  // top zone: 55–155
    } else {
      sawY = HEIGHT - 55 - Math.random() * 100;  // bottom zone: 245–345
    }
  }
  return {
    x,
    gapY,
    baseGapY: type === "sawblade" ? sawY : gapY,
    // Lasers clock their on/off cycle in frames, so spread the starting phase
    // across the whole cycle; everything else uses a radian phase.
    movePhase: type === "laser" ? Math.random() * LASER_CYCLE : Math.random() * Math.PI * 2,
    type,
    gap,
    sawAngle: Math.random() * Math.PI * 2,
    sawY,
  };
}

// Decide what (if anything) to spawn as a pickup. Returns null if nothing.
export function rollPickup(): PickupType | null {
  const r = Math.random();
  let acc = 0;
  acc += GOLD_GEM_CHANCE;
  if (r < acc) return "gold_gem";
  acc += RED_GEM_CHANCE;
  if (r < acc) return "red_gem";
  acc += GREEN_GEM_CHANCE;
  if (r < acc) return "green_gem";
  acc += POWERUP_CHANCE;
  if (r < acc) {
    const sub = Math.random();
    if (sub < 0.34) return "shield";
    if (sub < 0.67) return "slowmo";
    return "magnet";
  }
  acc += BLUE_GEM_CHANCE;
  if (r < acc) return "blue_gem";
  return null;
}

export function makePickup(type: PickupType, x: number, y: number): Pickup {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    type,
    spin: Math.random() * Math.PI * 2,
    bob: Math.random() * Math.PI * 2,
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Laser gate phase → visual/collision state. The cycle alternates between
// "off" (whole corridor safe), a brief charge telegraphing which half is
// Laser gate now has TWO openings (upper + lower) separated by a middle bar.
// The beam alternates between blocking the upper opening and the lower one.
// See LASER_CYCLE in constants.ts for cycle layout.
export type LaserPhase =
  | "off"
  | "charge_upper"   // upper-opening telegraph; not deadly yet
  | "burst_upper"    // upper opening DEADLY + super-bright flash
  | "thin_upper"     // upper opening DEADLY + thin steady beam
  | "charge_lower"
  | "burst_lower"
  | "thin_lower";

// Cycle layout — keep these aligned with the comment in constants.ts.
const PHASE_BOUNDARIES = {
  charge_upper: 0.06,
  burst_upper:  0.14,
  thin_upper:   0.22,
  off_mid:      0.44,
  charge_lower: 0.50,
  burst_lower:  0.58,
  thin_lower:   0.66,
  off_end:      0.88,
} as const;

export function laserPhase(movePhase: number): LaserPhase {
  const c = (((movePhase % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE) / LASER_CYCLE;
  if (c < PHASE_BOUNDARIES.charge_upper) return "off";
  if (c < PHASE_BOUNDARIES.burst_upper)  return "charge_upper";
  if (c < PHASE_BOUNDARIES.thin_upper)   return "burst_upper";
  if (c < PHASE_BOUNDARIES.off_mid)      return "thin_upper";
  if (c < PHASE_BOUNDARIES.charge_lower) return "off";
  if (c < PHASE_BOUNDARIES.burst_lower)  return "charge_lower";
  if (c < PHASE_BOUNDARIES.thin_lower)   return "burst_lower";
  if (c < PHASE_BOUNDARIES.off_end)      return "thin_lower";
  return "off";
}

// Returns 0..1 progress within the current phase. Used by drawing for burst
// fade-out and charge-pulse animation.
export function laserPhaseProgress(movePhase: number): number {
  const c = (((movePhase % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE) / LASER_CYCLE;
  const lo = (() => {
    if (c < PHASE_BOUNDARIES.charge_upper) return 0;
    if (c < PHASE_BOUNDARIES.burst_upper)  return PHASE_BOUNDARIES.charge_upper;
    if (c < PHASE_BOUNDARIES.thin_upper)   return PHASE_BOUNDARIES.burst_upper;
    if (c < PHASE_BOUNDARIES.off_mid)      return PHASE_BOUNDARIES.thin_upper;
    if (c < PHASE_BOUNDARIES.charge_lower) return PHASE_BOUNDARIES.off_mid;
    if (c < PHASE_BOUNDARIES.burst_lower)  return PHASE_BOUNDARIES.charge_lower;
    if (c < PHASE_BOUNDARIES.thin_lower)   return PHASE_BOUNDARIES.burst_lower;
    if (c < PHASE_BOUNDARIES.off_end)      return PHASE_BOUNDARIES.thin_lower;
    return PHASE_BOUNDARIES.off_end;
  })();
  const hi = (() => {
    if (c < PHASE_BOUNDARIES.charge_upper) return PHASE_BOUNDARIES.charge_upper;
    if (c < PHASE_BOUNDARIES.burst_upper)  return PHASE_BOUNDARIES.burst_upper;
    if (c < PHASE_BOUNDARIES.thin_upper)   return PHASE_BOUNDARIES.thin_upper;
    if (c < PHASE_BOUNDARIES.off_mid)      return PHASE_BOUNDARIES.off_mid;
    if (c < PHASE_BOUNDARIES.charge_lower) return PHASE_BOUNDARIES.charge_lower;
    if (c < PHASE_BOUNDARIES.burst_lower)  return PHASE_BOUNDARIES.burst_lower;
    if (c < PHASE_BOUNDARIES.thin_lower)   return PHASE_BOUNDARIES.thin_lower;
    if (c < PHASE_BOUNDARIES.off_end)      return PHASE_BOUNDARIES.off_end;
    return 1.0;
  })();
  return hi === lo ? 0 : (c - lo) / (hi - lo);
}

// Which opening (if any) is currently deadly. Charge states are NOT deadly —
// they're telegraph windows so the player can swap openings safely.
export function laserDeadlyOpening(phase: LaserPhase): "upper" | "lower" | null {
  if (phase === "burst_upper" || phase === "thin_upper") return "upper";
  if (phase === "burst_lower" || phase === "thin_lower") return "lower";
  return null;
}

// Geometry of the two-opening laser pillar derived from the obstacle's gapY
// (centre of the structure) and gap (total span of both openings + bar).
export function laserGeometry(gapY: number, gap: number) {
  const halfGap = gap / 2;
  const halfBar = LASER_BAR_HEIGHT / 2;
  return {
    topEdge:  gapY - halfGap,           // top of upper opening
    midTop:   gapY - halfBar,           // bottom of upper opening / top of middle bar
    midBot:   gapY + halfBar,           // bottom of middle bar / top of lower opening
    botEdge:  gapY + halfGap,           // bottom of lower opening
    barTop:   gapY - halfBar,
    barBot:   gapY + halfBar,
  };
}

// ===== Space flyer factories =====
export function makeAsteroid(): Asteroid {
  const r = 14 + Math.random() * 16;
  const verts = 9 + Math.floor(Math.random() * 3);
  const shape: number[] = [];
  for (let i = 0; i < verts; i++) shape.push(0.7 + Math.random() * 0.5);
  return {
    x: WIDTH + r + 10,
    y: 50 + Math.random() * (HEIGHT - 100),
    vx: -(1.4 + Math.random() * 1.6),
    vy: (Math.random() - 0.5) * 0.8,
    r,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.05,
    shape,
  };
}

export function makeJet(now: number): Jet {
  return {
    x: WIDTH + 40,
    y: 60 + Math.random() * (HEIGHT - 120),
    vx: -(3.2 + Math.random() * 1.4),
    vy: (Math.random() - 0.5) * 0.6,
    fireAt: now + 350 + Math.random() * 400,
    enterFrame: 0,
  };
}

export function makeBullet(x: number, y: number): Bullet {
  return { x, y, vx: -JET_BULLET_SPEED };
}

// Get combo multiplier from number of consecutive gems collected.
export function getComboMultiplier(comboCount: number): number {
  if (comboCount >= 10) return 4;
  if (comboCount >= 6) return 3;
  if (comboCount >= 3) return 2;
  return 1;
}
