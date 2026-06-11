// All shared type definitions for Base Command.

export type Vec = { x: number; y: number };

export type BuildingType = "barracks" | "factory" | "hangar";
export type UnitType = "infantry" | "tank" | "aircraft";
export type EnemyType = "basic" | "scout" | "heavy";
export type Phase = "building" | "wave" | "gameover";

export type BuildingSpec = {
  cost: number;
  label: string;
  emoji: string;
  spawnInterval: number;
  unitCap: number;
  unitType: UnitType;
  color: string;
  accent: string;
  detailColor: string;
};

export type UnitSpec = {
  maxHp: number;
  damage: number;
  range: number;
  speed: number;
  fireRate: number;
  bulletSpeed: number;
  bulletColor: string;
  size: number;
  isAircraft: boolean;
  bodyColor: string;
};

export type EnemySpec = {
  maxHp: number;
  damage: number;
  range: number;
  awarenessRange: number;
  speed: number;
  fireRate: number;
  bulletSpeed: number;
  bulletColor: string;
  bodyColor: string;
  turretColor: string;
  reward: number;
  size: number;
};

export type Building = {
  slot: number;
  type: BuildingType;
  pos: Vec;
  lastSpawn: number;
};

export type Unit = {
  id: number;
  type: UnitType;
  pos: Vec;
  angle: number;
  hp: number;
  spec: UnitSpec;
  lastShot: number;
  target: Enemy | null;
  hoverPhase: number;
};

export type Enemy = {
  id: number;
  type: EnemyType;
  pos: Vec;
  bodyAngle: number;
  turretAngle: number;
  hp: number;
  spec: EnemySpec;
  lastShot: number;
};

export type Bullet = {
  pos: Vec;
  vel: Vec;
  fromPlayer: boolean;
  damage: number;
  life: number;
  color: string;
};

export type Particle = {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  decay: number;
};

export type FloatingText = {
  id: number;
  pos: Vec;
  text: string;
  color: string;
  vy: number;
  life: number;
  maxLife: number;
};
