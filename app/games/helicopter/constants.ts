import type { Difficulty } from "./types";

// ===== Arena =====
export const WIDTH = 800;
export const HEIGHT = 400;

// ===== Helicopter =====
export const HELI_X = 120;
export const HELI_W = 40;
export const HELI_H = 18;

// ===== Physics =====
export const GRAVITY = 0.34;
export const LIFT = -0.56;
export const SCROLL_SPEED = 3.2;
// More aggressive ramp so late biomes feel different to fly.
export const SPEED_RAMP = 0.0014;

// ===== Obstacles =====
export const OBSTACLE_GAP_DEFAULT = 130;
export const OBSTACLE_GAP_NARROW = 96;
export const OBSTACLE_WIDTH = 64;
export const OBSTACLE_SPACING = 240;

// ===== Easy mode gives wider gaps =====
export const EASY_GAP_BONUS = 18;

// ===== Pickups =====
export const PICKUP_SIZE = 14;
export const PICKUP_HITBOX = 22;
// Pickup spawns at x = lastObstacle.x + this offset (in the gap to next pillar).
export const PICKUP_OFFSET_FROM_PILLAR = 120;
// Per-pickup-slot roll chances (mutually exclusive, fall through):
export const GOLD_GEM_CHANCE = 0.06;
export const RED_GEM_CHANCE = 0.04;
export const GREEN_GEM_CHANCE = 0.10;
export const POWERUP_CHANCE = 0.05;
export const BLUE_GEM_CHANCE = 0.40;
// (remaining ~35% is no pickup, gives natural rhythm)

// ===== Power-up effects =====
export const MAGNET_RADIUS = 200;
export const MAGNET_RADIUS_SQ = MAGNET_RADIUS * MAGNET_RADIUS;
export const MAGNET_DURATION_MS = 5000;
export const SLOWMO_DURATION_MS = 4000;
export const SLOWMO_FACTOR = 0.5;
// Invulnerability after a shield is consumed. Kept close to the life-loss
// window (INVULN_AFTER_HIT_MS) so popping a shield gives the same generous
// ghost period as taking a hit — long enough to fly clear of the obstacle.
export const SHIELD_GRACE_MS = 1800;

// ===== Scoring =====
export const BLUE_GEM_POINTS = 25;
export const GREEN_GEM_POINTS = 50;
export const RED_GEM_POINTS = 75;
export const GOLD_GEM_POINTS = 100;
export const COIN_POINTS = 10;

// ===== Coin patches (3x3 grids between static pillars) =====
export const COIN_PATCH_CHANCE = 0.45;   // rolled only when corridor is static
export const COIN_PATCH_SPACING = 30;    // px between coins in the grid
export const COIN_PATCH_OFFSET = 150;    // x past the pillar where the grid sits

// ===== Laser gate (Neon biome) =====
// Cycle measured in frames. Phases (as a fraction of the cycle):
//   0.00–0.06  off (both openings safe)
//   0.06–0.14  charge upper (telegraph, NOT deadly yet)
//   0.14–0.22  BURST upper (deadly + super bright)
//   0.22–0.44  thin upper (deadly + thin steady beam)
//   0.44–0.50  off (brief breather, both safe)
//   0.50–0.58  charge lower
//   0.58–0.66  BURST lower
//   0.66–0.88  thin lower
//   0.88–1.00  off (both safe)
// See laserPhase() in helpers.ts.
export const LASER_CYCLE = 200;
export const LASER_BAR_HEIGHT = 50;   // height of the middle bar between openings
export const LASER_SPACING_BONUS = 100; // extra X-spacing before/after laser pillars

// ===== Space biome =====
// On entering space, all pillars clear for this long (open void), then
// columns return with wider "room" spacing alongside drifting hazards.
export const SPACE_CLEAR_MS = 8000;
export const SPACE_GAP_MIN = 320;        // wider than OBSTACLE_SPACING → roomy
export const SPACE_GAP_MAX = 500;
export const ASTEROID_MIN_MS = 1300;     // gap between asteroid spawns
export const ASTEROID_MAX_MS = 2300;
export const JET_MIN_MS = 3800;          // gap between jet spawns
export const JET_MAX_MS = 6200;
export const JET_BULLET_SPEED = 7.5;

// ===== Perf safety =====
export const MAX_PARTICLES = 200;

// ===== Visuals =====
// Heli tilt: angle = clamp(vy * TILT_FACTOR, -TILT_MAX, +TILT_MAX)
export const TILT_FACTOR = 0.05;
export const TILT_MAX = 0.45;

// ===== Wall scrape =====
// How close to a pillar edge before sparks fly (still alive).
export const SCRAPE_THRESHOLD = 5;
export const SCRAPE_COOLDOWN_MS = 80;

// ===== Near-miss bonus =====
export const NEAR_MISS_POINTS = 5;
export const NEAR_MISS_COOLDOWN_MS = 500;

// ===== Combo system =====
export const COMBO_TIMEOUT_MS = 4000;
export const COMBO_MULTIPLIER_THRESHOLDS = [3, 6, 10]; // x2 at 3 gems, x3 at 6, x4 at 10

// ===== Lives (Easy mode) =====
export const EASY_LIVES = 3;
// Hard cap on lives even after collecting heart pickups (easy only).
export const MAX_LIVES_EASY = 5;
export const INVULN_AFTER_HIT_MS = 2000;

// ===== Heart pickup (Volcano biome, easy mode only) =====
// Per pillar-recycle roll. ~3% × ~70 recycles through the volcano biome
// averages to ~2 hearts per run, matching the spec.
export const HEART_SPAWN_CHANCE_VOLCANO = 0.03;
export const HEART_OVERFLOW_POINTS = 100; // score given if lives are already at cap

// ===== High-score keys =====
export const HIGHSCORE_KEY: Record<Difficulty, string> = {
  easy: "heli-highscore-easy",
  hard: "heli-highscore-hard",
};
