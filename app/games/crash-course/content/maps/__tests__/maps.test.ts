import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_ID, getMap } from "../index";

describe("map registry", () => {
  it("has the downtown default", () => {
    expect(getMap(DEFAULT_MAP_ID).id).toBe("downtown");
  });

  it("falls back to the default for an unknown id", () => {
    expect(getMap("nope").id).toBe(DEFAULT_MAP_ID);
  });

  it("downtown is flat in Phase 1 (amplitude 0 = behavior-preserving)", () => {
    expect(getMap("downtown").terrain.amplitude).toBe(0);
  });

  it("keeps today's pile and spawn coordinates", () => {
    const m = getMap("downtown");
    expect(m.pileZ).toBe(-66);
    expect(m.spawn).toEqual([0, 0.75, 8]);
    expect(m.trackWidth).toBe(34);
  });
});
