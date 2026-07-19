"use client";

/**
 * Freezes requestAnimationFrame-driven games while the shell pause bus is set.
 * Unmigrated games never register host.onPause — this still stops their loops
 * so they do not simulate or redraw under the pause overlay.
 */

import { isGamePaused, subscribeGamePause } from "./pauseBus";

const FAKE_ID_BASE = 1_000_000_000;

let installed = false;
let nextFakeId = FAKE_ID_BASE;
const deferred = new Map<
  number,
  { cb: FrameRequestCallback; unsub: () => void }
>();

export function installPauseFreeze(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const origRAF = window.requestAnimationFrame.bind(window);
  const origCAF = window.cancelAnimationFrame.bind(window);

  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    if (!isGamePaused()) {
      return origRAF(cb);
    }

    const id = nextFakeId++;
    const unsub = subscribeGamePause((paused) => {
      if (paused) return;
      unsub();
      deferred.delete(id);
      origRAF(cb);
    });
    deferred.set(id, { cb, unsub });
    return id;
  };

  window.cancelAnimationFrame = (id: number): void => {
    if (id >= FAKE_ID_BASE) {
      const entry = deferred.get(id);
      if (entry) {
        entry.unsub();
        deferred.delete(id);
      }
      return;
    }
    origCAF(id);
  };
}

/** Test helper */
export function __resetPauseFreezeForTests(): void {
  for (const entry of deferred.values()) entry.unsub();
  deferred.clear();
  // leave installed as-is; tests run in one jsdom lifecycle
}
