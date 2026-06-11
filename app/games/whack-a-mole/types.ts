// All shared type definitions for Whack-a-Mole.

export type Mode = "classic" | "endless";

export type MoleType = "normal" | "speedy" | "golden" | "bomb" | "boss" | "freeze";

export type MoleState = "alive" | "stunned";

export type Mole = {
  id: number;
  index: number;             // 0..8 hole index
  type: MoleType;
  spawnedGameTime: number;   // milliseconds of GAME TIME (frozen during freeze)
  duration: number;          // total ms in hole before retreating
  state: MoleState;
  stateStartedAt: number;    // real-time ms of state entry
  hitsLeft: number;          // 1 for most, 2 for boss
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
  mode: Mode;
  score: number;
  hits: number;
  misses: number;
  accuracy: number;          // 0..1
  maxCombo: number;
  golden: number;
  boss: number;
  freezes: number;
  bombs: number;
  timeAliveSec: number;
};
