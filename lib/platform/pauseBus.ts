"use client";

/**
 * Global play-session pause bus. GameShell is the authority that sets pause;
 * useCartridge fans out to game-registered host.onPause / onResume callbacks.
 * Unmigrated games still get keyboard capture + overlay from GameShell.
 */

let paused = false;
const subscribers = new Set<(paused: boolean) => void>();

export function isGamePaused(): boolean {
  return paused;
}

export function setGamePaused(next: boolean): void {
  if (next === paused) return;
  paused = next;
  for (const cb of subscribers) cb(next);
}

/** Returns an unsubscribe function. */
export function subscribeGamePause(cb: (paused: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Test helper — reset module state between suites. */
export function __resetGamePause(): void {
  paused = false;
  subscribers.clear();
}
