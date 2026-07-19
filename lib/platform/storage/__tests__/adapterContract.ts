import { describe, it, expect, beforeEach } from "vitest";
import type { StorageAdapter, LedgerEntry } from "@/lib/platform/storage/types";

function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "e1",
    playerId: "p1",
    gameId: "asteroids",
    delta: 10,
    reason: "score",
    balanceAfter: 10,
    createdAt: "2026-07-19T10:00:00.000Z",
    ...over,
  };
}

/** Shared behaviour every StorageAdapter must satisfy. */
export function runAdapterContractTests(name: string, make: () => StorageAdapter) {
  describe(`${name} — StorageAdapter contract`, () => {
    let adapter: StorageAdapter;
    beforeEach(() => {
      adapter = make();
    });

    it("returns null for a missing key", async () => {
      expect(await adapter.get("save", "nope")).toBeNull();
    });

    it("round-trips a value", async () => {
      await adapter.set("save", "k", { a: 1 });
      expect(await adapter.get<{ a: number }>("save", "k")).toEqual({ a: 1 });
    });

    it("isolates scopes", async () => {
      await adapter.set("save", "k", "one");
      await adapter.set("other", "k", "two");
      expect(await adapter.get("save", "k")).toBe("one");
      expect(await adapter.get("other", "k")).toBe("two");
    });

    it("starts with an empty ledger", async () => {
      expect(await adapter.readLedger("p1")).toEqual([]);
    });

    it("appends ledger entries in order", async () => {
      await adapter.appendLedger(entry({ id: "e1" }));
      await adapter.appendLedger(entry({ id: "e2", delta: 5, balanceAfter: 15 }));
      const log = await adapter.readLedger("p1");
      expect(log.map((e) => e.id)).toEqual(["e1", "e2"]);
    });

    it("separates ledgers by player", async () => {
      await adapter.appendLedger(entry({ id: "a", playerId: "p1" }));
      await adapter.appendLedger(entry({ id: "b", playerId: "p2" }));
      expect(await adapter.readLedger("p1")).toHaveLength(1);
      expect(await adapter.readLedger("p2")).toHaveLength(1);
    });
  });
}
