/**
 * Rolling Hills — gentle swells the car crests and drifts over. Moderate
 * amplitude/frequency so the ride is bouncy, never a wall. Warm midday-green
 * palette.
 */
import type { MapDef } from "./index";

export const hills: MapDef = {
  id: "hills",
  name: "Rolling Hills",
  theme: {
    background: "#8fb4d6",
    fogNear: 70,
    fogFar: 190,
    groundColor: "#3f6b2e",
    sunColor: "#fff0d0",
    sunIntensity: 2.0,
    ambientIntensity: 0.6,
    hemiSky: "#cfe8ff",
    hemiGround: "#4a3a24",
    hemiIntensity: 0.85,
  },
  terrain: { seed: 11, amplitude: 3.5, frequency: 0.045 },
  spawn: [0, 0.75, 8],
  pileZ: -66,
  trackWidth: 34,
};
