import { describe, it, expect } from "vitest";
import { heightAt, normalAt, buildHeightfield, type TerrainParams } from "../terrain";

const FLAT: TerrainParams = { seed: 1, amplitude: 0, frequency: 0.05 };
const HILLS: TerrainParams = { seed: 7, amplitude: 4, frequency: 0.08 };

describe("terrain sampler", () => {
  it("is flat everywhere when amplitude is 0", () => {
    for (const [x, z] of [[0, 0], [12, -30], [-40, 55]]) {
      expect(heightAt(FLAT, x, z)).toBe(0);
    }
  });

  it("is deterministic for a given seed", () => {
    expect(heightAt(HILLS, 10, -20)).toBe(heightAt(HILLS, 10, -20));
  });

  it("varies with position and stays within +/- amplitude", () => {
    const a = heightAt(HILLS, 3, 3);
    const b = heightAt(HILLS, 9, -14);
    expect(a).not.toBe(b);
    for (const [x, z] of [[0, 0], [5, 5], [-8, 20], [30, -30]]) {
      const h = heightAt(HILLS, x, z);
      expect(Math.abs(h)).toBeLessThanOrEqual(HILLS.amplitude + 1e-6);
    }
  });

  it("gives an up-normal on flat ground", () => {
    const n = normalAt(FLAT, 5, 5);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(n.z).toBeCloseTo(0);
  });

  it("gives a unit-length normal on hills", () => {
    const n = normalAt(HILLS, 6, -6);
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 5);
    expect(n.y).toBeGreaterThan(0); // terrain never overhangs
  });

  it("builds a column-major heightfield of the right size", () => {
    const hf = buildHeightfield(HILLS, 40, 60, 4);
    expect(hf.nrows).toBe(5); // segments + 1
    expect(hf.ncols).toBe(5);
    expect(hf.heights.length).toBe(25);
    expect(hf.scale.x).toBe(40);
    expect(hf.scale.z).toBe(60);
    expect(hf.scale.y).toBe(1);
  });

  it("produces an all-zero heightfield when flat", () => {
    const hf = buildHeightfield(FLAT, 40, 40, 4);
    expect([...hf.heights].every((h) => h === 0)).toBe(true);
  });
});
