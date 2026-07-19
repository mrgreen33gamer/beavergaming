import { describe, it, expect } from "vitest";
import { gameLoaders } from "@/app/play/[slug]/gameRegistry";
import { games } from "@/lib/games";

describe("gameLoaders", () => {
  it("has a loader for every registered game", () => {
    const missing = games.map((g) => g.slug).filter((slug) => !(slug in gameLoaders));
    expect(missing).toEqual([]);
  });

  it("has no loader for an unregistered slug", () => {
    const slugs = new Set(games.map((g) => g.slug));
    const orphans = Object.keys(gameLoaders).filter((k) => !slugs.has(k));
    expect(orphans).toEqual([]);
  });

  it("exposes loaders as functions, not eager imports", () => {
    for (const loader of Object.values(gameLoaders)) {
      expect(typeof loader).toBe("function");
    }
  });
});
