import type {
  BuildingType, UnitType, EnemyType,
  BuildingSpec, UnitSpec, EnemySpec,
} from "./types";

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  barracks: {
    cost: 50, upgradeCosts: [60, 100],
    label: "Barracks", icon: "🪖", desc: "Infantry squads",
    spawnInterval: 1500, unitCap: 5, unitType: "infantry",
    color: "#5a6a40", accent: "#7a8a58",
  },
  "sniper-nest": {
    cost: 75, upgradeCosts: [80, 130],
    label: "Sniper Nest", icon: "🎯", desc: "Long-range marksmen",
    spawnInterval: 3500, unitCap: 3, unitType: "sniper",
    color: "#3a4a30", accent: "#5a6a48",
  },
  "tank-factory": {
    cost: 120, upgradeCosts: [100, 160],
    label: "Tank Factory", icon: "🛡️", desc: "Armored tanks",
    spawnInterval: 5000, unitCap: 3, unitType: "tank",
    color: "#4a4a3a", accent: "#6a6a50",
  },
  "mech-bay": {
    cost: 200, upgradeCosts: [150, 220],
    label: "Mech Bay", icon: "🤖", desc: "Heavy assault mechs",
    spawnInterval: 7000, unitCap: 2, unitType: "mech",
    color: "#3a3a4a", accent: "#6060a0",
  },
  hangar: {
    cost: 150, upgradeCosts: [120, 180],
    label: "Hangar", icon: "✈️", desc: "Fast aircraft",
    spawnInterval: 4500, unitCap: 3, unitType: "aircraft",
    color: "#3a5a78", accent: "#6090b8",
  },
  "drone-hive": {
    cost: 80, upgradeCosts: [70, 110],
    label: "Drone Hive", icon: "🐝", desc: "Drone swarms",
    spawnInterval: 1200, unitCap: 8, unitType: "drone",
    color: "#5a5a20", accent: "#8a8a40",
  },
  "artillery-post": {
    cost: 160, upgradeCosts: [130, 200],
    label: "Artillery Post", icon: "💣", desc: "Splash bombardment",
    spawnInterval: 6000, unitCap: 2, unitType: "artillery",
    color: "#5a4a30", accent: "#8a7050",
  },
  "flame-bunker": {
    cost: 90, upgradeCosts: [80, 130],
    label: "Flame Bunker", icon: "🔥", desc: "Area denial flames",
    spawnInterval: 3000, unitCap: 3, unitType: "flamethrower",
    color: "#6a3a20", accent: "#a05a30",
  },
  "radar-tower": {
    cost: 100, upgradeCosts: [80, 140],
    label: "Radar Tower", icon: "📡", desc: "Reveals stealth, +range",
    spawnInterval: 0, unitCap: 0, unitType: null,
    color: "#2a4a3a", accent: "#40b070",
    special: "radar", effectRadius: 200,
  },
  "repair-depot": {
    cost: 130, upgradeCosts: [100, 160],
    label: "Repair Depot", icon: "🔧", desc: "Heals nearby units",
    spawnInterval: 0, unitCap: 0, unitType: null,
    color: "#3a4a5a", accent: "#60a0d0",
    special: "repair", effectRadius: 160,
  },
};

export const UNIT_SPECS: Record<UnitType, UnitSpec> = {
  infantry: {
    maxHp: 24, damage: 5, range: 65, speed: 1.0, fireRate: 550,
    bulletSpeed: 5, bulletColor: "#c8a060", size: 7,
    isAircraft: false, bodyColor: "#5a8c5e",
    priority: ["bomber", "healer", "basic"],
  },
  sniper: {
    maxHp: 16, damage: 22, range: 180, speed: 0.6, fireRate: 1800,
    bulletSpeed: 10, bulletColor: "#ff4444", size: 7,
    isAircraft: false, bodyColor: "#3a5a30",
    priority: ["healer", "heavy", "boss", "bomber"],
  },
  tank: {
    maxHp: 100, damage: 22, range: 100, speed: 0.5, fireRate: 1200,
    bulletSpeed: 6, bulletColor: "#7fd650", size: 15,
    isAircraft: false, bodyColor: "#5a7a4e",
    priority: ["heavy", "boss", "basic"],
  },
  mech: {
    maxHp: 160, damage: 30, range: 110, speed: 0.4, fireRate: 1000,
    bulletSpeed: 7, bulletColor: "#a0a0ff", size: 18,
    isAircraft: false, bodyColor: "#4a4a6a",
    priority: ["boss", "heavy", "bomber"],
    splash: 35,
  },
  aircraft: {
    maxHp: 38, damage: 14, range: 130, speed: 1.8, fireRate: 700,
    bulletSpeed: 7, bulletColor: "#60b0e0", size: 12,
    isAircraft: true, bodyColor: "#5080a0",
    priority: ["scout", "stealth", "bomber", "healer"],
  },
  drone: {
    maxHp: 10, damage: 3, range: 50, speed: 2.2, fireRate: 400,
    bulletSpeed: 5, bulletColor: "#b0b050", size: 5,
    isAircraft: true, bodyColor: "#8a8a30",
    priority: ["swarm", "scout", "basic"],
  },
  artillery: {
    maxHp: 50, damage: 45, range: 220, speed: 0.25, fireRate: 2800,
    bulletSpeed: 4, bulletColor: "#ffa030", size: 14,
    isAircraft: false, bodyColor: "#6a5a3a",
    priority: ["heavy", "boss", "basic"],
    splash: 50,
  },
  flamethrower: {
    maxHp: 30, damage: 8, range: 55, speed: 0.85, fireRate: 200,
    bulletSpeed: 3.5, bulletColor: "#ff6020", size: 9,
    isAircraft: false, bodyColor: "#8a4a20",
    priority: ["swarm", "basic", "scout"],
    dot: 2,
  },
};

