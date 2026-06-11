import type {
  Vec, Obstacle, Pickup, PickupType, Particle, ObstacleType,
} from "./types";
import {
  OBSTACLE_GAP_DEFAULT, OBSTACLE_GAP_NARROW, OBSTACLE_WIDTH, HEIGHT, MAX_PARTICLES,
  BLUE_GEM_CHANCE, GREEN_GEM_CHANCE, RED_GEM_CHANCE, GOLD_GEM_CHANCE, POWERUP_CHANCE,
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
    movePhase: Math.random() * Math.PI * 2,
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

// Get combo multiplier from number of consecutive gems collected.
export function getComboMultiplier(comboCount: number): number {
  if (comboCount >= 10) return 4;
  if (comboCount >= 6) return 3;
  if (comboCount >= 3) return 2;
  return 1;
}
