import type {
  Vec, Obstacle, Pickup, PickupType, Particle, ObstacleType,
  Asteroid, Jet, Bullet,
} from "./types";
import {
  OBSTACLE_GAP_DEFAULT, OBSTACLE_GAP_NARROW, HEIGHT, MAX_PARTICLES,
  BLUE_GEM_CHANCE, GREEN_GEM_CHANCE, RED_GEM_CHANCE, GOLD_GEM_CHANCE, POWERUP_CHANCE,
  LASER_CYCLE, WIDTH, JET_BULLET_SPEED,
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
  const baseGap = type === "narrow" ? OBSTACLE_GAP_NARROW : OBSTACLE_GAP_DEFAULT;
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
// about to fire, and a half-on state where only THAT half of the corridor is
// deadly. The opposite half stays open the whole time, so there's always at
// least one safe passage — including two full-off windows per cycle.
export type LaserPhase =
  | "off"
  | "charge_top"   // top emitter telegraphing — beam will fire downward
  | "top_on"       // top half of the gap is deadly; bottom half is safe
  | "charge_bot"
  | "bot_on";

export function laserState(movePhase: number): LaserPhase {
  const c = (((movePhase % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE) / LASER_CYCLE;
  // 0.00–0.30  off          (full corridor safe)
  // 0.30–0.39  charge top   (telegraph)
  // 0.39–0.58  top on       (bottom half safe)
  // 0.58–0.66  off          (full corridor safe — second window)
  // 0.66–0.75  charge bot
  // 0.75–1.00  bot on       (top half safe)
  if (c < 0.30) return "off";
  if (c < 0.39) return "charge_top";
  if (c < 0.58) return "top_on";
  if (c < 0.66) return "off";
  if (c < 0.75) return "charge_bot";
  return "bot_on";
}

// Beam reach as a fraction of the gap height. 0.55 means each beam extends
// 55% into the gap, leaving a ~45% safe band on the OPPOSITE side. Slight
// overlap is intentional — keeps the visual confident — but the collision
// math gives the player the full safe half (see index.tsx).
export const LASER_BEAM_REACH = 0.55;

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