export const ENEMY_SPECS: Record<EnemyType, EnemySpec> = {
  basic: {
    maxHp: 35, damage: 7, range: 60, awarenessRange: 130, speed: 0.55,
    fireRate: 1100, bulletSpeed: 4.5, bulletColor: "#ff5050",
    bodyColor: "#a04040", accentColor: "#c05050", reward: 12, size: 14,
    behavior: "assault",
  },
  scout: {
    maxHp: 18, damage: 4, range: 55, awarenessRange: 170, speed: 1.6,
    fireRate: 1200, bulletSpeed: 5.5, bulletColor: "#c060e0",
    bodyColor: "#7040a0", accentColor: "#a060c0", reward: 10, size: 10,
    behavior: "flank",
  },
  heavy: {
    maxHp: 140, damage: 20, range: 80, awarenessRange: 150, speed: 0.3,
    fireRate: 1800, bulletSpeed: 5, bulletColor: "#ff8020",
    bodyColor: "#5a3a20", accentColor: "#806040", reward: 45, size: 20,
    behavior: "assault", splashDmg: 8,
  },
  stealth: {
    maxHp: 28, damage: 12, range: 50, awarenessRange: 90, speed: 1.1,
    fireRate: 900, bulletSpeed: 5, bulletColor: "#50ffaa",
    bodyColor: "#205040", accentColor: "#308060", reward: 25, size: 11,
    behavior: "stealth", stealth: true,
  },
  bomber: {
    maxHp: 45, damage: 35, range: 40, awarenessRange: 0, speed: 0.9,
    fireRate: 2000, bulletSpeed: 0, bulletColor: "#ff3030",
    bodyColor: "#6a2020", accentColor: "#aa3030", reward: 20, size: 13,
    behavior: "rush",
  },
  swarm: {
    maxHp: 8, damage: 2, range: 30, awarenessRange: 80, speed: 1.5,
    fireRate: 800, bulletSpeed: 4, bulletColor: "#ff8080",
    bodyColor: "#903030", accentColor: "#b04040", reward: 3, size: 6,
    behavior: "swarm",
  },
  healer: {
    maxHp: 30, damage: 3, range: 45, awarenessRange: 200, speed: 0.5,
    fireRate: 2000, bulletSpeed: 3.5, bulletColor: "#80ff80",
    bodyColor: "#207030", accentColor: "#40a050", reward: 30, size: 12,
    behavior: "support", healRate: 0.8,
  },
  boss: {
    maxHp: 500, damage: 30, range: 100, awarenessRange: 250, speed: 0.25,
    fireRate: 1500, bulletSpeed: 5.5, bulletColor: "#ff2020",
    bodyColor: "#2a1a1a", accentColor: "#ff4040", reward: 150, size: 30,
    behavior: "assault", splashDmg: 15,
  },
};

// Level multipliers for building upgrades
export const UPGRADE_MULT = {
  1: { hp: 1, dmg: 1, rate: 1, cap: 0 },
  2: { hp: 1.3, dmg: 1.25, rate: 0.85, cap: 1 },
  3: { hp: 1.6, dmg: 1.5, rate: 0.7, cap: 2 },
} as Record<number, { hp: number; dmg: number; rate: number; cap: number }>;
