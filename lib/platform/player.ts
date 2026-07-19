const KEY = "bg:playerId";

/**
 * Phase 1 identity: a device-local anonymous id. Phase 2 replaces this with
 * the authenticated account id; the ledger is keyed by whatever this returns,
 * so the migration is a matter of mapping anon -> account once at sign-up.
 */
export function getPlayerId(): string {
  if (typeof window === "undefined") return "anon-ssr";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = `anon-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(KEY, id);
  return id;
}
