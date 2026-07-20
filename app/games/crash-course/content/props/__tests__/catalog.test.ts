import { describe, it, expect } from "vitest";
import { PROP_CATALOG, propDef } from "../catalog";
import { PROP_VALUES, type PropKind } from "../../../scoring";

const KINDS: PropKind[] = ["crate", "box", "barrel", "gold", "car"];

describe("prop catalog", () => {
  it("has an entry for every PropKind", () => {
    for (const k of KINDS) expect(PROP_CATALOG[k]).toBeDefined();
  });

  it("re-uses scoring PROP_VALUES verbatim (no divergent copy)", () => {
    for (const k of KINDS) expect(PROP_CATALOG[k].value).toBe(PROP_VALUES[k]);
  });

  it("gives every prop a positive size and mass", () => {
    for (const k of KINDS) {
      const d = propDef(k);
      expect(d.size.every((n) => n > 0)).toBe(true);
      expect(d.mass).toBeGreaterThan(0);
    }
  });

  it("makes cars far heavier than crates (momentum matters)", () => {
    expect(propDef("car").mass).toBeGreaterThan(propDef("crate").mass * 5);
  });
});
