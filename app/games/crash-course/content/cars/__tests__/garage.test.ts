import { describe, it, expect } from "vitest";
import { getCar, STARTER_CAR_ID } from "../index";
import {
  initialGarage,
  normalizeGarage,
  isOwned,
  canAfford,
  buyable,
  addOwned,
  selectCar,
  buy,
} from "../garage";

const muscle = getCar("muscle");
const starter = getCar(STARTER_CAR_ID);

describe("garage reducer", () => {
  it("starts owning only the starter, selected", () => {
    const g = initialGarage();
    expect(g.owned).toEqual([STARTER_CAR_ID]);
    expect(g.selected).toBe(STARTER_CAR_ID);
  });

  it("normalizes persisted data: starter is always owned", () => {
    const g = normalizeGarage({ owned: ["muscle"], selected: "muscle" });
    expect(isOwned(g, STARTER_CAR_ID)).toBe(true);
    expect(isOwned(g, "muscle")).toBe(true);
    expect(g.selected).toBe("muscle");
  });

  it("normalizes: drops unknown ids and falls selection back to starter", () => {
    const g = normalizeGarage({ owned: ["ghost-car"], selected: "ghost-car" });
    expect(g.owned).toEqual([STARTER_CAR_ID]);
    expect(g.selected).toBe(STARTER_CAR_ID);
  });

  it("normalizes null/undefined to the initial garage", () => {
    expect(normalizeGarage(null)).toEqual(initialGarage());
    expect(normalizeGarage(undefined)).toEqual(initialGarage());
  });

  it("canAfford is false for the free starter and unaffordable cars", () => {
    expect(canAfford(starter, 999999)).toBe(false); // price 0 is never "bought"
    expect(canAfford(muscle, 1499)).toBe(false);
    expect(canAfford(muscle, 1500)).toBe(true);
  });

  it("buyable requires not-owned AND affordable", () => {
    const g = initialGarage();
    expect(buyable(g, muscle, 1500)).toBe(true);
    expect(buyable(g, muscle, 1000)).toBe(false);
    expect(buyable(addOwned(g, "muscle"), muscle, 999999)).toBe(false);
  });

  it("buy adds the car and reports ok when affordable", () => {
    const { state, ok } = buy(initialGarage(), muscle, 2000);
    expect(ok).toBe(true);
    expect(isOwned(state, "muscle")).toBe(true);
  });

  it("buy is a no-op when unaffordable or already owned", () => {
    const poor = buy(initialGarage(), muscle, 100);
    expect(poor.ok).toBe(false);
    expect(isOwned(poor.state, "muscle")).toBe(false);

    const owned = addOwned(initialGarage(), "muscle");
    const again = buy(owned, muscle, 999999);
    expect(again.ok).toBe(false);
    expect(again.state).toBe(owned); // unchanged reference
  });

  it("selectCar only selects an owned car", () => {
    const g = addOwned(initialGarage(), "muscle");
    expect(selectCar(g, "muscle").selected).toBe("muscle");
    expect(selectCar(g, "demolisher").selected).toBe(STARTER_CAR_ID); // not owned → unchanged
  });
});
