/**
 * Downtown — today's track, encoded as data. Flat (amplitude 0) so Phase 1 is a
 * pure refactor; the fog/background and coordinates mirror the current
 * index.tsx and config.ts values exactly.
 */
import type { MapDef } from "./index";

export const downtown: MapDef = {
  id: "downtown",
  name: "Downtown Demo",
  theme: { background: "#2a3f6b", fogNear: 65, fogFar: 175 },
  terrain: { seed: 1, amplitude: 0, frequency: 0.03 },
  spawn: [0, 0.75, 8],
  pileZ: -66,
  trackWidth: 34,
};
