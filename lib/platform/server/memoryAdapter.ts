import type { LedgerEntry, StorageAdapter } from "@/lib/platform/storage/types";

/**
 * Process-local storage for the Phase 1 server economy path when Mongo is not
 * configured. Survives across requests in a single Node process; multi-instance
 * deploys need MONGODB_URI (Phase 2) for shared ledgers.
 */
const store = new Map<string, string>();
const ledgers = new Map<string, LedgerEntry[]>();

export class MemoryAdapter implements StorageAdapter {
  async get<T>(scope: string, key: string): Promise<T | null> {
    const raw = store.get(`${scope}:${key}`);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(scope: string, key: string, value: unknown): Promise<void> {
    store.set(`${scope}:${key}`, JSON.stringify(value));
  }

  async appendLedger(entry: LedgerEntry): Promise<void> {
    const log = ledgers.get(entry.playerId) ?? [];
    log.push(entry);
    ledgers.set(entry.playerId, log);
  }

  async readLedger(playerId: string): Promise<LedgerEntry[]> {
    return [...(ledgers.get(playerId) ?? [])];
  }
}

/** Test helper */
export function __resetMemoryAdapter(): void {
  store.clear();
  ledgers.clear();
}
