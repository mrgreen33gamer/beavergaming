/**
 * Automated stand-in for the manual "play pilot → earn → reload" smoke path.
 * Exercises the same platform surfaces a browser session would hit.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Economy } from "@/lib/platform/economy";
import { SaveApi } from "@/lib/platform/save";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { getPlayerId } from "@/lib/platform/player";
import { getStorage, __resetStorage } from "@/lib/platform/storage";

describe("pilot earn → persist → reload", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStorage();
  });

  it("asteroids: reportScore awards tokens and keeps high score across reload", async () => {
    const playerId = getPlayerId();
    const storage = getStorage();
    const economy = new Economy(storage, playerId);
    const save = new SaveApi(storage);

    await save.setHighScore("asteroids", 1500);
    const granted = await economy.applyScore("asteroids", 1500);
    expect(granted).toBeGreaterThan(0);
    const balance = await economy.getBalance();
    expect(balance).toBe(granted);

    // "Reload" — new adapter/economy instances, same localStorage.
    const storage2 = new LocalStorageAdapter();
    const economy2 = new Economy(storage2, playerId);
    const save2 = new SaveApi(storage2);
    expect(await save2.getHighScore("asteroids")).toBe(1500);
    expect(await economy2.getBalance()).toBe(balance);
  });

  it("lights-out: level_cleared event awards tokens and progression score persists", async () => {
    const playerId = getPlayerId();
    const storage = getStorage();
    const economy = new Economy(storage, playerId);
    const save = new SaveApi(storage);

    const eventGrant = await economy.applyEvent("lights-out", "level_cleared");
    expect(eventGrant).toBe(5);
    await save.setHighScore("lights-out", 4); // next level high-water

    const storage2 = new LocalStorageAdapter();
    const economy2 = new Economy(storage2, playerId);
    const save2 = new SaveApi(storage2);
    expect(await save2.getHighScore("lights-out")).toBe(4);
    expect(await economy2.getBalance()).toBe(5);
  });

  it("pong: match_won awards tokens that survive reload", async () => {
    const playerId = getPlayerId();
    const storage = getStorage();
    const economy = new Economy(storage, playerId);

    const granted = await economy.applyEvent("pong", "match_won");
    expect(granted).toBe(10);

    const economy2 = new Economy(new LocalStorageAdapter(), playerId);
    expect(await economy2.getBalance()).toBe(10);
  });

  it("legacy asteroids high score still hydrates after earn", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    const save = new SaveApi(getStorage());
    expect(await save.getHighScore("asteroids")).toBe(4200);
    await save.setHighScore("asteroids", 5000);
    // Legacy key left in place (never orphaned).
    expect(localStorage.getItem("asteroids-highscore")).toBe("4200");
    expect(await save.getHighScore("asteroids")).toBe(5000);
  });
});
