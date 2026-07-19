import type { LedgerEntry, StorageAdapter } from "./types";

const NOT_IMPLEMENTED = "MongoAdapter not implemented until Phase 2";

/**
 * Phase 2 placeholder. Exists so adapter selection is real from day one —
 * setting MONGODB_URI selects this and fails loudly rather than silently
 * falling back to localStorage and appearing to work.
 */
export class MongoAdapter implements StorageAdapter {
  async get<T>(scope: string, key: string): Promise<T | null> {
    void scope;
    void key;
    throw new Error(NOT_IMPLEMENTED);
  }
  async set(scope: string, key: string, value: unknown): Promise<void> {
    void scope;
    void key;
    void value;
    throw new Error(NOT_IMPLEMENTED);
  }
  async appendLedger(entry: LedgerEntry): Promise<void> {
    void entry;
    throw new Error(NOT_IMPLEMENTED);
  }
  async readLedger(playerId: string): Promise<LedgerEntry[]> {
    void playerId;
    throw new Error(NOT_IMPLEMENTED);
  }
}
