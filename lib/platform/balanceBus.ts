"use client";

/**
 * Notifies shell chrome (TokenBalance) when the ledger balance changes.
 * Economy writes still go only through Economy; this is a display bus.
 */

const subscribers = new Set<(balance: number) => void>();

export function notifyBalanceChanged(balance: number): void {
  for (const cb of subscribers) cb(balance);
}

/** Returns an unsubscribe function. */
export function subscribeBalance(cb: (balance: number) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
