import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("runs tests", () => {
    expect(true).toBe(true);
  });

  it("provides a jsdom localStorage", () => {
    localStorage.setItem("k", "v");
    expect(localStorage.getItem("k")).toBe("v");
  });
});
