import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_ID, getMap, MAPS } from "../index";

describe("map registry", () => {
  it("has the downtown default", () => {
    expect(getMap(DEFAULT_MAP_ID).id).toBe("downtown");
  });

  it("falls back to the default for an unknown id", () => {
    expect(getMap("nope").id).toBe(DEFAULT_MAP_ID);
  });

  it("ships all four maps in registry order with unique ids", () => {
    const ids = MAPS.map((m) => m.id);
    expect(ids).toEqual(["downtown", "hills", "highway", "canyon"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every map by its own id", () => {
    for (const m of MAPS) {
      expect(getMap(m.id).id).toBe(m.id);
    }
  });

  it("keeps downtown flat + today's coordinates (behavior-preserving)", () => {
    const m = getMap("downtown");
    expect(m.terrain.amplitude).toBe(0);
    expect(m.pileZ).toBe(-66);
    expect(m.spawn).toEqual([0, 0.75, 8]);
    expect(m.trackWidth).toBe(34);
  });

  it("keeps downtown's theme equal to today's hardcoded scene values", () => {
    const t = getMap("downtown").theme;
    expect(t.background).toBe("#2a3f6b");
    expect(t.fogNear).toBe(65);
    expect(t.fogFar).toBe(175);
    expect(t.groundColor).toBe("#26331f"); // Terrain's old default color
    expect(t.ambientIntensity).toBe(0.55);
    expect(t.sunColor).toBe("#fff2e0");
    expect(t.sunIntensity).toBe(1.8);
    expect(t.hemiSky).toBe("#bcd8ff");
    expect(t.hemiGround).toBe("#3a2e22");
    expect(t.hemiIntensity).toBe(0.8);
  });

  it("every map carries a complete theme + terrain + layout", () => {
    for (const m of MAPS) {
      expect(m.name.length).toBeGreaterThan(0);
      for (const hex of [
        m.theme.background,
        m.theme.groundColor,
        m.theme.sunColor,
        m.theme.hemiSky,
        m.theme.hemiGround,
      ]) {
        expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      expect(m.theme.fogFar).toBeGreaterThan(m.theme.fogNear);
      expect(m.theme.ambientIntensity).toBeGreaterThan(0);
      expect(m.theme.sunIntensity).toBeGreaterThan(0);
      expect(m.theme.hemiIntensity).toBeGreaterThan(0);
      expect(m.terrain.amplitude).toBeGreaterThanOrEqual(0);
      expect(m.terrain.frequency).toBeGreaterThan(0);
      expect(m.trackWidth).toBeGreaterThan(0);
      expect(m.pileZ).toBeLessThan(0);
    }
  });

  it("gives the three new maps distinct, non-flat terrain", () => {
    const others = ["hills", "highway", "canyon"];
    for (const id of others) {
      expect(getMap(id).terrain.amplitude).toBeGreaterThan(0);
    }
    const amps = others.map((id) => getMap(id).terrain.amplitude);
    expect(new Set(amps).size).toBe(3); // no two are copies
  });

  it("makes canyon narrower + rougher than the highway straight", () => {
    const canyon = getMap("canyon");
    const highway = getMap("highway");
    expect(canyon.trackWidth).toBeLessThan(highway.trackWidth);
    expect(canyon.terrain.amplitude).toBeGreaterThan(highway.terrain.amplitude);
    expect(highway.trackWidth).toBeGreaterThanOrEqual(getMap("downtown").trackWidth);
  });
});
