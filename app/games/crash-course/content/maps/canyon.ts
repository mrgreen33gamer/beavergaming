/**
 * Red Canyon — tall, rough rock (amplitude ~7) squeezed into a narrow run.
 * Big crests launch the car; the tight width makes lining up the pile hard.
 * Hot orange/red desert palette.
 */
import type { MapDef } from "./index";

export const canyon: MapDef = {
  id: "canyon",
  name: "Red Canyon",
  theme: {
    background: "#c46a3a",
    fogNear: 55,
    fogFar: 160,
    groundColor: "#8a3f22",
    sunColor: "#ffd9a0",
    sunIntensity: 2.1,
    ambientIntensity: 0.5,
    hemiSky: "#e8a86a",
    hemiGround: "#4a1f12",
    hemiIntensity: 0.75,
  },
  terrain: { seed: 23, amplitude: 7, frequency: 0.06 },
  spawn: [0, 0.75, 8],
  pileZ: -60,
  trackWidth: 26,
};
