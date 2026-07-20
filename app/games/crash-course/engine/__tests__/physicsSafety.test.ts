import { describe, it, expect } from "vitest";
import {
  isFiniteVec, sanitizeVec, clampSpeed, isBelowKillPlane,
  KILL_PLANE_Y, MAX_SPEED,
} from "../physicsSafety";

describe("physics safety guards", () => {
  it("detects non-finite vectors", () => {
    expect(isFiniteVec({ x: 1, y: 2, z: 3 })).toBe(true);
    expect(isFiniteVec({ x: NaN, y: 0, z: 0 })).toBe(false);
    expect(isFiniteVec({ x: 0, y: Infinity, z: 0 })).toBe(false);
  });

  it("replaces a corrupt vector with the fallback, passes clean ones through", () => {
    const fb = { x: 0, y: 1, z: 0 };
    expect(sanitizeVec({ x: NaN, y: 0, z: 0 }, fb)).toEqual(fb);
    const good = { x: 5, y: 6, z: 7 };
    expect(sanitizeVec(good, fb)).toEqual(good);
  });

  it("clamps an over-speed velocity to MAX_SPEED, keeping direction", () => {
    const clamped = clampSpeed({ x: MAX_SPEED * 10, y: 0, z: 0 });
    expect(clamped.x).toBeCloseTo(MAX_SPEED);
    expect(clamped.y).toBe(0);
  });

  it("leaves an in-range velocity untouched", () => {
    const v = { x: 3, y: -2, z: 1 };
    expect(clampSpeed(v)).toEqual(v);
  });

  it("flags bodies that fall below the kill plane", () => {
    expect(isBelowKillPlane(KILL_PLANE_Y - 1)).toBe(true);
    expect(isBelowKillPlane(0)).toBe(false);
  });
});
