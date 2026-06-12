import type { Vec, EnemyType, UnitType, Enemy, Unit, Particle, Building } from "./types";
import { ENEMY_SPECS, UNIT_SPECS, BUILDING_SPECS, UPGRADE_MULT } from "./specs";
import { CENTER, W, H, MAX_PARTICLES, RADAR_REVEAL_RANGE } from "./constants";

// ===== ID generator =====
let nextId = 1;
export const getId = () => nextId++;
export const resetIdCounter = () => { nextId = 1; };

// ===== Math =====
export function dist(a: Vec, b: Vec) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ===== Particle helper =====
export function addBurst(arr: Particle[], count: number, factory: (i: number) => Particle) {
  const allowed = Math.max(0, MAX_PARTICLES - arr.length);
  const n = Math.min(count, allowed);
  for (let i = 0; i < n; i++) arr.push(factory(i));
}

// ===== Entity factories =====
export function makeEnemy(type: EnemyType, pos: Vec, hpScale: number): Enemy {
  const base = ENEMY_SPECS[type];
  const hp = Math.round(base.maxHp * hpScale);
  return {
    id: getId(), type,
    pos: { x: pos.x, y: pos.y },
    bodyAngle: Math.atan2(CENTER.y - pos.y, CENTER.x - pos.x),
    turretAngle: Math.atan2(CENTER.y - pos.y, CENTER.x - pos.x),
    hp, maxHp: hp,
    spec: { ...base, maxHp: hp },
    lastShot: Date.now() + Math.random() * 600,
    lastHeal: 0,
    revealed: !base.stealth,
    stealthAlpha: base.stealth ? 0.08 : 1,
    spawnTime: Date.now(),
    flankAngle: (Math.random() - 0.5) * Math.PI * 0.6,
  };
}

export function makeUnit(type: UnitType, pos: Vec, building: Building): Unit {
  const base = UNIT_SPECS[type];
  const mult = UPGRADE_MULT[building.level] || UPGRADE_MULT[1];
  const hp = Math.round(base.maxHp * mult.hp);
  return {
    id: getId(), type,
    pos: {
      x: pos.x + (Math.random() - 0.5) * 14,
      y: pos.y + (Math.random() - 0.5) * 14,
    },
    angle: Math.atan2(pos.y - CENTER.y, pos.x - CENTER.x),
    hp, maxHp: hp,
    spec: {
      ...base,
      maxHp: hp,
      damage: Math.round(base.damage * mult.dmg),
      fireRate: Math.round(base.fireRate * mult.rate),
    },
    lastShot: 0,
    target: null,
    hoverPhase: Math.random() * Math.PI * 2,
    rallyPoint: null,
    burnTicks: 0,
  };
}

// Random point along arena edge
export function spawnEdge(): Vec {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: 20, y: 30 + Math.random() * (H - 60) };
    case 1: return { x: W - 20, y: 30 + Math.random() * (H - 60) };
    case 2: return { x: 30 + Math.random() * (W - 60), y: 20 };
    default: return { x: 30 + Math.random() * (W - 60), y: H - 20 };
  }
}

// ===== Smart targeting: unit chooses best enemy =====
export function pickUnitTarget(
  u: Unit, enemies: Enemy[], aggroMap: Map<number, number>,
  radarPositions: Vec[],
): Enemy | null {
  if (enemies.length === 0) return null;
  const prio = u.spec.priority;
  let best: Enemy | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    // Skip unrevealed stealth enemies unless unit is aircraft or near radar
    if (e.spec.stealth && !e.revealed) {
      let nearRadar = false;
      for (const rp of radarPositions) {
        if (distSq(e.pos, rp) < RADAR_REVEAL_RANGE * RADAR_REVEAL_RANGE) { nearRadar = true; break; }
      }
      if (!nearRadar && !u.spec.isAircraft) continue;
    }

    const dx = e.pos.x - u.pos.x, dy = e.pos.y - u.pos.y;
    let score = dx * dx + dy * dy;

    // Priority bonus: preferred targets get a huge distance discount
    const prioIdx = prio.indexOf(e.type);
    if (prioIdx >= 0) score *= (0.3 + prioIdx * 0.15);

    // Bomber priority: always high because they threaten base
    if (e.type === "bomber") score *= 0.4;
    // Healer priority: they sustain the enemy force
    if (e.type === "healer") score *= 0.5;

    // Aggro spread: avoid dogpiling
    const attackers = aggroMap.get(e.id) || 0;
    score += attackers * 70 * 70;

    // Low HP bonus — finish off wounded enemies
    if (e.hp < e.maxHp * 0.3) score *= 0.6;

    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

// ===== Smart enemy targeting =====
export function pickEnemyTarget(
  e: Enemy, units: Unit[], buildings: Building[],
): { x: number; y: number } {
  const behavior = e.spec.behavior;

  if (behavior === "rush") {
    // Bombers always rush the base
    return { x: CENTER.x, y: CENTER.y };
  }

  if (behavior === "stealth" && !e.revealed) {
    return { x: CENTER.x, y: CENTER.y };
  }

  if (behavior === "support") {
    // Healers stay behind other enemies — move toward center but not too close
    const dx = CENTER.x - e.pos.x, dy = CENTER.y - e.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 250) return { x: e.pos.x + dx * 0.5, y: e.pos.y + dy * 0.5 };
    return { x: e.pos.x, y: e.pos.y }; // hold position
  }

  if (behavior === "flank") {
    // Scouts try to circle around to attack from the sides
    const ang = Math.atan2(CENTER.y - e.pos.y, CENTER.x - e.pos.x) + e.flankAngle;
    const d = dist(e.pos, CENTER);
    if (d > 200) {
      return { x: e.pos.x + Math.cos(ang) * 100, y: e.pos.y + Math.sin(ang) * 100 };
    }
    // Close enough, attack
  }

  if (behavior === "swarm") {
    // Swarm targets nearest unit
    let nearU: Unit | null = null, nearD = Infinity;
    for (const u of units) {
      const d = distSq(u.pos, e.pos);
      if (d < nearD) { nearD = d; nearU = u; }
    }
    if (nearU && nearD < e.spec.awarenessRange * e.spec.awarenessRange) {
      return { x: nearU.pos.x, y: nearU.pos.y };
    }
    return { x: CENTER.x, y: CENTER.y };
  }

  // Assault: target nearest unit if close, otherwise go for base
  let nearU: Unit | null = null, nearDSq = Infinity;
  for (const u of units) {
    const d = distSq(u.pos, e.pos);
    if (d < nearDSq) { nearDSq = d; nearU = u; }
  }
  const baseDSq = distSq(e.pos, CENTER);
  const aware = e.spec.awarenessRange * e.spec.awarenessRange;
  if (nearU && nearDSq < baseDSq && nearDSq < aware) {
    return { x: nearU.pos.x, y: nearU.pos.y };
  }
  return { x: CENTER.x, y: CENTER.y };
}

// ===== Check if position is near any radar tower =====
export function getRadarPositions(buildings: Building[]): Vec[] {
  return buildings.filter(b => b.type === "radar-tower").map(b => b.pos);
}

export function isNearRadar(pos: Vec, radarPositions: Vec[], range: number): boolean {
  for (const rp of radarPositions) {
    if (distSq(pos, rp) < range * range) return true;
  }
  return false;
}
