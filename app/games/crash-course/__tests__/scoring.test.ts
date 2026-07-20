import { describe, it, expect } from "vitest";
import {
  PROP_VALUES,
  COMBO_WINDOW_MS,
  COMBO_MAX,
  initialScore,
  registerDestruction,
  comboShake,
  initialNitrous,
  spendNitrous,
  nitrousActive,
  initialDamage,
  applyDamage,
  squashScale,
  DAMAGE_PANELS,
  PANEL_DEFORM_BUDGET,
  accrueDeform,
} from "../scoring";

describe("scoring — weighted destruction + combo", () => {
  it("first hit scores base value at x1", () => {
    const s = registerDestruction(initialScore(), "barrel", 1000);
    expect(s.total).toBe(PROP_VALUES.barrel);
    expect(s.multiplier).toBe(1);
    expect(s.destroyed).toBe(1);
  });

  it("chains the multiplier for hits inside the window", () => {
    let s = initialScore();
    s = registerDestruction(s, "crate", 0); // x1 -> +10
    s = registerDestruction(s, "crate", 400); // x2 -> +20
    s = registerDestruction(s, "crate", 800); // x3 -> +30
    expect(s.multiplier).toBe(3);
    expect(s.total).toBe(10 + 20 + 30);
    expect(s.bestMultiplier).toBe(3);
    expect(s.destroyed).toBe(3);
  });

  it("resets the combo once the window lapses", () => {
    let s = initialScore();
    s = registerDestruction(s, "crate", 0); // x1
    s = registerDestruction(s, "crate", 400); // x2 (inside 900ms)
    s = registerDestruction(s, "crate", 1400); // gap 1000 > 900ms -> x1
    expect(s.multiplier).toBe(1);
    expect(s.bestMultiplier).toBe(2);
  });

  it("treats a hit exactly on the window edge as chained", () => {
    let s = initialScore();
    s = registerDestruction(s, "crate", 0);
    s = registerDestruction(s, "crate", COMBO_WINDOW_MS);
    expect(s.multiplier).toBe(2);
  });

  it("caps the multiplier at COMBO_MAX no matter how long the chain", () => {
    let s = initialScore();
    for (let i = 0; i < COMBO_MAX + 5; i++) s = registerDestruction(s, "crate", i * 100);
    expect(s.multiplier).toBe(COMBO_MAX);
    expect(s.bestMultiplier).toBe(COMBO_MAX);
  });

  it("chains within the wider 900ms window", () => {
    let s = initialScore();
    s = registerDestruction(s, "crate", 0);
    s = registerDestruction(s, "crate", 850); // was a reset under 500ms, now chains
    expect(s.multiplier).toBe(2);
  });

  it("weights different props by their value, multiplier included", () => {
    let s = initialScore();
    s = registerDestruction(s, "car", 0); // x1 -> 300
    s = registerDestruction(s, "gold", 200); // x2 -> 400
    expect(s.total).toBe(300 + 400);
  });

  it("does not mutate the input state", () => {
    const s0 = initialScore();
    registerDestruction(s0, "gold", 100);
    expect(s0.total).toBe(0);
    expect(s0.destroyed).toBe(0);
  });

  it("scores the new light props below the heavy ones", () => {
    expect(PROP_VALUES.cone).toBe(15);
    expect(PROP_VALUES.cone).toBeLessThan(PROP_VALUES.barrel);
    expect(PROP_VALUES.signpost).toBeGreaterThan(PROP_VALUES.cone);
  });
});

describe("nitrous accounting", () => {
  it("spends a charge and activates a boost", () => {
    const n = spendNitrous(initialNitrous(3), 1000, 2000);
    expect(n.charges).toBe(2);
    expect(nitrousActive(n, 1500)).toBe(true);
    expect(nitrousActive(n, 3000)).toBe(false);
  });

  it("cannot spend while a boost is already active", () => {
    const n1 = spendNitrous(initialNitrous(3), 1000, 2000);
    const n2 = spendNitrous(n1, 1500, 2000);
    expect(n2).toBe(n1); // identity: nothing happened
    expect(n2.charges).toBe(2);
  });

  it("can spend again once the boost expires", () => {
    let n = spendNitrous(initialNitrous(3), 1000, 2000);
    n = spendNitrous(n, 3100, 2000);
    expect(n.charges).toBe(1);
  });

  it("refuses to spend with no charges left", () => {
    const empty = initialNitrous(0);
    expect(spendNitrous(empty, 0, 2000)).toBe(empty);
  });
});

describe("car damage", () => {
  it("detaches panels in order on successive hits", () => {
    let d = initialDamage();
    const r1 = applyDamage(d, 0, 250);
    expect(r1.detached).toBe(DAMAGE_PANELS[0]);
    expect(r1.applied).toBe(true);
    d = r1.state;
    const r2 = applyDamage(d, 500, 250);
    expect(r2.detached).toBe(DAMAGE_PANELS[1]);
    expect(r2.state.hits).toBe(2);
  });

  it("respects the cooldown between hits", () => {
    const d = applyDamage(initialDamage(), 0, 250).state;
    const blocked = applyDamage(d, 100, 250); // inside cooldown
    expect(blocked.applied).toBe(false);
    expect(blocked.detached).toBe(null);
    expect(blocked.state).toBe(d);
  });

  it("keeps registering hits after every panel is gone", () => {
    let d = initialDamage();
    let t = 0;
    for (let i = 0; i < DAMAGE_PANELS.length + 2; i++) {
      d = applyDamage(d, t, 250).state;
      t += 300;
    }
    expect(d.attached.length).toBe(0);
    expect(d.hits).toBe(DAMAGE_PANELS.length + 2);
  });

  it("squashes the chassis but never inverts it", () => {
    expect(squashScale(0)).toBe(1);
    expect(squashScale(1)).toBeCloseTo(0.88);
    expect(squashScale(100)).toBeGreaterThanOrEqual(0.45);
  });
});

describe("comboShake", () => {
  it("starts modest at x1 and escalates with the multiplier", () => {
    expect(comboShake(1)).toBeCloseTo(0.25);
    expect(comboShake(5)).toBeGreaterThan(comboShake(1));
  });
  it("never exceeds 1", () => {
    expect(comboShake(COMBO_MAX)).toBeLessThanOrEqual(1);
    expect(comboShake(999)).toBe(1);
  });
});

describe("accrueDeform — plastic deformation budget", () => {
  it("applies the full amount when there is room", () => {
    const r = accrueDeform(0, 0.5, PANEL_DEFORM_BUDGET);
    expect(r.applied).toBeCloseTo(0.5);
    expect(r.used).toBeCloseTo(0.5);
  });

  it("clamps so used never exceeds the budget", () => {
    const r = accrueDeform(PANEL_DEFORM_BUDGET - 0.1, 0.5, PANEL_DEFORM_BUDGET);
    expect(r.used).toBeCloseTo(PANEL_DEFORM_BUDGET);
    expect(r.applied).toBeCloseTo(0.1);
  });

  it("applies nothing once the budget is spent", () => {
    const r = accrueDeform(PANEL_DEFORM_BUDGET, 0.5, PANEL_DEFORM_BUDGET);
    expect(r.applied).toBe(0);
    expect(r.used).toBe(PANEL_DEFORM_BUDGET);
  });

  it("ignores negative amounts", () => {
    const r = accrueDeform(1, -0.3, PANEL_DEFORM_BUDGET);
    expect(r.applied).toBe(0);
    expect(r.used).toBe(1);
  });
});
