import type { Vec, EnemyType, UnitType, Enemy, Unit, Particle } from "./types";
import { ENEMY_SPECS, UNIT_SPECS } from "./specs";
import { CENTER, WIDTH, HEIGHT, MAX_PARTICLES } from "./constants";

// ===== ID generator =====
let nextId = 1;
export const getId = () => nextId++;
export const resetIdCounter = () => { nextId = 1; };

// ===== Math =====
export function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Squared distance — preferred for comparisons in hot loops to avoid sqrt.
export function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Shortest signed angle from `from` to `to`, in (-PI, PI].
export function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ===== Particle helper =====
// Push up to `count` particles built by `factory`, but never exceed MAX_PARTICLES.
export function addBurst(
  arr: Particle[],
  count: number,
  factory: (i: number) => Particle
) {
  const allowed = Math.max(0, MAX_PARTICLES - arr.length);
  const n = Math.min(count, allowed);
  for (let i = 0; i < n; i++) arr.push(factory(i));
}

// ===== Entity factories =====
export function makeEnemy(type: EnemyType, pos: Vec, hpScale: number): Enemy {
  const base = ENEMY_SPECS[type];
  return {
    id: getId(),
    type,
    pos: { x: pos.x, y: pos.y },
    bodyAngle: Math.atan2(CENTER.y - pos.y, CENTER.x - pos.x),
    turretAngle: Math.atan2(CENTER.y - pos.y, CENTER.x - pos.x),
    hp: base.maxHp * hpScale,
    spec: { ...base, maxHp: base.maxHp * hpScale },
    lastShot: Date.now() + Math.random() * 600,
  };
}

export function makeUnit(type: UnitType, pos: Vec): Unit {
  const spec = UNIT_SPECS[type];
  return {
    id: getId(),
    type,
    pos: {
      x: pos.x + (Math.random() - 0.5) * 14,
      y: pos.y + (Math.random() - 0.5) * 14,
    },
    angle: Math.atan2(pos.y - CENTER.y, pos.x - CENTER.x),
    hp: spec.maxHp,
    spec,
    lastShot: 0,
    target: null,
    hoverPhase: Math.random() * Math.PI * 2,
  };
}

// Random point along the arena edge for enemy spawns.
export function spawnEdge(): Vec {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: 20, y: 30 + Math.random() * (HEIGHT - 60) };
    case 1: return { x: WIDTH - 20, y: 30 + Math.random() * (HEIGHT - 60) };
    case 2: return { x: 30 + Math.random() * (WIDTH - 60), y: 20 };
    default: return { x: 30 + Math.random() * (WIDTH - 60), y: HEIGHT - 20 };
  }
}
