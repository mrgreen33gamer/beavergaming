/**
 * Maps a CarDef's stats onto the handling numbers Car.tsx feeds to Rapier.
 * Pure: imports only the tunables in config.ts (no React, no Three).
 *
 * Behavior-preservation: the starter's stats (mass 1 / topSpeed 34 / accel 26 /
 * grip 1 / durability = starterDurability) map back to the exact config.CAR
 * values, so selecting the starter drives identically to today.
 *
 * `durability` scales the car-damage force threshold rather than adding a
 * wreck-out mechanic: the current damage model (scoring.ts) is cosmetic, so a
 * higher threshold simply means a tougher body shrugs off more hits.
 */
import { CAR, IMPACT } from "../../config";
import { getCar, STARTER_CAR_ID, type CarDef } from "./index";

export interface CarHandling {
  /** m/s cruising ceiling (before nitrous). */
  topSpeed: number;
  /** Throttle easing toward target velocity. */
  accel: number;
  /** Yaw rad/s at speed — config.CAR.steerRate scaled by grip. */
  steerRate: number;
  /** Rapier collider density — config.CAR.density scaled by mass (momentum). */
  density: number;
  /** Contact force that dents the body — config IMPACT.carDamageForce scaled by durability. */
  damageForce: number;
}

const STARTER_DURABILITY = getCar(STARTER_CAR_ID).stats.durability;

export function carHandling(car: CarDef): CarHandling {
  const s = car.stats;
  return {
    topSpeed: s.topSpeed,
    accel: s.accel,
    steerRate: CAR.steerRate * s.grip,
    density: CAR.density * s.mass,
    damageForce: IMPACT.carDamageForce * (s.durability / STARTER_DURABILITY),
  };
}
