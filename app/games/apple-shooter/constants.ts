// ===== Arena =====
export const WIDTH = 800;
export const HEIGHT = 400;
export const GROUND_Y = 340;

// ===== Archer =====
export const ARCHER_X = 100;
export const ARCHER_Y = 300;

// ===== Physics =====
export const GRAVITY = 0.13;
export const APPLE_RADIUS = 14;
// Within this many px of apple center counts as bullseye.
export const BULLSEYE_RADIUS = 5;

// ===== Apples =====
// Y offsets relative to friend's feet (ARCHER_Y).
// Head apple sits above the head; hand apples float outside the body.
export const APPLE_OFFSETS: Record<"head" | "left_hand" | "right_hand", { dx: number; dy: number }> = {
  head:        { dx: 0,   dy: -78 },
  left_hand:   { dx: -24, dy: -50 },
  right_hand:  { dx: 24,  dy: -50 },
};

// ===== Scoring =====
export const APPLE_HIT_POINTS = 100;
export const BULLSEYE_POINTS = 250;
export const SAVED_ARROW_BONUS = 50;
export const SPEED_BONUS_FAST_MS = 3000;     // < 3s clear = +50
export const SPEED_BONUS_OK_MS = 5000;       // < 5s clear = +25
export const SPEED_BONUS_FAST_PTS = 50;
export const SPEED_BONUS_OK_PTS = 25;
export const PRO_MODE_MULT = 2;

// ===== Mood / reaction timings =====
export const FLINCH_DURATION_MS = 600;
export const CHEER_DURATION_MS = 1100;
export const PANIC_DURATION_MS = 400;
// When arrow is within this many px of friend's head, flinch.
export const NEAR_MISS_RADIUS = 32;
export const NEAR_MISS_RADIUS_SQ = NEAR_MISS_RADIUS * NEAR_MISS_RADIUS;
export const FLINCH_COOLDOWN_MS = 700;

// ===== Visuals =====
export const ARROW_TRAIL_LIFE = 14;
export const ARROW_TRAIL_MAX = 18;
export const MAX_CHUNKS = 60;
export const MAX_JUICE = 80;

// Trajectory preview (shorter than original to keep it skill-based)
export const PREVIEW_FRAMES = 16;

// Camera shake by event
export const SHAKE_HIT = 8;
export const SHAKE_BULLSEYE = 16;
export const SHAKE_FRIEND_HIT = 14;
export const SHAKE_NEAR_MISS = 4;

// ===== Level progression =====
// Friend's base X starts here and shifts right with level.
export const TARGET_START_X = 560;
export const TARGET_STEP_PER_LEVEL = 18;
export const TARGET_MAX_X = WIDTH - 100;
