export type Vec = { x: number; y: number };

export type BuildingType =
  | "barracks" | "sniper-nest" | "tank-factory" | "mech-bay"
  | "hangar" | "drone-hive" | "artillery-post" | "flame-bunker"
  | "radar-tower" | "repair-depot";

export type UnitType =
  | "infantry" | "sniper" | "tank" | "mech"
  | "aircraft" | "drone" | "artillery" | "flamethrower";

export type EnemyType =
  | "basic" | "scout" | "heavy" | "stealth"
  | "bomber" | "swarm" | "healer" | "boss";

export type Phase = "building" | "wave" | "gameover";
export type AbilityType = "airstrike" | "reinforce" | "shield";
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export type BuildingSpec = {
  cost: number;
  upgradeCosts: [number, number]; // cost for lvl 2 and 3
  label: string;
  icon: string;
  desc: string;
  spawnInterval: number;
  unitCap: number;
  unitType: UnitType | null; // null = support building
  color: string;
  accent: string;
  special?: "radar" | "repair";
  effectRadius?: number;
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
  priority: EnemyType[]; // preferred targets
  splash?: number; // splash damage radius
  dot?: number; // damage over time per tick
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
  accentColor: string;
  reward: number;
  size: number;
  behavior: "assault" | "flank" | "rush" | "support" | "stealth" | "swarm";
  stealth?: boolean;
  healRate?: number;
  splashDmg?: number;
};

export type Building = {
  slot: number;
  type: BuildingType;
  level: number; // 1-3
  pos: Vec;
  lastSpawn: number;
};

export type Unit = {
  id: number;
  type: UnitType;
  pos: Vec;
  angle: number;
  hp: number;
  maxHp: number;
  spec: UnitSpec;
  lastShot: number;
  target: Enemy | null;
  hoverPhase: number;
  rallyPoint: Vec | null;
  burnTicks: number;
};

export type Enemy = {
  id: number;
  type: EnemyType;
  pos: Vec;
  bodyAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  spec: EnemySpec;
  lastShot: number;
  lastHeal: number;
  revealed: boolean;
  stealthAlpha: number;
  spawnTime: number;
  flankAngle: number;
};

export type Bullet = {
  pos: Vec;
  vel: Vec;
  fromPlayer: boolean;
  damage: number;
  life: number;
  color: string;
  splash?: number;
  dot?: number;
};

export type Particle = {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  decay: number;
  type?: "fire" | "smoke" | "spark" | "shockwave";
};

export type FloatingText = {
  id: number;
  pos: Vec;
  text: string;
  color: string;
  vy: number;
  life: number;
  maxLife: number;
  scale?: number;
};

export type Ability = {
  type: AbilityType;
  label: string;
  icon: string;
  cooldown: number;
  lastUsed: number;
  duration: number;
  active: boolean;
};

export type AirstrikeTarget = {
  pos: Vec;
  radius: number;
  damage: number;
  time: number;
  delay: number;
};

export type GameStats = {
  kills: number;
  damageDealt: number;
  buildingsBuilt: number;
  unitsSpawned: number;
  longestStreak: number;
  currentStreak: number;
  lastKillTime: number;
  comboMultiplier: number;
};
