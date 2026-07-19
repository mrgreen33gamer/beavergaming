import { describe, it, expect } from "vitest";
import {
  CARTRIDGE_HOST_METHODS,
  FORBIDDEN_HOST_METHODS,
} from "@/lib/platform/cartridge";

describe("cartridge trust boundary", () => {
  it("exposes exactly the allowed surface", () => {
    expect([...CARTRIDGE_HOST_METHODS].sort()).toEqual([
      "loadState",
      "onPause",
      "onResume",
      "reportEvent",
      "reportScore",
      "saveState",
    ]);
  });

  it("names no currency-minting method", () => {
    for (const forbidden of FORBIDDEN_HOST_METHODS) {
      expect(CARTRIDGE_HOST_METHODS).not.toContain(forbidden);
    }
  });

  it("forbids the specific mint surface we care about", () => {
    expect(FORBIDDEN_HOST_METHODS).toContain("awardTokens");
    expect(FORBIDDEN_HOST_METHODS).toContain("setBalance");
    expect(FORBIDDEN_HOST_METHODS).toContain("appendLedger");
  });
});
