/**
 * Silence a small, EXACT allow-list of known-benign third-party deprecation
 * messages that the react-three ecosystem prints once at startup. These come
 * from dependencies, not our code — there is no config or clean upgrade to stop
 * them (see notes below) — so we drop the specific strings as console noise and
 * pass EVERYTHING else through untouched. Real warnings and errors still surface.
 *
 * Remove each entry the moment its upstream package stops emitting it:
 *
 *  1. "THREE.Clock: This module has been deprecated. Please use THREE.Timer
 *     instead." — `three` deprecated `Clock` in r183 (we're on r185, the ceiling
 *     `postprocessing` allows: it peer-pins `three < 0.186`). `@react-three/fiber`
 *     still instantiates `THREE.Clock` in its render loop. Gone once R3F migrates
 *     to `THREE.Timer`.
 *  2. "deprecated parameters for the initialization function; pass a single
 *     object instead" — emitted by `@dimforge/rapier3d-compat` when
 *     `@react-three/rapier` boots the physics WASM. Gone once the wrapper adopts
 *     the object-form init.
 *
 * Matching is exact-substring on these unique phrases, so nothing else is ever
 * swallowed. Client-only and installed once.
 */

const SILENCED = [
  "THREE.Clock: This module has been deprecated",
  "deprecated parameters for the initialization function",
] as const;

let installed = false;

function isSilenced(args: unknown[]): boolean {
  const first = args[0];
  return typeof first === "string" && SILENCED.some((s) => first.includes(s));
}

/**
 * Patch console.warn/log to drop the allow-listed third-party deprecation lines.
 * No-op on the server and after the first call. Idempotent and safe to import at
 * module load (the crash-course chunk only loads when a player opens the game).
 */
export function quietThirdPartyDeprecations(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  for (const method of ["warn", "log"] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      if (isSilenced(args)) return;
      original(...args);
    };
  }
}
