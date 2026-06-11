// Shared type definitions for Snake.

export type Direction = "up" | "down" | "left" | "right";

export type Point = { x: number; y: number };

export type Mode = "classic" | "wrap" | "maze";

export type PowerupType = "slow" | "ghost" | "shrink" | "multi" | "speed";

export type Food = {
  x: number;
  y: number;
  kind: "normal" | "bonus" | "poison";
  spawnedAt?: number;
};

export type Powerup = {
  x: number;
  y: number;
  type: PowerupType;
  spawnedAt: number;
};

export type Wall = {
  x: number;
  y: number;
  spawnedAt: number;
  expiresAt: number | null;
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
};

export type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  scale: number;
};

export type DeathStats = {
  score: number;
  length: number;
  foodEaten: number;
  maxCombo: number;
  powerupsUsed: number;
  timeAliveSec: number;
  mode: Mode;
};

export type SnakeSettings = {
  sound: boolean;
  particles: boolean;
};
