/**
 * Map registry — each map is a data file. Phase 1 ships only Downtown (flat,
 * matching today's track); terrain amplitude 0 means the heightfield lands in
 * Phase 2 without touching this shape. Pure: no React, no Three.
 */
import { downtown } from "./downtown";

export interface MapTheme {
  background: string;
  fogNear: number;
  fogFar: number;
}

export interface TerrainParams {
  seed: number;
  /** Peak hill height in metres. 0 = flat ground (Phase 1). */
  amplitude: number;
  /** Spatial frequency of the hills. */
  frequency: number;
}

export interface MapDef {
  id: string;
  name: string;
  theme: MapTheme;
  terrain: TerrainParams;
  spawn: [number, number, number];
  pileZ: number;
  trackWidth: number;
}

export const MAPS: MapDef[] = [downtown];

export const DEFAULT_MAP_ID = "downtown";

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS.find((m) => m.id === DEFAULT_MAP_ID)!;
}
