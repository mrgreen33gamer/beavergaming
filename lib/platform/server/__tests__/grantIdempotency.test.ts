import { describe, expect, it, beforeEach } from "vitest";
import { Economy } from "@/lib/platform/economy";
import { MemoryAdapter } from "../memoryAdapter";
import { earnMultiplier } from "@/lib/platform/progression";
import { GLOBAL_DAILY_CAP, rateFor } from "@/lib/platform/earnRates";

/**
 * grantForRequest itself pulls in next/headers and server-only, so these
 * exercise the two properties it depends on directly: the rank multiplier
 * must never lift a cap, and a repeated run must never be paid twice.
 *
 * The idempotency shape mirrors the real one — a kv key per (player, run).
 */
describe("rank multiplier never lifts the daily cap", () => {
  let storage: MemoryAdapter;

  beforeEach(() => {
    storage = new MemoryAdapter();
  });

  it("caps a max-rank player at exactly the same ceiling as a new one", async () => {
    const cap = rateFor("snake").dailyCap;

    const rookie = new Economy(storage, "rookie", () => new Date(), earnMultiplier(1));
    const lord = new Economy(storage, "lord", () => new Date(), earnMultiplier(1000));

    // Report far more than the cap allows, repeatedly.
    for (let i = 0; i < 12; i++) {
      await rookie.applyScore("snake", 100_000);
      await lord.applyScore("snake", 100_000);
    }

    expect(await rookie.getBalance()).toBe(cap);
    expect(await lord.getBalance()).toBe(cap);
  });

  it("lets a higher rank reach the cap sooner, but no higher", async () => {
    const rookie = new Economy(storage, "r2", () => new Date(), earnMultiplier(1));
    const lord = new Economy(storage, "l2", () => new Date(), earnMultiplier(1000));

    // One modest run, well under the cap.
    await rookie.applyScore("snake", 100);
    await lord.applyScore("snake", 100);

    const r = await rookie.getBalance();
    const l = await lord.getBalance();
    expect(l).toBeGreaterThan(r);
    expect(l).toBeLessThanOrEqual(rateFor("snake").dailyCap);
  });

  it("keeps the global cap binding across many games at max rank", async () => {
    const lord = new Economy(storage, "l3", () => new Date(), earnMultiplier(1000));
    for (const game of ["snake", "tetris", "pacman", "galaga", "frogger"]) {
      for (let i = 0; i < 6; i++) await lord.applyScore(game, 100_000);
    }
    expect(await lord.getBalance()).toBe(GLOBAL_DAILY_CAP);
  });
});

describe("run-scoped idempotency", () => {
  let storage: MemoryAdapter;

  beforeEach(() => {
    storage = new MemoryAdapter();
  });

  /** Mirrors grantForRequest's dedupe: check the key, grant, record the key. */
  async function grantOnce(playerId: string, runId: string, score: number) {
    const seen = await storage.get<boolean>("grant-run", `${playerId}:${runId}`);
    if (seen) return 0;
    const economy = new Economy(storage, playerId);
    const granted = await economy.applyScore("snake", score);
    await storage.set("grant-run", `${playerId}:${runId}`, true);
    return granted;
  }

  it("pays a run once even when the same run is reported twice", async () => {
    // This is the beacon race: the fetch reached the server but its response
    // was lost, so the unload beacon retries the identical run.
    const first = await grantOnce("p1", "run-abc", 500);
    const second = await grantOnce("p1", "run-abc", 500);

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);

    const balance = await new Economy(storage, "p1").getBalance();
    expect(balance).toBe(first);
  });

  it("still pays a genuinely new run with an identical score", async () => {
    const first = await grantOnce("p2", "run-1", 500);
    const second = await grantOnce("p2", "run-2", 500);

    expect(second).toBe(first);
    expect(await new Economy(storage, "p2").getBalance()).toBe(first + second);
  });

  it("scopes runs per player, so two players sharing an id collide never", async () => {
    const a = await grantOnce("alice", "same-run", 500);
    const b = await grantOnce("bob", "same-run", 500);

    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
  });
});
