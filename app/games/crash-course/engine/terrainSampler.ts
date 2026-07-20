/**
 * Terrain sampler — pure, seeded height/normal generation and a Rapier
 * heightfield builder. No React, no Three, no randomness: heightAt is a pure
 * function of (params, x, z) so the same seed always yields the same hills and
 * every consumer (mesh, collider, prop placement) agrees on the surface.
 */

export interface TerrainParams {
  seed: number;
  /** Peak hill height in metres. 0 = perfectly flat. */
  amplitude: number;
  /** Spatial frequency of the hills (larger = tighter). */
  frequency: number;
}

export interface Vec3 { x: number; y: number; z: number }

// --- seeded value noise (hash -> smooth interpolation) --------------------

function hash2(ix: number, iz: number, seed: number): number {
  // Deterministic hash in [0,1). Integer lattice point -> pseudo-random value.
  let h = ix * 374761393 + iz * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  // >>> 0 forces unsigned; divide to [0,1)
  return ((h >>> 0) % 100000) / 100000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = smooth(x - x0), fz = smooth(z - z0);
  const v00 = hash2(x0, z0, seed);
  const v10 = hash2(x0 + 1, z0, seed);
  const v01 = hash2(x0, z0 + 1, seed);
  const v11 = hash2(x0 + 1, z0 + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fz; // [0,1)
}

export function heightAt(p: TerrainParams, x: number, z: number): number {
  if (p.amplitude === 0) return 0;
  // Centre the [0,1) noise to [-1,1], scale by amplitude.
  const n = valueNoise(x * p.frequency, z * p.frequency, p.seed) * 2 - 1;
  return n * p.amplitude;
}

export function normalAt(p: TerrainParams, x: number, z: number): Vec3 {
  const e = 0.5;
  const hL = heightAt(p, x - e, z);
  const hR = heightAt(p, x + e, z);
  const hD = heightAt(p, x, z - e);
  const hU = heightAt(p, x, z + e);
  // Gradient -> normal = normalize(-dHdx, 1, -dHdz) with the 2e denominator.
  const nx = -(hR - hL) / (2 * e);
  const nz = -(hU - hD) / (2 * e);
  const len = Math.hypot(nx, 1, nz) || 1;
  return { x: nx / len, y: 1 / len, z: nz / len };
}

export interface Heightfield {
  nrows: number;
  ncols: number;
  heights: Float32Array;
  scale: Vec3;
}

/**
 * Sample a `width × length` field centred on the origin into a Rapier
 * heightfield. `segments` cells per side → `segments+1` samples per side.
 * Heights are column-major (Rapier's expected order).
 */
export function buildHeightfield(
  p: TerrainParams,
  width: number,
  length: number,
  segments: number,
): Heightfield {
  const n = segments + 1;
  const heights = new Float32Array(n * n);
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n; row++) {
      // Map grid indices to world X/Z across the centred field.
      const x = (col / segments - 0.5) * width;
      const z = (row / segments - 0.5) * length;
      heights[col * n + row] = heightAt(p, x, z); // column-major
    }
  }
  return { nrows: n, ncols: n, heights, scale: { x: width, y: 1, z: length } };
}
