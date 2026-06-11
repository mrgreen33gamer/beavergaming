// Shared type definitions for the Apple Shooter game.

export type Vec = { x: number; y: number };

export type Mood = "idle" | "worried" | "panic" | "flinch" | "cheer";

export type ArmPose = "rest" | "left_extended" | "right_extended" | "both_extended";

// Apple positions are relative to friend's current x.
export type ApplePos = "head" | "left_hand" | "right_hand";

export type Apple = {
  id: number;
  pos: ApplePos;
  // Cached absolute position (re-computed each frame based on friend.x)
  x: number;
  y: number;
  hit: boolean;
};

export type ArrowTrailPoint = { x: number; y: number; life: number };

export type Arrow = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  stuckAngle: number;
  trail: ArrowTrailPoint[];
};

export type AppleChunk = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: "skin" | "flesh" | "stem" | "leaf";
};

export type JuiceParticle = {
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

export type GrassBlade = {
  x: number;
  phase: number;
  height: number;
};

export type LevelConfig = {
  level: number;
  targetBaseX: number;
  applePositions: ApplePos[];
  moves: boolean;
  moveSpeed: number;
  moveRange: number;
  windAmplitude: number;
  // For the level-start banner: "WIND", "MOVING TARGET", etc.
  newThisLevel: string | null;
};
