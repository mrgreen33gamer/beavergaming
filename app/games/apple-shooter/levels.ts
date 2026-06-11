import type { LevelConfig, ApplePos } from "./types";
import {
  TARGET_START_X, TARGET_STEP_PER_LEVEL, TARGET_MAX_X,
} from "./constants";

// Difficulty milestones — return value is the "new this level" banner text
// shown briefly at level start.
function newThisLevel(level: number): string | null {
  if (level === 4) return "WIND";
  if (level === 6) return "TWO APPLES";
  if (level === 8) return "MOVING TARGET";
  if (level === 11) return "THREE APPLES";
  if (level === 13) return "FASTER TARGET";
  if (level === 16) return "STRONG WINDS";
  return null;
}

function applePositionsForLevel(level: number): ApplePos[] {
  if (level >= 11) return ["head", "left_hand", "right_hand"];
  if (level >= 6)  return ["head", "right_hand"];
  return ["head"];
}

export function getLevelConfig(level: number): LevelConfig {
  // Target shifts right gradually but clamps.
  const targetBaseX = Math.min(TARGET_START_X + level * TARGET_STEP_PER_LEVEL, TARGET_MAX_X);

  const moves = level >= 8;
  let moveSpeed = 0;
  let moveRange = 0;
  if (level >= 18) {
    moveSpeed = 0.0020;
    moveRange = 80;
  } else if (level >= 13) {
    moveSpeed = 0.0015;
    moveRange = 60;
  } else if (level >= 8) {
    moveSpeed = 0.0009;
    moveRange = 35;
  }

  // Wind scales modestly. Direction randomized each level when active.
  let windAmplitude = 0;
  if (level >= 16) windAmplitude = 1.0;
  else if (level >= 10) windAmplitude = 0.7;
  else if (level >= 4) windAmplitude = Math.min(0.55, (level - 3) * 0.18);

  return {
    level,
    targetBaseX,
    applePositions: applePositionsForLevel(level),
    moves,
    moveSpeed,
    moveRange,
    windAmplitude,
    newThisLevel: newThisLevel(level),
  };
}
