export type LedgerReason =
  | "score"
  | "event"
  | "daily_bonus"
  | "purchase"
  | "exchange"
  | "adjustment";

/** Append-only. Never mutate or delete an entry. */
export interface LedgerEntry {
  id: string;
  playerId: string;
  gameId: string | null;
  /** Positive to earn, negative to spend. */
  delta: number;
  reason: LedgerReason;
  /** Balance after this entry applied — makes reads O(1). */
  balanceAfter: number;
  /** ISO-8601 UTC. */
  createdAt: string;
}

/**
 * All persistence goes through this interface so the backend can be swapped
 * without touching game code. Phase 1 uses localStorage; Phase 2 swaps in
 * MongoDB by setting MONGODB_URI.
 */
export interface StorageAdapter {
  get<T>(scope: string, key: string): Promise<T | null>;
  set(scope: string, key: string, value: unknown): Promise<void>;
  appendLedger(entry: LedgerEntry): Promise<void>;
  readLedger(playerId: string): Promise<LedgerEntry[]>;
}
