/**
 * Sunset Highway — a wide, mostly flat straight (amplitude ~1) that runs long,
 * so nitro chains build real speed. Cool dusk grey/blue palette with a low
 * warm sun.
 */
import type { MapDef } from "./index";

export const highway: MapDef = {
  id: "highway",
  name: "Sunset Highway",
  theme: {
    background: "#3b4a63",
    fogNear: 80,
    fogFar: 220,
    groundColor: "#2b3038",
    sunColor: "#ffcf9a",
    sunIntensity: 1.6,
    ambientIntensity: 0.5,
    hemiSky: "#9fb0d0",
    hemiGround: "#2a2a30",
    hemiIntensity: 0.7,
  },
  terrain: { seed: 5, amplitude: 1, frequency: 0.02 },
  spawn: [0, 0.75, 8],
  pileZ: -84,
  trackWidth: 40,
};
