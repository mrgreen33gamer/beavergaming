import { describe, it, expect, beforeEach } from "vitest";
import { SaveApi } from "@/lib/platform/save";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";

function makeSave() {
  return new SaveApi(new LocalStorageAdapter());
}

describe("SaveApi high scores", () => {
  beforeEach(() => localStorage.clear());

  it("returns 0 for a game with no score", async () => {
    expect(await makeSave().getHighScore("pong")).toBe(0);
  });

  it("stores and reads a high score", async () => {
    const s = makeSave();
    await s.setHighScore("pong", 500);
    expect(await s.getHighScore("pong")).toBe(500);
  });

  it("reports true only on a new record", async () => {
    const s = makeSave();
    expect(await s.setHighScore("pong", 500)).toBe(true);
    expect(await s.setHighScore("pong", 400)).toBe(false);
    expect(await s.setHighScore("pong", 900)).toBe(true);
  });

  it("keeps the higher score when a lower one is submitted", async () => {
    const s = makeSave();
    await s.setHighScore("pong", 500);
    await s.setHighScore("pong", 100);
    expect(await s.getHighScore("pong")).toBe(500);
  });
});

describe("SaveApi legacy migration", () => {
  beforeEach(() => localStorage.clear());

  it("reads a pre-existing legacy high score", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    expect(await makeSave().getHighScore("asteroids")).toBe(4200);
  });

  it("reads the differently-named lights-out legacy key", async () => {
    localStorage.setItem("lightsout-best", "7");
    expect(await makeSave().getHighScore("lights-out")).toBe(7);
  });

  it("prefers the platform score once it exceeds the legacy one", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    const s = makeSave();
    await s.setHighScore("asteroids", 5000);
    expect(await s.getHighScore("asteroids")).toBe(5000);
  });

  it("ignores a corrupt legacy value", async () => {
    localStorage.setItem("asteroids-highscore", "not-a-number");
    expect(await makeSave().getHighScore("asteroids")).toBe(0);
  });
});

describe("SaveApi state", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips arbitrary state", async () => {
    const s = makeSave();
    await s.setState("tetris", "settings", { ghost: true });
    expect(await s.getState<{ ghost: boolean }>("tetris", "settings")).toEqual({ ghost: true });
  });

  it("scopes state per game", async () => {
    const s = makeSave();
    await s.setState("tetris", "k", 1);
    await s.setState("pong", "k", 2);
    expect(await s.getState("tetris", "k")).toBe(1);
  });
});
