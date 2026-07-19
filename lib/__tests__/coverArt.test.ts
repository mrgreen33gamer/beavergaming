import { describe, expect, it } from "vitest";
import { COVER_PATTERNS, coverFor, hashString, patternFor, patternMarkup } from "../coverArt";
import { games } from "../games";

describe("cover art generation", () => {
  it("is deterministic — the same slug always yields the same cover", () => {
    // Stability matters beyond neatness: server and client must agree or
    // React reports a hydration mismatch.
    for (const slug of ["snake", "pacman", "dam-rush"]) {
      expect(coverFor(slug)).toEqual(coverFor(slug));
      expect(patternMarkup(patternFor(slug), hashString(slug))).toBe(
        patternMarkup(patternFor(slug), hashString(slug)),
      );
    }
  });

  it("assigns a known pattern to every real game", () => {
    for (const g of games) {
      expect(COVER_PATTERNS).toContain(patternFor(g.slug));
    }
  });

  it("spreads games across patterns rather than piling onto one", () => {
    const counts = new Map<string, number>();
    for (const g of games) {
      const p = patternFor(g.slug);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    // With 43 games over 8 patterns, a healthy spread uses most of them and
    // no single pattern dominates the library.
    expect(counts.size).toBeGreaterThanOrEqual(6);
    expect(Math.max(...counts.values())).toBeLessThan(games.length / 2);
  });

  it("produces non-trivial svg markup for every pattern", () => {
    for (const pattern of COVER_PATTERNS) {
      const markup = patternMarkup(pattern, 12345);
      expect(markup.length).toBeGreaterThan(80);
      expect(markup).toMatch(/<(line|rect|circle|path|polyline)/);
    }
  });

  it("emits no script or event handlers, since markup is injected as html", () => {
    for (const pattern of COVER_PATTERNS) {
      const markup = patternMarkup(pattern, 999);
      expect(markup).not.toMatch(/<script/i);
      expect(markup).not.toMatch(/\son\w+=/i);
    }
  });

  it("keeps generated coordinates finite and bounded", () => {
    for (const pattern of COVER_PATTERNS) {
      const markup = patternMarkup(pattern, 4242);
      const numbers = markup.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(numbers.every(Number.isFinite)).toBe(true);
      expect(markup).not.toContain("NaN");
      expect(markup).not.toContain("Infinity");
    }
  });

  it("hashes distinctly for distinct slugs", () => {
    const hashes = new Set(games.map((g) => hashString(g.slug)));
    expect(hashes.size).toBe(games.length);
  });
});
