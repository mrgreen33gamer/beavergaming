import { describe, it, expect } from "vitest";
import { anchorToTerrain, type PileItem } from "../structures";
import { heightAt, type TerrainParams } from "../engine/terrainSampler";

const FLAT: TerrainParams = { seed: 1, amplitude: 0, frequency: 0.03 };
const HILLS: TerrainParams = { seed: 11, amplitude: 4, frequency: 0.05 };

describe("anchorToTerrain", () => {
  it("leaves positions untouched on flat ground (behavior-preserving)", () => {
    const items: PileItem[] = [
      { kind: "crate", position: [3, 0.8, -20] },
      { kind: "car", position: [-4, 1.0, -60] },
    ];
    expect(anchorToTerrain(items, FLAT)).toEqual(items);
  });

  it("lifts each item by the terrain height at its (x,z)", () => {
    const items: PileItem[] = [{ kind: "box", position: [5, 1.0, -12] }];
    const out = anchorToTerrain(items, HILLS);
    expect(out[0].position[0]).toBe(5);
    expect(out[0].position[2]).toBe(-12);
    expect(out[0].position[1]).toBeCloseTo(1.0 + heightAt(HILLS, 5, -12));
  });

  it("preserves kind and drift and does not mutate the input", () => {
    const items: PileItem[] = [{ kind: "car", position: [0, 1, -66], drift: [2, 0] }];
    const out = anchorToTerrain(items, HILLS);
    expect(out[0].kind).toBe("car");
    expect(out[0].drift).toEqual([2, 0]);
    expect(items[0].position[1]).toBe(1); // input untouched
  });
});
