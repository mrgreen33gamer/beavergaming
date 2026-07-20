import { describe, it, expect } from "vitest";
import { CAR, IMPACT } from "../../../config";
import { getCar, STARTER_CAR_ID } from "../index";
import { carHandling } from "../handling";

describe("carHandling", () => {
  it("is behavior-preserving for the starter (equals config.CAR)", () => {
    const h = carHandling(getCar(STARTER_CAR_ID));
    expect(h.topSpeed).toBe(CAR.topSpeed); // 34
    expect(h.accel).toBe(CAR.accel); // 26
    expect(h.steerRate).toBe(CAR.steerRate); // grip 1 → unchanged
    expect(h.density).toBe(CAR.density); // mass 1 → unchanged
    expect(h.damageForce).toBe(IMPACT.carDamageForce); // durability ratio 1
  });

  it("scales steering by grip and density by mass", () => {
    const monster = getCar("monster-truck");
    const h = carHandling(monster);
    expect(h.steerRate).toBeCloseTo(CAR.steerRate * monster.stats.grip);
    expect(h.density).toBeCloseTo(CAR.density * monster.stats.mass);
  });

  it("raises the car-damage threshold with durability (tougher = harder to dent)", () => {
    const starterDur = getCar(STARTER_CAR_ID).stats.durability;
    const demolisher = getCar("demolisher");
    const h = carHandling(demolisher);
    expect(h.damageForce).toBeCloseTo(
      IMPACT.carDamageForce * (demolisher.stats.durability / starterDur),
    );
    expect(h.damageForce).toBeGreaterThan(IMPACT.carDamageForce);
  });

  it("passes topSpeed and accel straight through", () => {
    const muscle = getCar("muscle");
    const h = carHandling(muscle);
    expect(h.topSpeed).toBe(muscle.stats.topSpeed);
    expect(h.accel).toBe(muscle.stats.accel);
  });
});
