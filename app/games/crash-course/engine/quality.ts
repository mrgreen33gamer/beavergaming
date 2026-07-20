/**
 * Adaptive quality — pure tier selection from a GPU probe. The Viewport probes
 * the live renderer once and drei's PerformanceMonitor nudges the tier at
 * runtime; both consume this table. No React, no Three here so it is testable.
 */

export type QualityTier = "low" | "med" | "high";

export interface QualitySettings {
  tier: QualityTier;
  maxPixelRatio: number;
  /** 0 disables shadows entirely. */
  shadowMapSize: 0 | 1024 | 2048;
  postFx: "none" | "bloom" | "bloom+vignette";
  /** Fog far plane — the effective draw distance. */
  fogFar: number;
  /** Heightfield subdivisions per side (Phase 2 terrain). */
  terrainSegments: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { tier: "low", maxPixelRatio: 1, shadowMapSize: 0, postFx: "none", fogFar: 120, terrainSegments: 48 },
  med: { tier: "med", maxPixelRatio: 1.5, shadowMapSize: 1024, postFx: "bloom", fogFar: 160, terrainSegments: 96 },
  high: { tier: "high", maxPixelRatio: 2, shadowMapSize: 2048, postFx: "bloom+vignette", fogFar: 190, terrainSegments: 160 },
};

export interface GpuProbe {
  /** Unmasked renderer string from WEBGL_debug_renderer_info. */
  renderer: string;
  maxTextureSize: number;
}

const SOFTWARE = /swiftshader|llvmpipe|basic render|software/i;
const INTEGRATED = /intel|uhd|hd graphics|iris|microsoft/i;
const MOBILE = /mali|adreno|powervr|apple [am]\d|apple gpu/i;
const DISCRETE = /nvidia|geforce|rtx|gtx|radeon|amd/i;

export function detectTier(probe: GpuProbe): QualityTier {
  const r = probe.renderer || "";
  // A tiny max texture size means a weak/virtual GPU no matter what it calls
  // itself — trust the capability over the name.
  if (probe.maxTextureSize < 4096) return "low";
  if (SOFTWARE.test(r)) return "low";
  if (INTEGRATED.test(r)) return "low";
  if (MOBILE.test(r)) return "med";
  if (DISCRETE.test(r)) return "high";
  // Unknown but capable hardware: play it safe in the middle.
  return "med";
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return QUALITY[tier];
}
