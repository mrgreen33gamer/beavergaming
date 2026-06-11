import type {
  BuildingType, UnitType, EnemyType,
  BuildingSpec, UnitSpec, EnemySpec,
} from "./types";

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  barracks: {
    cost: 50,
    label: "Barracks",
    emoji: "🪖",
    spawnInterval: 1600,
    unitCap: 6,
    unitType: "infantry",
    color: "#7a5a30",
    accent: "#a87838",
    detailColor: "#3a2810",
  },
  factory: {
    cost: 120,
    label: "Tank Factory",
    emoji: "🛡️",
    spawnInterval: 5000,
    unitCap: 3,
    unitType: "tank",
    color: "#4a3a30",
    accent: "#7a6050",
    detailColor: "#1a0e0a",
  },
  hangar: {
    cost: 180,
    label: "Hangar",
    emoji: "✈️",
    spawnInterval: 4500,
    unitCap: 3,
    unitType: "aircraft",
    color: "#3a5a78",
    accent: "#6090b8",
    detailColor: "#1a2a3a",
  },
};

export const UNIT_SPECS: Record<UnitType, UnitSpec> = {
  infantry: {
    maxHp: 22, damage: 4, range: 60, speed: 1.0, fireRate: 600,
    bulletSpeed: 5, bulletColor: "#c8a060", size: 8,
    isAircraft: false, bodyColor: "#5a8c5e",
  },
  tank: {
    maxHp: 90, damage: 20, range: 110, speed: 0.55, fireRate: 1200,
    bulletSpeed: 6, bulletColor: "#7fd650", size: 16,
    isAircraft: false, bodyColor: "#5a8c5e",
  },
  aircraft: {
    maxHp: 35, damage: 12, range: 130, speed: 1.8, fireRate: 800,
    bulletSpeed: 6.5, bulletColor: "#6090b8", size: 13,
    isAircraft: true, bodyColor: "#6090b8",
  },
};

export const ENEMY_SPECS: Record<EnemyType, EnemySpec> = {
  basic: {
    maxHp: 32, damage: 6, range: 55, awarenessRange: 130, speed: 0.55,
    fireRate: 1100, bulletSpeed: 4.5, bulletColor: "#ff5050",
    bodyColor: "#a04040", turretColor: "#c05050", reward: 10, size: 16,
  },
  scout: {
    maxHp: 18, damage: 4, range: 60, awarenessRange: 160, speed: 1.4,
    fireRate: 1300, bulletSpeed: 5.5, bulletColor: "#c060e0",
    bodyColor: "#8048a8", turretColor: "#a868c8", reward: 8, size: 13,
  },
  heavy: {
    maxHp: 120, damage: 18, range: 85, awarenessRange: 170, speed: 0.32,
    fireRate: 1800, bulletSpeed: 5, bulletColor: "#ff8020",
    bodyColor: "#5a4028", turretColor: "#806040", reward: 40, size: 22,
  },
};
