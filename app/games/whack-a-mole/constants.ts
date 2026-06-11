import type { Mode, MoleType } from "./types";

// ===== Canvas =====
export const WIDTH = 500;
export const HEIGHT = 500;
export const GRID_PADDING = 30;
export const HOLE_COLS = 3;
export const HOLE_ROWS = 3;
export const CELL_W = (WIDTH - 2 * GRID_PADDING) / HOLE_COLS;
export const CELL_H = (HEIGHT - 2 * GRID_PADDING) / HOLE_ROWS;
export const HOLE_RADIUS = 52;

// ===== Game length =====
export const CLASSIC_DURATION_SEC = 30;

// ===== Spawn schedule =====
// Difficulty t ramps from 0 → 1 over 30 seconds; rate scales with t.
export const SPAWN_DELAY_MIN_START = 550;
export const SPAWN_DELAY_MIN_END = 280;
export const SPAWN_DELAY_MAX_START = 1100;
export const SPAWN_DELAY_MAX_END = 550;
export const DIFFICULTY_RAMP_SEC = 30;

// ===== Mole specs =====
// Range-based durations so each mole feels slightly different.
export const MOLE_SPECS: Record<MoleType, {
  durationMin: number;
  durationMax: number;
  points: number;
  color: string;
  light: string;
  dark: string;
  maxHits: number;
}> = {
  normal: {
    durationMin: 700, durationMax: 1300, points: 10,
    color: "#8a5a30", light: "#b08050", dark: "#5a3a1a", maxHits: 1,
  },
  speedy: {
    durationMin: 320, durationMax: 540, points: 20,
    color: "#c8783a", light: "#e89a55", dark: "#7a4515", maxHits: 1,
  },
  golden: {
    durationMin: 550, durationMax: 900, points: 30,
    color: "#ffd060", light: "#fff5d0", dark: "#a06820", maxHits: 1,
  },
  bomb: {
    durationMin: 800, durationMax: 1300, points: 0,
    color: "#2a2a2a", light: "#4a4a4a", dark: "#0a0a0a", maxHits: 1,
  },
  boss: {
    durationMin: 1200, durationMax: 1900, points: 60,
    color: "#5a4028", light: "#8a6040", dark: "#2a1810", maxHits: 2,
  },
  freeze: {
    durationMin: 800, durationMax: 1200, points: 15,
    color: "#5fc8e0", light: "#a8e8f8", dark: "#1a608c", maxHits: 1,
  },
};

// First-hit partial points for boss before defeat.
export const BOSS_FIRST_HIT_POINTS = 20;
export const BOSS_DEFEAT_POINTS = 40;     // total = 20 + 40 = 60

// ===== Mole type weights (sum to ~1.0) =====
// Bomb chance ramps with difficulty so the early game is more forgiving.
export const BOSS_CHANCE = 0.04;
export const FREEZE_CHANCE = 0.05;
export const GOLDEN_CHANCE = 0.08;
export const SPEEDY_CHANCE = 0.12;
export const BOMB_CHANCE_BASE = 0.08;
export const BOMB_CHANCE_RAMP = 0.06;     // adds up to +6% over difficulty ramp

// ===== Bomb penalty (% of current score) =====
// In CLASSIC: lose this fraction of current score, with a minimum floor.
export const BOMB_PENALTY_FRAC = 0.10;
export const BOMB_PENALTY_FLOOR = 10;

// ===== Combo =====
export const COMBO_BASE_BONUS = 2;        // each combo step adds N * 2 bonus

// ===== Freeze duration =====
export const FREEZE_DURATION_MS = 1500;

// ===== Hammer =====
export const HAMMER_SWING_MS = 400;
export const HAMMER_REST_ANGLE = (135 * Math.PI) / 180;   // up-and-to-the-right from head
export const HAMMER_PEAK_ANGLE = (90 * Math.PI) / 180;    // pointing straight up at impact

// ===== Mole animation =====
// Rise/fall portions of total duration (rest is "hold" phase).
export const RISE_MS = 160;
export const FALL_MS = 220;
export const STUN_MS = 260;

// ===== Visuals =====
// Score "pop" duration on increment
export const SCORE_POP_MS = 250;

// ===== Mode configs =====
export const HIGHSCORE_KEY: Record<Mode, string> = {
  classic: "mole-highscore-classic",
  endless: "mole-highscore-endless",
};

export const MODE_DESCRIPTION: Record<Mode, string> = {
  classic: "30 seconds. Bombs cost you a % of your score.",
  endless: "No timer. Hit a bomb and it's over. How long can you go?",
};
