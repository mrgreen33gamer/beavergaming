import type { LedgerEntry, StorageAdapter } from "./types";

const PREFIX = "bg";

function ledgerKey(playerId: string) {
  return `${PREFIX}:ledger:${playerId}`;
}

/**
 * Phase 1 adapter. Balances are user-editable via DevTools — accepted,
 * because there is no real money and nothing to steal. The point of Phase 1
 * is that the authority boundary sits in the right place.
 */
export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(scope: string, key: string): Promise<T | null> {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(`${PREFIX}:${scope}:${key}`);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — treat as absent rather than crashing the game.
      return null;
    }
  }

  async set(scope: string, key: string, value: unknown): Promise<void> {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${PREFIX}:${scope}:${key}`, JSON.stringify(value));
  }

  async appendLedger(entry: LedgerEntry): Promise<void> {
    if (typeof window === "undefined") return;
    const log = await this.readLedger(entry.playerId);
    log.push(entry);
    localStorage.setItem(ledgerKey(entry.playerId), JSON.stringify(log));
  }

  async readLedger(playerId: string): Promise<LedgerEntry[]> {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(ledgerKey(playerId));
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as LedgerEntry[]) : [];
    } catch {
      return [];
    }
  }
}
