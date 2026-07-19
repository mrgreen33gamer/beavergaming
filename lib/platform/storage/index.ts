import type { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localStorage";
import { MongoAdapter } from "./mongo";

export type { StorageAdapter, LedgerEntry, LedgerReason } from "./types";
export { LocalStorageAdapter } from "./localStorage";
export { MongoAdapter } from "./mongo";

/**
 * Phase 1 ships localStorage. Supplying MONGODB_URI in Phase 2 activates the
 * real backend with no change to game code.
 */
export function selectAdapter(env: { MONGODB_URI?: string } = {}): StorageAdapter {
  return env.MONGODB_URI ? new MongoAdapter() : new LocalStorageAdapter();
}

let cached: StorageAdapter | null = null;

/**
 * The adapter used by client-side game code.
 *
 * Phase 1 is always localStorage: MONGODB_URI is a server-only secret and must
 * never reach the browser. Phase 2 moves persistence behind an API route, and
 * `selectAdapter` runs there — on the server — where the URI is readable.
 * Keeping the seam tested now is what makes that a swap rather than a rewrite.
 */
export function getStorage(): StorageAdapter {
  if (cached === null) cached = new LocalStorageAdapter();
  return cached;
}

/** Test-only: reset the singleton between cases. */
export function __resetStorage(): void {
  cached = null;
}
