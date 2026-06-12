// All shared type definitions for the Helicopter game.

export type Vec = { x: number; y: number };

export type Difficulty = "easy" | "hard";

export type ObstacleType = "static" | "moving" | "narrow" | "sawblade" | "laser";

export type PickupType =
  | "blue_gem"
  | "green_gem"
  | "red_gem"
  | "gold_gem"
  | "coin"
  | "shield"
  | "slowmo"
  | "magnet";

export type BiomeId = "cave" | "dawn" | "underwater" | "storm" | "volcanic" | "neon" | "space";

export type Obstacle = {
  x: number;
  gapY: number;
  baseGapY: number;     // anchor for moving pillars
  movePhase: number;    // sin input for moving pillars
  type: ObstacleType;
  gap: number;          // gap size for this obstacle
  sawAngle: number;     // current rotation for sawblade
  sawY: number;         // saw Y position (only for sawblade type)
};

export type Pickup = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: PickupType;
  spin: number;
  bob: number;          // bobs up/down idle
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
};

export type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
};

export type Smoke = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
};

export type Mountain = { x: number; height: number };

// ===== Space biome flyers =====
export type Asteroid = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  spin: number;
  shape: number[];   // per-vertex radius multipliers for a lumpy silhouette
};

export type Jet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fireAt: number;    // timestamp of next shot
  enterFrame: number;
};

export type Bullet = {
  x: number;
  y: number;
  vx: number;
};

export type RainDrop = { x: number; y: number; speed: number; length: number };

export type Star = { x: number; y: number; size: number; twinkle: number };

export type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
};

export type Biome = {
  id: BiomeId;
  name: string;
  scoreStart: number;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  mountainFar: string;
  mountainNear: string;
  pillarMain: [string, string, string];   // gradient stops (left, mid, right)
  pillarCap: string;
  pillarEdge: string;
  starCount: number;
  starColor: string;
  hasRain: boolean;
  hasLightning: boolean;
  hasSun: boolean;
  sunColor?: string;
};
