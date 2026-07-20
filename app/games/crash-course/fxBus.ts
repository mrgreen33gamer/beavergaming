/**
 * A tiny module-level bus for impact effects.
 *
 * The car and the destructibles both need to spawn sparks/dust and shake the
 * camera on a hit, but React context does not cross the R3F <Canvas> render
 * boundary. A plain singleton sidesteps that: the Effects manager registers a
 * `spawn` handler, everyone else just calls `triggerImpact`.
 *
 * State here is purely transient FX (never gameplay), so it does not matter
 * that it outlives a per-run remount — `reset()` clears it at the start of a
 * run anyway.
 */
export interface FxBus {
  /** Set by the Effects manager while it is mounted. */
  spawn: ((x: number, y: number, z: number, strength: number) => void) | null;
  /** Current camera-shake amount (0..1), decayed by the camera each frame. */
  shake: number;
  triggerImpact(x: number, y: number, z: number, strength: number): void;
  addShake(amount: number): void;
  reset(): void;
}

export const fxBus: FxBus = {
  spawn: null,
  shake: 0,
  triggerImpact(x, y, z, strength) {
    const s = Math.max(0, Math.min(1, strength));
    this.spawn?.(x, y, z, s);
    this.addShake(s * 0.6);
  },
  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  },
  reset() {
    this.shake = 0;
  },
};
