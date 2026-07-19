import { describe, it, expect, beforeEach } from "vitest";
import { Economy } from "@/lib/platform/economy";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { GLOBAL_DAILY_CAP, rateFor } from "@/lib/platform/earnRates";

const DAY1 = new Date("2026-07-19T12:00:00.000Z");
const DAY2 = new Date("2026-07-20T12:00:00.000Z");

function makeEconomy(now: () => Date = () => DAY1) {
  return new Economy(new LocalStorageAdapter(), "p1", now);
}

describe("Economy balance", () => {
  beforeEach(() => localStorage.clear());

  it("starts at zero", async () => {
    expect(await makeEconomy().getBalance()).toBe(0);
  });

  it("derives balance from ledger entries", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100); // default 0.01/pt = 1 token
    await e.applyScore("pong", 100);
    expect(await e.getBalance()).toBe(2);
  });
});

describe("Economy earning", () => {
  beforeEach(() => localStorage.clear());

  it("applies the per-game rate", async () => {
    const e = makeEconomy();
    const granted = await e.applyScore("asteroids", 1000); // 0.002/pt = 2
    expect(granted).toBe(2);
  });

  it("floors fractional tokens", async () => {
    const e = makeEconomy();
    expect(await e.applyScore("pong", 50)).toBe(0); // 0.5 -> 0
  });

  it("rejects negative scores", async () => {
    const e = makeEconomy();
    expect(await e.applyScore("pong", -500)).toBe(0);
    expect(await e.getBalance()).toBe(0);
  });

  it("grants flat rewards for known events", async () => {
    const e = makeEconomy();
    expect(await e.applyEvent("lights-out", "level_cleared")).toBe(5);
  });

  it("grants nothing for unknown events", async () => {
    const e = makeEconomy();
    expect(await e.applyEvent("lights-out", "free_money")).toBe(0);
  });
});

describe("Economy caps", () => {
  beforeEach(() => localStorage.clear());

  it("enforces the per-game daily cap", async () => {
    const e = makeEconomy();
    const cap = rateFor("pong").dailyCap;
    await e.applyScore("pong", cap * 100 * 2); // far over cap
    expect(await e.earnedToday("pong")).toBe(cap);
  });

  it("clamps the final grant to the remaining cap", async () => {
    const e = makeEconomy();
    const cap = rateFor("pong").dailyCap;
    await e.applyScore("pong", (cap - 1) * 100); // cap-1 tokens
    const granted = await e.applyScore("pong", 100 * 50); // wants 50 more
    expect(granted).toBe(1);
  });

  it("enforces the global daily cap across games", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 200);
    await e.applyScore("tetris", 100 * 200);
    await e.applyScore("snake", 100 * 200);
    expect(await e.earnedToday()).toBe(GLOBAL_DAILY_CAP);
  });

  it("resets caps on a new UTC day", async () => {
    let now = DAY1;
    const e = new Economy(new LocalStorageAdapter(), "p1", () => now);
    const cap = rateFor("pong").dailyCap;
    await e.applyScore("pong", cap * 100 * 2);
    expect(await e.earnedToday("pong")).toBe(cap);
    now = DAY2;
    expect(await e.earnedToday("pong")).toBe(0);
    expect(await e.applyScore("pong", 100)).toBe(1);
  });

  it("excludes spending from earned-today", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 10); // +10
    await e.spend(5, "purchase");
    expect(await e.earnedToday()).toBe(10);
    expect(await e.getBalance()).toBe(5);
  });
});

describe("Economy spending", () => {
  beforeEach(() => localStorage.clear());

  it("rejects spending more than the balance", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 3); // +3
    expect(await e.spend(10, "purchase")).toBe(false);
    expect(await e.getBalance()).toBe(3);
  });

  it("allows an affordable purchase", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 10);
    expect(await e.spend(4, "purchase")).toBe(true);
    expect(await e.getBalance()).toBe(6);
  });

  it("rejects a negative spend", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 10);
    expect(await e.spend(-5, "purchase")).toBe(false);
    expect(await e.getBalance()).toBe(10);
  });
});
