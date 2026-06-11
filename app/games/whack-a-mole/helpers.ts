import type { MoleType } from "./types";
import {
  GRID_PADDING, CELL_W, CELL_H, HOLE_COLS, HOLE_RADIUS,
  SPAWN_DELAY_MIN_START, SPAWN_DELAY_MIN_END,
  SPAWN_DELAY_MAX_START, SPAWN_DELAY_MAX_END,
  DIFFICULTY_RAMP_SEC,
  BOSS_CHANCE, FREEZE_CHANCE, GOLDEN_CHANCE, SPEEDY_CHANCE,
  BOMB_CHANCE_BASE, BOMB_CHANCE_RAMP,
  MOLE_SPECS,
} from "./constants";

let nextId = 1;
export const getId = () => nextId++;
export const resetIdCounter = () => { nextId = 1; };

// Hole center in canvas coordinates.
export function holeCenter(index: number): { x: number; y: number } {
  const col = index % HOLE_COLS;
  const row = Math.floor(index / HOLE_COLS);
  return {
    x: GRID_PADDING + CELL_W * (col + 0.5),
    y: GRID_PADDING + CELL_H * (row + 0.5),
  };
}

// Hit-test: which hole was clicked? Returns -1 if none.
export function holeAt(x: number, y: number): number {
  const r2 = HOLE_RADIUS * HOLE_RADIUS;
  for (let i = 0; i < HOLE_COLS * HOLE_COLS; i++) {
    const c = holeCenter(i);
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy < r2) return i;
  }
  return -1;
}

// Compute difficulty 0..1 from elapsed seconds (capped at 1).
export function difficultyT(elapsedSec: number): number {
  return Math.max(0, Math.min(1, elapsedSec / DIFFICULTY_RAMP_SEC));
}

// Spawn delay for next mole based on difficulty.
export function spawnDelay(t: number): number {
  const min = SPAWN_DELAY_MIN_START + (SPAWN_DELAY_MIN_END - SPAWN_DELAY_MIN_START) * t;
  const max = SPAWN_DELAY_MAX_START + (SPAWN_DELAY_MAX_END - SPAWN_DELAY_MAX_START) * t;
  return min + Math.random() * (max - min);
}

// Pick a mole type using static weights + a difficulty-scaled bomb chance.
export function pickMoleType(t: number): MoleType {
  const bombChance = BOMB_CHANCE_BASE + BOMB_CHANCE_RAMP * t;
  const r = Math.random();
  let cum = 0;
  cum += BOSS_CHANCE;    if (r < cum) return "boss";
  cum += FREEZE_CHANCE;  if (r < cum) return "freeze";
  cum += GOLDEN_CHANCE;  if (r < cum) return "golden";
  cum += SPEEDY_CHANCE;  if (r < cum) return "speedy";
  cum += bombChance;     if (r < cum) return "bomb";
  return "normal";
}

// Random duration in the spec's range
export function pickDuration(type: MoleType): number {
  const spec = MOLE_SPECS[type];
  return spec.durationMin + Math.random() * (spec.durationMax - spec.durationMin);
}
