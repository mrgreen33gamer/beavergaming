import { describe, it, expect } from "vitest";
import { gameLoaders } from "@/app/play/[slug]/gameRegistry";
import { games } from "@/lib/games";

describe("every game chunk resolves", () => {
  for (const game of games) {
    it(`loads ${game.slug}`, async () => {
      const mod = await gameLoaders[game.slug]();
      expect(typeof mod.default).toBe("function");
    });
  }
});
