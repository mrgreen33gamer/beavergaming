import "server-only";

import type { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localStorage";
import { MongoAdapter } from "./mongo";

/**
 * Server-only adapter selection. Safe to import from API routes and
 * getServerEconomy — never from "use client" modules.
 */
export function selectServerAdapter(env: {
  MONGODB_URI?: string;
  MONGODB_DB?: string;
} = {}): StorageAdapter {
  const uri = env.MONGODB_URI?.trim();
  if (uri) {
    return new MongoAdapter(uri, env.MONGODB_DB);
  }
  return new LocalStorageAdapter();
}
