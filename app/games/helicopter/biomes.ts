import type { Biome, BiomeId, ObstacleType } from "./types";

// Ordered by scoreStart ascending — getBiome relies on this.
export const BIOMES: Biome[] = [
  {
    id: "cave",
    name: "CAVE",
    scoreStart: 0,
    skyTop: "#0a0608",
    skyMid: "#1a0e0a",
    skyBot: "#2a1810",
    mountainFar: "#2a1810",
    mountainNear: "#3a2218",
    pillarMain: ["#cc5510", "#ff6b1a", "#cc5510"],
    pillarCap: "#ff8a3d",
    pillarEdge: "#7a2a05",
    starCount: 50,
    starColor: "#5a3828",
    hasRain: false,
    hasLightning: false,
    hasSun: false,
  },
  {
    id: "dawn",
    name: "DAWN",
    scoreStart: 250,
    skyTop: "#3a1a30",
    skyMid: "#b04050",
    skyBot: "#e07840",
    mountainFar: "#5a2828",
    mountainNear: "#7a3838",
    pillarMain: ["#604030", "#a07050", "#604030"],
    pillarCap: "#d0a060",
    pillarEdge: "#3a2018",
    starCount: 0,
    starColor: "",
    hasRain: false,
    hasLightning: false,
    hasSun: true,
    sunColor: "#ffd060",
  },
  {
    id: "underwater",
    name: "DEEP OCEAN",
    scoreStart: 600,
    skyTop: "#021420",
    skyMid: "#062840",
    skyBot: "#0e4868",
    mountainFar: "#1a5050",
    mountainNear: "#c06080",
    pillarMain: ["#105858", "#18807a", "#105858"],
    pillarCap: "#30c0a8",
    pillarEdge: "#083838",
    starCount: 50,       // bubbles
    starColor: "#80d8f0",
    hasRain: false,
    hasLightning: false,
    hasSun: false,
  },
  {
    id: "storm",
    name: "STORM",
    scoreStart: 1100,
    skyTop: "#08081a",
    skyMid: "#181828",
    skyBot: "#28283a",
    mountainFar: "#0a0a18",
    mountainNear: "#1a1a28",
    pillarMain: ["#3a3a50", "#5a5a70", "#3a3a50"],
    pillarCap: "#7080a0",
    pillarEdge: "#1a1a28",
    starCount: 0,
    starColor: "",
    hasRain: true,
    hasLightning: true,
    hasSun: false,
  },
  {
    id: "volcanic",
    name: "VOLCANO",
    scoreStart: 1800,
    skyTop: "#1a0808",
    skyMid: "#3a1010",
    skyBot: "#5a2010",
    mountainFar: "#2a0808",
    mountainNear: "#401010",
    pillarMain: ["#5a2010", "#8a3818", "#5a2010"],
    pillarCap: "#d04020",
    pillarEdge: "#2a0a05",
    starCount: 35,        // embers
    starColor: "#ff6030",
    hasRain: false,
    hasLightning: false,
    hasSun: true,
    sunColor: "#ff4020",
  },
  {
    id: "neon",
    name: "NEON CITY",
    scoreStart: 2800,
    skyTop: "#0a0818",
    skyMid: "#1a1040",
    skyBot: "#2a1860",
    mountainFar: "#1a0830",
    mountainNear: "#2a1050",
    pillarMain: ["#4020a0", "#8040e0", "#4020a0"],
    pillarCap: "#e060ff",
    pillarEdge: "#200850",
    starCount: 80,       // neon sparkles
    starColor: "#ff60e0",
    hasRain: false,
    hasLightning: false,
    hasSun: false,
  },
  {
    id: "space",
    name: "DEEP SPACE",
    scoreStart: 4000,
    skyTop: "#08081a",
    skyMid: "#15103a",
    skyBot: "#251850",
    mountainFar: "#1a1040",
    mountainNear: "#2a2060",
    pillarMain: ["#604080", "#a070c0", "#604080"],
    pillarCap: "#c090e0",
    pillarEdge: "#301850",
    starCount: 120,
    starColor: "#f5e8d0",
    hasRain: false,
    hasLightning: false,
    hasSun: false,
  },
];

// Distribution of obstacle types per biome. Weights sum to 1.0.
export const OBSTACLE_WEIGHTS: Record<
  BiomeId,
  Array<{ type: ObstacleType; weight: number }>
> = {
  cave:       [{ type: "static", weight: 1.0 }],
  dawn:       [{ type: "static", weight: 0.80 }, { type: "moving", weight: 0.20 }],
  underwater: [{ type: "static", weight: 0.60 }, { type: "moving", weight: 0.25 }, { type: "narrow", weight: 0.15 }],
  storm:      [{ type: "static", weight: 0.45 }, { type: "moving", weight: 0.30 }, { type: "narrow", weight: 0.25 }],
  volcanic:   [{ type: "static", weight: 0.30 }, { type: "moving", weight: 0.25 }, { type: "narrow", weight: 0.25 }, { type: "sawblade", weight: 0.20 }],
  neon:       [{ type: "static", weight: 0.22 }, { type: "moving", weight: 0.26 }, { type: "narrow", weight: 0.22 }, { type: "laser", weight: 0.30 }],
  space:      [{ type: "static", weight: 0.45 }, { type: "moving", weight: 0.30 }, { type: "narrow", weight: 0.25 }],
};

export function getBiome(score: number): Biome {
  // Walk biome list, return the latest one we've passed.
  let result = BIOMES[0];
  for (let i = 0; i < BIOMES.length; i++) {
    if (score >= BIOMES[i].scoreStart) result = BIOMES[i];
    else break;
  }
  return result;
}

export function getBiomeIndex(score: number): number {
  let result = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    if (score >= BIOMES[i].scoreStart) result = i;
    else break;
  }
  return result;
}

export function pickObstacleType(biomeId: BiomeId): ObstacleType {
  const weights = OBSTACLE_WEIGHTS[biomeId];
  const r = Math.random();
  let acc = 0;
  for (const w of weights) {
    acc += w.weight;
    if (r < acc) return w.type;
  }
  return weights[weights.length - 1].type;
}
