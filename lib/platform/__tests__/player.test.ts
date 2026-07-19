import { describe, it, expect, beforeEach } from "vitest";
import { getPlayerId } from "@/lib/platform/player";

describe("getPlayerId", () => {
  beforeEach(() => localStorage.clear());

  it("creates an id on first call", () => {
    expect(getPlayerId()).toMatch(/^anon-/);
  });

  it("returns the same id across calls", () => {
    expect(getPlayerId()).toBe(getPlayerId());
  });

  it("persists the id in localStorage", () => {
    const id = getPlayerId();
    expect(localStorage.getItem("bg:playerId")).toBe(id);
  });
});
