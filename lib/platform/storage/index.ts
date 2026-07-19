import type { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localStorage";
import { MongoAdapter } from "./mongo";

export type { StorageAdapter, LedgerEntry, LedgerReason } from "./types";
export { LocalStorageAdapter } from "./localStorage";
export { MongoAdapter } from "./mongo";

/**
 * Select the persistence backend.
 * - No URI → LocalStorageAdapter (browser / offline)
 * - URI set → MongoAdapter (server API only)
 */
export function selectAdapter(env: {
  MONGODB_URI?: string;
  MONGODB_DB?: string;
} = {}): StorageAdapter {
  const uri = env.MONGODB_URI?.trim();
  if (uri) {
    return new MongoAdapter(uri, env.MONGODB_DB);
  }
  return new LocalStorageAdapter();
}

let cached: StorageAdapter | null = null;

/**
 * The adapter used by client-side game code.
 *
 * Always localStorage in the browser: MONGODB_URI is a server-only secret and
 * must never reach the client bundle. Server economy routes call
 * selectAdapter({ MONGODB_URI }) directly.
 */
export function getStorage(): StorageAdapter {
  if (cached === null) cached = new LocalStorageAdapter();
  return cached;
}

/** Test-only: reset the singleton between cases. */
export function __resetStorage(): void {
  cached = null;
}
