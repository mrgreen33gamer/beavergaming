import type { LedgerEntry, StorageAdapter } from "./types";

const NOT_IMPLEMENTED = "MongoAdapter not implemented until Phase 2";

/**
 * Phase 2 placeholder. Exists so adapter selection is real from day one —
 * setting MONGODB_URI selects this and fails loudly rather than silently
 * falling back to localStorage and appearing to work.
 */
export class MongoAdapter implements StorageAdapter {
  async get<T>(_scope: string, _key: string): Promise<T | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  async set(_scope: string, _key: string, _value: unknown): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  async appendLedger(_entry: LedgerEntry): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  async readLedger(_playerId: string): Promise<LedgerEntry[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
