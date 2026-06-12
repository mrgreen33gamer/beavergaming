import type { Vec, TimeOfDay } from "./types";

// ===== Logical arena (all coords in this space, canvas scales to fit) =====
export const W = 1200;
export const H = 800;
export const CENTER: Vec = { x: 600, y: 400 };

// ===== HQ =====
export const BASE_SIZE = 60;
export const BASE_MAX_HP = 600;
export const BASE_TURRET_RANGE = 140;
export const BASE_TURRET_DAMAGE = 16;
export const BASE_TURRET_FIRE_RATE = 1400;
export const BASE_TURRET_BULLET_SPEED = 7;

// ===== Build slots: inner ring (4) + outer ring (6) = 10 =====
export const SLOT_RADIUS = 26;
export const INNER_SLOTS: Vec[] = [
  { x: 600, y: 265 },
  { x: 735, y: 400 },
  { x: 600, y: 535 },
  { x: 465, y: 400 },
];
export const OUTER_SLOTS: Vec[] = [
  { x: 600, y: 150 },
  { x: 810, y: 275 },
  { x: 810, y: 525 },
  { x: 600, y: 650 },
  { x: 390, y: 525 },
  { x: 390, y: 275 },
];
export const SLOT_POSITIONS: Vec[] = [...INNER_SLOTS, ...OUTER_SLOTS];

// ===== Economy =====
export const STARTING_CURRENCY = 200;
export const WAVE_BONUS_BASE = 40;
export const WAVE_BONUS_PER_WAVE = 15;

// ===== Performance =====
export const MAX_PARTICLES = 350;
export const STATE_SYNC_INTERVAL = 4;

// ===== Smart targeting =====
export const AGGRO_SPREAD_PENALTY = 70;
export const AGGRO_SPREAD_PENALTY_SQ = AGGRO_SPREAD_PENALTY * AGGRO_SPREAD_PENALTY;

// ===== Combo system =====
export const COMBO_WINDOW_MS = 2000;
export const COMBO_MAX_MULT = 5;

// ===== Abilities =====
export const AIRSTRIKE_COOLDOWN = 25000;
export const AIRSTRIKE_DAMAGE = 120;
export const AIRSTRIKE_RADIUS = 90;
export const AIRSTRIKE_DELAY = 1200;

export const REINFORCE_COOLDOWN = 30000;

export const SHIELD_COOLDOWN = 35000;
export const SHIELD_DURATION = 6000;
export const SHIELD_RADIUS = 80;

// ===== Day/Night =====
export const DAY_WAVE_COUNT = 3; // waves per cycle
export const TIME_CYCLE: TimeOfDay[] = ["dawn", "day", "day", "dusk", "night", "night"];
export const TIME_TINTS: Record<string, string> = {
  dawn: "rgba(255, 200, 120, 0.04)",
  day: "rgba(0, 0, 0, 0)",
  dusk: "rgba(255, 100, 50, 0.07)",
  night: "rgba(20, 30, 80, 0.18)",
};
export const NIGHT_RANGE_MULT = 0.75;
export const NIGHT_REWARD_MULT = 1.5;

// ===== Boss =====
export const BOSS_EVERY = 5;

// ===== Radar =====
export const RADAR_REVEAL_RANGE = 200;
export const RADAR_RANGE_BOOST = 30;

// ===== Repair =====
export const REPAIR_RANGE = 160;
export const REPAIR_RATE = 0.4; // HP per frame per depot
