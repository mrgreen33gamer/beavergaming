import { describe, it, expect } from "vitest";
import { CARS, STARTER_CAR_ID, getCar } from "../index";

describe("car registry", () => {
  it("has a free starter car", () => {
    const starter = getCar(STARTER_CAR_ID);
    expect(starter.id).toBe(STARTER_CAR_ID);
    expect(starter.price).toBe(0);
  });

  it("falls back to the starter for an unknown id", () => {
    expect(getCar("does-not-exist").id).toBe(STARTER_CAR_ID);
  });

  it("gives every car complete, positive stats", () => {
    for (const c of CARS) {
      const s = c.stats;
      expect(s.mass).toBeGreaterThan(0);
      expect(s.topSpeed).toBeGreaterThan(0);
      expect(s.accel).toBeGreaterThan(0);
      expect(s.grip).toBeGreaterThan(0);
      expect(s.durability).toBeGreaterThan(0);
      expect(c.price).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserves the current arcade feel on the starter", () => {
    // These mirror config.ts CAR so the Phase-1 port changes nothing.
    const s = getCar(STARTER_CAR_ID).stats;
    expect(s.topSpeed).toBe(34);
    expect(s.accel).toBe(26);
  });
});
