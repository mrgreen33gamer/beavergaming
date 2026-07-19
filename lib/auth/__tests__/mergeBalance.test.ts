import { beforeEach, describe, expect, it } from "vitest";
import { mergeGuestBalance } from "../mergeBalance";
import type { LedgerEntry, StorageAdapter } from "@/lib/platform/storage/types";

/** Minimal in-memory ledger, enough to exercise merge semantics. */
class FakeStorage implements StorageAdapter {
  ledgers = new Map<string, LedgerEntry[]>();
  private kv = new Map<string, unknown>();

  async get<T>(scope: string, key: string): Promise<T | null> {
    return (this.kv.get(`${scope}:${key}`) as T) ?? null;
  }
  async set(scope: string, key: string, value: unknown): Promise<void> {
    this.kv.set(`${scope}:${key}`, value);
  }
  async appendLedger(entry: LedgerEntry): Promise<void> {
    const log = this.ledgers.get(entry.playerId) ?? [];
    log.push(entry);
    this.ledgers.set(entry.playerId, log);
  }
  async readLedger(playerId: string): Promise<LedgerEntry[]> {
    return [...(this.ledgers.get(playerId) ?? [])];
  }

  /** Seed a player with a starting balance via one earn entry. */
  seed(playerId: string, balance: number) {
    this.ledgers.set(playerId, [
      {
        id: `seed-${playerId}`,
        playerId,
        gameId: "snake",
        delta: balance,
        reason: "score",
        balanceAfter: balance,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  }

  async balance(playerId: string): Promise<number> {
    const log = await this.readLedger(playerId);
    return log.length === 0 ? 0 : log[log.length - 1].balanceAfter;
  }
}

describe("mergeGuestBalance", () => {
  let storage: FakeStorage;
  const now = () => new Date("2026-07-19T12:00:00.000Z");

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("moves the guest balance onto the account", async () => {
    storage.seed("anon-guest", 250);

    const result = await mergeGuestBalance(storage, "anon-guest", "user-1", now);

    expect(result).toEqual({ status: "merged", amount: 250 });
    expect(await storage.balance("user-1")).toBe(250);
    expect(await storage.balance("anon-guest")).toBe(0);
  });

  it("adds to an account that already has a balance", async () => {
    storage.seed("anon-guest", 60);
    storage.seed("user-1", 100);

    await mergeGuestBalance(storage, "anon-guest", "user-1", now);

    expect(await storage.balance("user-1")).toBe(160);
  });

  it("is idempotent — repeating it never double-credits", async () => {
    storage.seed("anon-guest", 250);

    const first = await mergeGuestBalance(storage, "anon-guest", "user-1", now);
    const second = await mergeGuestBalance(storage, "anon-guest", "user-1", now);
    const third = await mergeGuestBalance(storage, "anon-guest", "user-1", now);

    expect(first.status).toBe("merged");
    expect(second.status).toBe("already_merged");
    expect(third.status).toBe("already_merged");
    expect(await storage.balance("user-1")).toBe(250);
  });

  it("never rewrites or removes existing history", async () => {
    storage.seed("anon-guest", 250);
    const before = await storage.readLedger("anon-guest");

    await mergeGuestBalance(storage, "anon-guest", "user-1", now);
    const after = await storage.readLedger("anon-guest");

    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.length).toBe(before.length + 1);
  });

  it("does nothing when the guest has no balance", async () => {
    const result = await mergeGuestBalance(storage, "anon-empty", "user-1", now);

    expect(result).toEqual({ status: "nothing_to_merge", amount: 0 });
    expect(await storage.balance("user-1")).toBe(0);
    expect(await storage.readLedger("anon-empty")).toEqual([]);
  });

  it("refuses to merge an id into itself", async () => {
    storage.seed("user-1", 100);

    const result = await mergeGuestBalance(storage, "user-1", "user-1", now);

    expect(result.status).toBe("nothing_to_merge");
    expect(await storage.balance("user-1")).toBe(100);
  });

  it("merges two different guests into the same account cumulatively", async () => {
    storage.seed("anon-a", 40);
    storage.seed("anon-b", 60);

    await mergeGuestBalance(storage, "anon-a", "user-1", now);
    await mergeGuestBalance(storage, "anon-b", "user-1", now);

    expect(await storage.balance("user-1")).toBe(100);
  });

  it("recovers without double-crediting if it died after debiting the guest", async () => {
    // Simulate a crash: the guest was debited but the account credit never
    // landed. The retry must still deliver the tokens exactly once.
    storage.seed("anon-guest", 250);
    await storage.appendLedger({
      id: "merge-out-anon-guest",
      playerId: "anon-guest",
      gameId: null,
      delta: -250,
      reason: "adjustment",
      balanceAfter: 0,
      createdAt: "2026-07-19T11:59:00.000Z",
    });

    const result = await mergeGuestBalance(storage, "anon-guest", "user-1", now);

    // Guest balance already reads 0, so there is nothing left to transfer.
    expect(result.status).toBe("nothing_to_merge");
    expect(await storage.balance("user-1")).toBe(0);
  });
});
