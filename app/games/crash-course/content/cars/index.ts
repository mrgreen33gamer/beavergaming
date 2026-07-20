/**
 * Car registry — every drivable car as data. The starter mirrors the current
 * config.ts CAR constant exactly, so Phase 1 changes nothing about how the game
 * drives. Later cars (and their prices) are added here as one object each.
 * Pure: no React, no Three.
 */

export interface CarStats {
  /** Relative mass — momentum carried into the pile. */
  mass: number;
  /** m/s cruising ceiling without nitrous (config.ts CAR.topSpeed). */
  topSpeed: number;
  /** Throttle easing toward target velocity (config.ts CAR.accel). */
  accel: number;
  /** Steering responsiveness scalar, 0..1.5 (1 = today's feel). */
  grip: number;
  /** Heavy hits the body shrugs off before it wrecks out. */
  durability: number;
}

export interface CarDef {
  id: string;
  name: string;
  /** B-Token price; 0 = owned from the start. */
  price: number;
  stats: CarStats;
  color: string;
  /** Optional GLB path; Phase-4 art. */
  model?: string;
}

export const CARS: CarDef[] = [
  {
    id: "rust-bucket",
    name: "Rust Bucket",
    price: 0,
    color: "#c9552e",
    stats: { mass: 1, topSpeed: 34, accel: 26, grip: 1, durability: 3 },
  },
  {
    id: "muscle",
    name: "Muscle",
    price: 1500,
    color: "#2f6fd6",
    // Fast and grippy, still light — a straight upgrade in speed, not toughness.
    stats: { mass: 1.15, topSpeed: 42, accel: 32, grip: 1.15, durability: 4 },
  },
  {
    id: "monster-truck",
    name: "Monster Truck",
    price: 4000,
    color: "#3fae55",
    // Heavy and tough, sluggish steering — plows the pile, corners like a barge.
    stats: { mass: 2.2, topSpeed: 36, accel: 22, grip: 0.8, durability: 7 },
  },
  {
    id: "demolisher",
    name: "Demolisher",
    price: 9000,
    color: "#b0402f",
    // Max mass + durability, decent speed — the endgame wrecking ball.
    stats: { mass: 3.2, topSpeed: 40, accel: 28, grip: 0.9, durability: 12 },
  },
];

export const STARTER_CAR_ID = "rust-bucket";

export function getCar(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS.find((c) => c.id === STARTER_CAR_ID)!;
}
