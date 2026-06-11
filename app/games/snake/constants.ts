import type { Mode } from "./types";

// ===== Grid =====
export const GRID = 20;
export const COLS = 30;
export const ROWS = 20;
export const WIDTH = GRID * COLS;   // 600
export const HEIGHT = GRID * ROWS;  // 400

// ===== Tick rate =====
export const BASE_TICK_MS = 130;
export const MIN_TICK_MS = 60;

// ===== Food =====
export const BONUS_LIFESPAN_MS = 6000;
export const BONUS_SPAWN_CHANCE = 0.25;
export const BASE_FOOD_POINTS = 10;
export const BONUS_POINTS = 30;

// ===== Poison food =====
export const POISON_SPAWN_CHANCE = 0.12;
export const POISON_LIFESPAN_MS = 8000;
export const POISON_SEGMENTS_LOST = 3;
export const POISON_SCORE_PENALTY = 20;
export const POISON_MIN_SNAKE_LENGTH = 6; // don't spawn poison if snake is too short

// ===== Power-ups =====
export const POWERUP_SPAWN_CHANCE = 0.10;
export const POWERUP_LIFESPAN_MS = 10000;
export const POWERUP_WARNING_MS = 2500;

export const SLOW_DURATION_MS = 6000;
export const SLOW_TICK_MULTIPLIER = 2.0;

export const GHOST_DURATION_MS = 5000;

export const MULTI_DURATION_MS = 8000;
export const MULTI_FACTOR = 2;

export const SHRINK_SEGMENTS = 5;

export const SPEED_DURATION_MS = 4000;
export const SPEED_TICK_MULTIPLIER = 0.6; // faster ticks

// ===== Combo system =====
export const COMBO_WINDOW_MS = 3000;
export const COMBO_MAX = 8;

// ===== Random obstacles (Classic mode only) =====
export const OBSTACLE_LIFESPAN_MS = 15000;
export const OBSTACLE_WARNING_MS = 3000;
export const OBSTACLE_MIN_SNAKE_LENGTH = 15;
export const OBSTACLE_MAX_ACTIVE = 3;
export const OBSTACLE_SPAWN_INTERVAL_MS = 6000;

// ===== Mode multipliers =====
export const MODE_MULTIPLIER: Record<Mode, number> = {
  classic: 1.0,
  wrap: 0.75,
  maze: 1.5,
};

export const MODE_DESCRIPTION: Record<Mode, string> = {
  classic: "Walls kill. Random obstacles appear at length 15+.",
  wrap: "Walls teleport you through to the other side.",
  maze: "Pre-placed walls fill the arena. Tight quarters.",
};

// ===== Progressive difficulty =====
// Tick MS reduction per second alive — higher = faster ramp.
export const DIFFICULTY_RAMP: Record<Mode, number> = {
  classic: 0.25,
  wrap: 0.35,
  maze: 0.15,
};

// ===== High-score keys =====
export const HIGHSCORE_KEY: Record<Mode, string> = {
  classic: "snake-highscore-classic",
  wrap: "snake-highscore-wrap",
  maze: "snake-highscore-maze",
};

// ===== Visuals =====
export const UNDULATION_AMPLITUDE = 0.6;
export const BLINK_INTERVAL = 130;
export const BLINK_DURATION = 5;
export const TONGUE_DURATION = 14;
export const SPEED_TRAIL_MIN_LENGTH = 25;
export const SPEED_TRAIL_MAX = 12;
