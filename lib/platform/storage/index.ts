import type { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localStorage";

export type { StorageAdapter, LedgerEntry, LedgerReason } from "./types";
export { LocalStorageAdapter } from "./localStorage";

/**
 * Browser-safe barrel. MongoAdapter lives in ./mongo and must only be imported
 * from server code (API routes / getServerEconomy) so the mongodb driver is
 * never bundled into client components.
 */
export function selectAdapter(env: {
  MONGODB_URI?: string;
  MONGODB_DB?: string;
} = {}): StorageAdapter {
  const uri = env.MONGODB_URI?.trim();
  if (uri) {
    // Dynamic require is intentionally avoided — callers that need Mongo must
    // import selectServerAdapter from ./selectServer instead.
    throw new Error(
      "Mongo selection is server-only. Use selectServerAdapter from @/lib/platform/storage/selectServer",
    );
  }
  return new LocalStorageAdapter();
}

let cached: StorageAdapter | null = null;

/**
 * Client-side game persistence. Always localStorage in the browser.
 */
export function getStorage(): StorageAdapter {
  if (cached === null) cached = new LocalStorageAdapter();
  return cached;
}

/** Test-only: reset the singleton between cases. */
export function __resetStorage(): void {
  cached = null;
}
