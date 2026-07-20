/**
 * Destructible layouts. Instead of one packed grid, the course is dressed with
 * discrete structures — towers, walls, pyramids, and tight packs — so there's
 * shape and variety to smash through. Columns are axis-aligned (no jitter) so
 * the tall stacks balance instead of toppling the instant physics starts.
 */
import type { PropKind } from "./scoring";
import { heightAt, type TerrainParams } from "./engine/terrainSampler";

export interface PileItem {
  kind: PropKind;
  position: [number, number, number];
  drift?: [number, number];
}

// Rough footprints (must match Destructible SIZE) so stacks sit flush.
const H = {
  crate: 1.6, box: 1.9, barrel: 1.9, gold: 1.6, car: 1.6,
  cone: 1.1, hydrant: 1.1, signpost: 2.6, fence: 1.4,
};

/** A vertical column `count` high of one kind. */
function tower(x: number, z: number, count: number, kind: PropKind, out: PileItem[]) {
  const h = H[kind];
  for (let i = 0; i < count; i++) {
    out.push({ kind, position: [x, h / 2 + i * h, z] });
  }
}

/** A wall `cols` wide × `rows` high of boxes, facing along z. */
function wall(x: number, z: number, cols: number, rows: number, kind: PropKind, out: PileItem[]) {
  const s = H[kind];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      out.push({ kind, position: [x + (c - (cols - 1) / 2) * s, s / 2 + r * s, z] });
    }
  }
}

/** A pyramid `base` wide shrinking to a point. */
function pyramid(x: number, z: number, base: number, kind: PropKind, out: PileItem[]) {
  const s = H[kind];
  for (let lvl = 0; lvl < base; lvl++) {
    const n = base - lvl;
    for (let c = 0; c < n; c++) {
      out.push({ kind, position: [x + (c - (n - 1) / 2) * s, s / 2 + lvl * s, z - (c - (n - 1) / 2) * 0.02] });
    }
  }
}

/** A tight pack of mixed kinds around a point. */
function pack(x: number, z: number, out: PileItem[]) {
  out.push({ kind: "barrel", position: [x, 0.95, z] });
  out.push({ kind: "crate", position: [x + 1.6, 0.8, z] });
  out.push({ kind: "crate", position: [x - 1.6, 0.8, z] });
  out.push({ kind: "box", position: [x, 0.95, z - 1.7] });
  out.push({ kind: "gold", position: [x, 2.4, z] });
  out.push({ kind: "crate", position: [x + 0.9, 2.2, z - 0.9] });
}

/** A roadside dressing of light street props around a point. */
function streetDressing(x: number, z: number, out: PileItem[]) {
  out.push({ kind: "cone", position: [x, 0.55, z] });
  out.push({ kind: "cone", position: [x + 1.0, 0.55, z + 0.6] });
  out.push({ kind: "hydrant", position: [x - 1.2, 0.55, z] });
  out.push({ kind: "signpost", position: [x + 2.0, 1.3, z - 0.5] });
  out.push({ kind: "fence", position: [x - 0.4, 0.7, z - 1.4] });
}

/** The end-of-track finale: a wall of structures, ~5x taller than before. */
export function buildFinale(pileZ: number): PileItem[] {
  const out: PileItem[] = [];
  const z0 = pileZ;

  // Back wall spanning the track — the thing you smash into.
  wall(0, z0 - 4, 11, 6, "box", out);

  // A line of towers of varying height in front of the wall.
  tower(-10, z0 + 2, 9, "crate", out);
  tower(-6, z0 + 1, 12, "crate", out);
  tower(-2, z0 + 3, 8, "gold", out);
  tower(3, z0 + 1, 11, "crate", out);
  tower(8, z0 + 2, 10, "barrel", out);
  tower(11, z0 + 3, 7, "crate", out);

  // Pyramids flanking the centre.
  pyramid(-7, z0 + 8, 6, "crate", out);
  pyramid(7, z0 + 8, 6, "box", out);

  // Packs scattered in the approach.
  pack(0, z0 + 12, out);
  pack(-11, z0 + 14, out);
  pack(11, z0 + 15, out);

  // Heavy cars nestled in and a couple of slow movers crossing the run-in.
  out.push({ kind: "car", position: [-4, 1.0, z0 + 6] });
  out.push({ kind: "car", position: [4, 1.0, z0 + 5] });
  out.push({ kind: "car", position: [0, 1.0, z0 - 1] });
  out.push({ kind: "car", position: [-13, 1.0, z0 + 20], drift: [2.5, 0] });
  out.push({ kind: "car", position: [13, 1.0, z0 + 24], drift: [-2.3, 0] });

  return out;
}

/** Smaller structures down the length of the track to smash on the way in. */
export function buildTrackStructures(): PileItem[] {
  const out: PileItem[] = [];
  const spots: [number, number][] = [
    [9, -10], [-9, -20], [10, -30], [-10, -40], [8, -50],
  ];
  spots.forEach(([x, z], i) => {
    if (i % 2 === 0) tower(x, z, 4 + (i % 3), "crate", out);
    else pack(x, z, out);
  });
  out.push({ kind: "car", position: [-6, 1.0, -26] });
  out.push({ kind: "car", position: [6, 1.0, -46] });
  streetDressing(-8, -14, out);
  streetDressing(9, -38, out);
  return out;
}

/**
 * Lift every item so it rests ON the terrain at its (x, z). On flat ground
 * (amplitude 0) heightAt is 0, so positions are returned unchanged — Downtown
 * is behavior-preserving. Pure: no React, no Three.
 */
export function anchorToTerrain(items: PileItem[], terrain: TerrainParams): PileItem[] {
  return items.map((it) => ({
    ...it,
    position: [
      it.position[0],
      it.position[1] + heightAt(terrain, it.position[0], it.position[2]),
      it.position[2],
    ] as [number, number, number],
  }));
}
