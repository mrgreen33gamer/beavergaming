import type { Vec } from "./types";

// ===== Arena =====
export const WIDTH = 800;
export const HEIGHT = 500;
export const CENTER: Vec = { x: 400, y: 250 };

// ===== HQ (main base) =====
export const BASE_SIZE = 70;
export const BASE_MAX_HP = 500;
export const BASE_TURRET_RANGE = 130;
export const BASE_TURRET_DAMAGE = 14;
export const BASE_TURRET_FIRE_RATE = 1500;
export const BASE_TURRET_BULLET_SPEED = 6.5;

// ===== Build slots =====
export const SLOT_RADIUS = 28;
export const SLOT_POSITIONS: Vec[] = [
  { x: 400, y: 90 },   // top
  { x: 540, y: 170 },  // top-right
  { x: 540, y: 330 },  // bottom-right
  { x: 400, y: 410 },  // bottom
  { x: 260, y: 330 },  // bottom-left
  { x: 260, y: 170 },  // top-left
];

// ===== Economy =====
export const STARTING_CURRENCY = 150;
export const WAVE_BONUS_BASE = 30;
export const WAVE_BONUS_PER_WAVE = 10;

// ===== Performance =====
// Hard cap on active particles. Bursts that would exceed this are silently truncated.
export const MAX_PARTICLES = 220;
// React state sync throttle: sync HUD values at most every N frames during combat.
// 4 frames at 60fps = ~15Hz HUD updates, imperceptible delay, big re-render savings.
export const STATE_SYNC_INTERVAL = 4;

// ===== Smart targeting =====
// Per existing attacker, an enemy is treated as if it were this many virtual
// units further away when units choose a target. Higher = more aggressive
// fan-out across enemies. 70 means a unit will pick a fresh enemy over an
// already-targeted one if the fresh one is within ~70px of equal distance.
export const AGGRO_SPREAD_PENALTY = 70;
// Squared form for fast comparisons with squared distances.
export const AGGRO_SPREAD_PENALTY_SQ = AGGRO_SPREAD_PENALTY * AGGRO_SPREAD_PENALTY;
