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
];

export const STARTER_CAR_ID = "rust-bucket";

export function getCar(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS.find((c) => c.id === STARTER_CAR_ID)!;
}
