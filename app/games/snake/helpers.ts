import type { Point, Food, Powerup, Wall } from "./types";
import { COLS, ROWS } from "./constants";

let nextId = 1;
export const getId = () => nextId++;
export const resetIdCounter = () => { nextId = 1; };

export function randomEmptyCell(
  snake: Point[],
  others: Array<Point | null | undefined>
): Point | null {
  const occupied = new Set<number>();
  for (const p of snake) occupied.add(p.y * COLS + p.x);
  for (const p of others) {
    if (p) occupied.add(p.y * COLS + p.x);
  }
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if (!occupied.has(y * COLS + x)) return { x, y };
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(y * COLS + x)) return { x, y };
    }
  }
  return null;
}

export function spawnFood(
  snake: Point[],
  walls: Wall[],
  others: Array<Point | null | undefined> = []
): Food | null {
  const pt = randomEmptyCell(snake, [...walls, ...others]);
  return pt ? { x: pt.x, y: pt.y, kind: "normal" } : null;
}

export function spawnPoisonFood(
  snake: Point[],
  walls: Wall[],
  others: Array<Point | null | undefined> = []
): Food | null {
  const pt = randomEmptyCell(snake, [...walls, ...others]);
  return pt ? { x: pt.x, y: pt.y, kind: "poison", spawnedAt: Date.now() } : null;
}

export function randomPowerupType(): "slow" | "ghost" | "shrink" | "multi" | "speed" {
  const r = Math.random();
  if (r < 0.20) return "slow";
  if (r < 0.40) return "ghost";
  if (r < 0.60) return "shrink";
  if (r < 0.80) return "multi";
  return "speed";
}

export function spawnPowerup(
  snake: Point[],
  walls: Wall[],
  others: Array<Point | null | undefined>
): Powerup | null {
  const pt = randomEmptyCell(snake, [...walls, ...others]);
  if (!pt) return null;
  return { x: pt.x, y: pt.y, type: randomPowerupType(), spawnedAt: Date.now() };
}
