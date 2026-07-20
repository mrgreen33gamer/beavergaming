/**
 * Ownership / purchase reducer for the car garage. Pure: no React, no Three,
 * no I/O. The server route (authoritative spend) and the client hook both
 * build on this so the affordability + ownership rules live in exactly one
 * tested place. The starter is always owned and can never be "bought".
 */
import { getCar, STARTER_CAR_ID, type CarDef } from "./index";

export interface GarageState {
  /** Car ids the player owns. Always contains the starter. */
  owned: string[];
  /** The active car id. Always one of `owned`. */
  selected: string;
}

export function initialGarage(): GarageState {
  return { owned: [STARTER_CAR_ID], selected: STARTER_CAR_ID };
}

/**
 * Coerce persisted or partial data into a valid state: the starter is forced
 * into `owned`, unknown ids are dropped, and `selected` must be owned (else it
 * falls back to the starter). Safe to call on anything read from storage.
 */
export function normalizeGarage(
  raw: Partial<GarageState> | null | undefined,
): GarageState {
  const set = new Set<string>([STARTER_CAR_ID, ...(raw?.owned ?? [])]);
  // getCar falls back to the starter for unknown ids, so `getCar(id).id === id`
  // is true only for real cars — this drops anything stale from the registry.
  const owned = [...set].filter((id) => getCar(id).id === id);
  const selected =
    raw?.selected && owned.includes(raw.selected) ? raw.selected : STARTER_CAR_ID;
  return { owned, selected };
}

export function isOwned(state: GarageState, id: string): boolean {
  return state.owned.includes(id);
}

/** A car can be afforded when it has a real price and the balance covers it. */
export function canAfford(car: CarDef, balance: number): boolean {
  return car.price > 0 && balance >= car.price;
}

export function buyable(
  state: GarageState,
  car: CarDef,
  balance: number,
): boolean {
  return !isOwned(state, car.id) && canAfford(car, balance);
}

export function addOwned(state: GarageState, id: string): GarageState {
  if (state.owned.includes(id)) return state;
  return { ...state, owned: [...state.owned, id] };
}

export function selectCar(state: GarageState, id: string): GarageState {
  if (!state.owned.includes(id)) return state;
  return { ...state, selected: id };
}

/**
 * Pure purchase transition used for optimistic client UI. Returns the new
 * state and whether it went through. The server performs the authoritative
 * spend; this mirrors its decision so the UI can react instantly.
 */
export function buy(
  state: GarageState,
  car: CarDef,
  balance: number,
): { state: GarageState; ok: boolean } {
  if (!buyable(state, car, balance)) return { state, ok: false };
  return { state: addOwned(state, car.id), ok: true };
}
