"use client";

/**
 * Notifies shell chrome when the platform responds to a report.
 *
 * This exists because games call useCartridge themselves — GameShell wraps
 * every game but never holds a CartridgeHost, so it has no other way to know
 * an award happened. Like balanceBus, this is display-only: nothing here can
 * grant, and the amount has already been decided and capped server-side by
 * the time it is published.
 */

export interface Award {
  /** Tokens actually granted — already clamped by rates and daily caps. */
  granted: number;
  gameId: string;
  /** Balance after the grant, for chrome that wants to stay in step. */
  balance: number;
  signedIn: boolean;
  /** Why nothing was granted, when that is worth explaining. */
  reason?: "account_required";
  /** Set only on the report that crossed a level boundary. */
  leveledUpTo?: number;
  rank?: string;
}

const subscribers = new Set<(award: Award) => void>();

export function notifyAward(award: Award): void {
  // A zero grant is still worth publishing: it is how the HUD explains that a
  // run earned nothing, whether from a daily cap or from playing as a guest.
  for (const cb of subscribers) cb(award);
}

/** Returns an unsubscribe function. */
export function subscribeAward(cb: (award: Award) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
