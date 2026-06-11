import type {
  Vec, Apple, ApplePos, AppleChunk, JuiceParticle, GrassBlade,
} from "./types";
import {
  APPLE_OFFSETS, ARCHER_Y, MAX_CHUNKS, MAX_JUICE,
} from "./constants";

let nextId = 1;
export const getId = () => nextId++;
export const resetIdCounter = () => { nextId = 1; };

export function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Compute absolute apple position from friend.x and slot.
export function applePos(friendX: number, slot: ApplePos): Vec {
  const off = APPLE_OFFSETS[slot];
  return { x: friendX + off.dx, y: ARCHER_Y + off.dy };
}

// Refresh apple x/y in-place from current friend position.
export function syncApplePositions(apples: Apple[], friendX: number) {
  for (const a of apples) {
    const p = applePos(friendX, a.pos);
    a.x = p.x;
    a.y = p.y;
  }
}

export function makeApples(positions: ApplePos[], friendX: number): Apple[] {
  return positions.map((pos) => {
    const p = applePos(friendX, pos);
    return { id: getId(), pos, x: p.x, y: p.y, hit: false };
  });
}

// Build chunk burst when an apple is destroyed.
export function makeAppleChunks(
  arr: AppleChunk[],
  cx: number,
  cy: number,
  bullseye: boolean,
  impactAngle: number
): void {
  if (arr.length >= MAX_CHUNKS) return;
  // More chunks for bullseye
  const skinCount = bullseye ? 7 : 5;
  const fleshCount = bullseye ? 4 : 3;
  const total = skinCount + fleshCount + 1; // +1 stem
  const allowed = Math.min(total, MAX_CHUNKS - arr.length);

  let placed = 0;
  // Skin (red) chunks fly away from impact direction
  for (let i = 0; i < skinCount && placed < allowed; i++, placed++) {
    const a = impactAngle + Math.PI + (Math.random() - 0.5) * 2.2;
    const sp = 2 + Math.random() * (bullseye ? 5 : 3.5);
    arr.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.5,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      size: 4 + Math.random() * 3,
      color: Math.random() < 0.5 ? "#d63d3d" : "#a02828",
      life: 60, maxLife: 60,
      type: "skin",
    });
  }
  // Flesh (off-white)
  for (let i = 0; i < fleshCount && placed < allowed; i++, placed++) {
    const a = impactAngle + Math.PI + (Math.random() - 0.5) * 2.4;
    const sp = 1.5 + Math.random() * 3;
    arr.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      size: 3 + Math.random() * 2.5,
      color: "#f5d0a0",
      life: 55, maxLife: 55,
      type: "flesh",
    });
  }
  // Stem
  if (placed < allowed) {
    arr.push({
      x: cx, y: cy - 8,
      vx: (Math.random() - 0.5) * 3,
      vy: -2 - Math.random() * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.5,
      size: 5,
      color: "#3a2218",
      life: 50, maxLife: 50,
      type: "stem",
    });
  }
}

// Juice splatter on apple hit
export function makeJuiceSplatter(
  arr: JuiceParticle[],
  cx: number,
  cy: number,
  bullseye: boolean
): void {
  const count = bullseye ? 18 : 10;
  const allowed = Math.min(count, MAX_JUICE - arr.length);
  for (let i = 0; i < allowed; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * (bullseye ? 5 : 3.5);
    arr.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      life: 22 + Math.random() * 14,
      maxLife: 36,
      color: i % 3 === 0 ? "#ff6b1a" : "#d63d3d",
      size: 2 + Math.random() * 1.5,
    });
  }
}

// One-time grass blade initialization
export function makeGrass(): GrassBlade[] {
  const blades: GrassBlade[] = [];
  for (let i = 0; i < 800; i += 6) {
    blades.push({
      x: i + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      height: 3 + Math.random() * 2,
    });
  }
  return blades;
}
