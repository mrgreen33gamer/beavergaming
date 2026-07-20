/**
 * A tiny module-level bus for impact effects.
 *
 * The car and the destructibles both need to spawn sparks/dust and shake the
 * camera on a hit, but React context does not cross the R3F <Canvas> render
 * boundary. A plain singleton sidesteps that: the Effects manager registers a
 * `spawn` handler, everyone else just calls `triggerImpact`.
 *
 * A hard global throttle on particle spawns means that even if dozens of
 * bodies are grinding against each other, sparks are emitted at a bounded
 * rate — shake still registers, but the particle pool can never run away.
 */

/** Minimum ms between particle bursts, regardless of how many bodies hit. */
const SPAWN_INTERVAL_MS = 40;

export interface FxBus {
  spawn: ((x: number, y: number, z: number, strength: number) => void) | null;
  shake: number;
  lastSpawn: number;
  triggerImpact(x: number, y: number, z: number, strength: number): void;
  addShake(amount: number): void;
  reset(): void;
}

export const fxBus: FxBus = {
  spawn: null,
  shake: 0,
  lastSpawn: 0,
  triggerImpact(x, y, z, strength) {
    const s = Math.max(0, Math.min(1, strength));
    this.addShake(s * 0.6);
    const now = performance.now();
    if (now - this.lastSpawn < SPAWN_INTERVAL_MS) return; // throttled — shake only
    this.lastSpawn = now;
    this.spawn?.(x, y, z, s);
  },
  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  },
  reset() {
    this.shake = 0;
    this.lastSpawn = 0;
  },
};
