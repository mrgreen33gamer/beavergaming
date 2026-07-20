/**
 * Downtown — today's track, encoded as data. Flat (amplitude 0) so it stays a
 * pure refactor; the theme numbers copy the values that were hardcoded in
 * Scene.tsx (ambient 0.55, hemi #bcd8ff/#3a2e22 @0.8, sun #fff2e0 @1.8) and
 * Terrain's default groundColor (#26331f), so driving Downtown looks/feels
 * identical to before the theme migration.
 */
import type { MapDef } from "./index";

export const downtown: MapDef = {
  id: "downtown",
  name: "Downtown Demo",
  theme: {
    background: "#2a3f6b",
    fogNear: 65,
    fogFar: 175,
    groundColor: "#26331f",
    sunColor: "#fff2e0",
    sunIntensity: 1.8,
    ambientIntensity: 0.55,
    hemiSky: "#bcd8ff",
    hemiGround: "#3a2e22",
    hemiIntensity: 0.8,
  },
  terrain: { seed: 1, amplitude: 0, frequency: 0.03 },
  spawn: [0, 0.75, 8],
  pileZ: -66,
  trackWidth: 34,
};
