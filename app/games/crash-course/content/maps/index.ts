/**
 * Map registry — each map is a data file. Phase 1 ships only Downtown (flat,
 * matching today's track); terrain amplitude 0 means the heightfield lands in
 * Phase 2 without touching this shape. Pure: no React, no Three.
 */
import { downtown } from "./downtown";
import { hills } from "./hills";
import { highway } from "./highway";
import { canyon } from "./canyon";

export interface MapTheme {
  /** Sky + fog colour (hex). */
  background: string;
  fogNear: number;
  fogFar: number;
  /** Terrain mesh colour (hex). */
  groundColor: string;
  /** Key/sun directional light. */
  sunColor: string;
  sunIntensity: number;
  /** Flat fill ambient intensity. */
  ambientIntensity: number;
  /** Hemisphere light: sky tint, ground tint, intensity. */
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
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

export const MAPS: MapDef[] = [downtown, hills, highway, canyon];

export const DEFAULT_MAP_ID = "downtown";

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS.find((m) => m.id === DEFAULT_MAP_ID)!;
}

export interface MapChoice {
  id: string;
  name: string;
}

/**
 * Lightweight list for the map-select UI — id + display name only, in registry
 * order. Pure so the selector's contents are unit-testable without React.
 */
export function mapChoices(): MapChoice[] {
  return MAPS.map((m) => ({ id: m.id, name: m.name }));
}
