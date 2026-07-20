# Crash Course Phase 4 — Buyable Cars + Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three buyable cars (Muscle / Monster Truck / Demolisher) with genuinely different stats, a garage/shop in the intro screen that spends real B-Tokens to buy and lets the player select an owned car, persist ownership+selection across reloads (starter always owned), and make the car actually drive to its stats — while the starter on Downtown stays behavior-preserving.

**Architecture:** All decision logic is pure and unit-tested: the car registry (`content/cars/index.ts`), an ownership/purchase reducer (`content/cars/garage.ts`), and a car-stat→handling mapper (`content/cars/handling.ts`) import no React and no Three. Spending is server-authoritative: a new route `app/api/games/crash-course/garage/route.ts` reuses the existing `Economy.spend()` primitive and the `"purchase"` ledger reason to charge the **same** account/guest ledger the shell balance is read from, and persists the owned set + selection via the existing server `SaveApi` — so balance and ownership live in one store and follow a signed-in player across devices. The client `useGarage` hook talks to that route and keeps the shop balance live via `balanceBus`. `Car.tsx` reads the active `CarDef` through `carHandling()` instead of the hardcoded `config.CAR` numbers.

**Tech Stack:** Next.js 16 (App Router route handlers), React 19, `@react-three/rapier`, `@react-three/fiber`, `three`, Vitest, TypeScript.

## Platform reality (investigation result — read before implementing)

- **Spend primitive exists, but is NOT client-reachable.** `Economy.spend(amount, reason, gameId)` exists (`lib/platform/economy.ts:63`) and the `"purchase"` `LedgerReason` is already defined (`lib/platform/storage/types.ts:5`). But `CartridgeHost` (`lib/platform/cartridge.ts:22`) exposes only `reportScore`, `reportEvent`, `saveState`, `loadState`, `onPause`, `onResume` — no spend — and `FORBIDDEN_HOST_METHODS` deliberately bans balance-mutating methods. There is **no** spend/purchase API route (`app/api/economy/*` is only `balance` GET, `score` POST, `event` POST, `summary` GET). **So the plan adds one minimal server route** that calls `Economy.spend`. This is a real-economy path, not a fallback.
- **The displayed balance is server-side.** The shell reads `/api/economy/balance` → `getServerEconomy()` → `resolveServerPlayerId()` (account id when signed in, else the `bg_sid` guest cookie). The client-side `Economy` inside `useCartridge` writes a **different** localStorage ledger keyed by `getPlayerId()` and is used only as an offline fallback. **Therefore a client-side spend would decrement the wrong ledger and not move the shown balance** — spend must go through the server route.
- **Per-game arbitrary state persistence exists** via `host.saveState(key, value)` / `host.loadState<T>(key)` → `SaveApi.setState/getState` (`lib/platform/save.ts:40`), and `SaveApi` is also available server-side from `getServerEconomy()`. Ownership is persisted with `SaveApi` **on the server route** (same handler as the spend) so it is transactionally tied to the charge and shares the balance's account scope — rather than on the client `host.saveState`, which would split ownership (device-local) from balance (account-global) and let a signed-in player re-buy (and be re-charged for) a car on a second device.

**Decision:** Use the real economy path. Add exactly one small server route (`app/api/games/crash-course/garage/route.ts`, GET+POST) that reuses `Economy.spend` + `SaveApi` + `getServerEconomy` + the pure car registry. No changes to the platform SDK, `CartridgeHost`, or existing economy routes. No fallback needed — guests simply have a 0 balance (they earn nothing) so they can only ever own the free starter, which the route enforces naturally via `spend()` returning `false`.

## Global Constraints

- **Pure modules stay pure:** `content/cars/index.ts`, `content/cars/garage.ts`, and `content/cars/handling.ts` import **no React and no Three**. `handling.ts` may import the pure `config.ts` (tunables only). The purchase/ownership reducer and the car-stat mapping are unit-tested with Vitest.
- **BEHAVIOR-PRESERVING:** the starter car (`rust-bucket`, `mass 1 / topSpeed 34 / accel 26 / grip 1 / durability 3`) on Downtown drives **exactly** as today. `carHandling(starter)` must equal today's `config.CAR` numbers exactly, asserted by a unit test. Selecting the starter and pressing START must be pixel/feel-identical to current `main`.
- **Server-authoritative spend:** tokens are only ever spent through `Economy.spend(price, "purchase", "crash-course")` inside the new route. The client never computes or mutates a balance; prices are validated server-side against the pure registry (a client-named price is ignored).
- **Per-task gate — all must pass before the task's commit:**
  - `npm test` — full suite green.
  - `npx tsc --noEmit` — clean.
  - `npx eslint app/games/crash-course --max-warnings=0` — clean (the route task **also** runs `npx eslint app/api/games/crash-course --max-warnings=0`).
  - `npm run build` — exit 0.
- **Branch:** `feat/crash-course-engine-expansion`. Commit after each task.
- **Automated coverage lives on the pure logic** (registry, ownership/purchase reducer, car-stat mapping) and the route's decision branches where feasible. **3D feel is validated by playtest**, not unit tests: the car-stat threading (Task 4) has no unit test for the R3F body and is gated by build + a documented playtest.
- **`durability` mapping:** the current damage system (`scoring.ts`) has no "wreck-out" gate — damage is cosmetic (panels shed, chassis squash). So `durability` is mapped to the **car-damage force threshold** (`IMPACT.carDamageForce`) as `durability / starterDurability`, which is trivial and behavior-preserving on the starter (ratio 1) and makes tougher cars shrug off more hits. No new wreck-out mechanic is introduced in Phase 4.

---

## File Structure

**Create:**
- `app/games/crash-course/content/cars/garage.ts` — pure ownership/purchase reducer (`GarageState`, `initialGarage`, `normalizeGarage`, `isOwned`, `canAfford`, `buyable`, `addOwned`, `selectCar`, `buy`).
- `app/games/crash-course/content/cars/handling.ts` — pure car-stat → handling mapper (`carHandling`, `CarHandling`).
- `app/games/crash-course/content/cars/__tests__/garage.test.ts` — reducer unit tests.
- `app/games/crash-course/content/cars/__tests__/handling.test.ts` — stat-mapping unit tests (incl. behavior-preservation).
- `app/api/games/crash-course/garage/route.ts` — server-authoritative garage: GET (load owned/selected/balance), POST (buy/select).
- `app/games/crash-course/useGarage.ts` — client hook wrapping the route + `balanceBus`.
- `app/games/crash-course/Garage.tsx` — the shop/garage UI panel for the intro screen.

**Modify:**
- `app/games/crash-course/content/cars/index.ts` — add three cars (Task 1).
- `app/games/crash-course/content/cars/__tests__/cars.test.ts` — extend coverage for the new cars (Task 1).
- `app/games/crash-course/Car.tsx` — accept a `car: CarDef` prop, apply `carHandling` (Task 4).
- `app/games/crash-course/Scene.tsx` — thread `car` from parent into `<Car>` (Task 4).
- `app/games/crash-course/index.tsx` — pass the active car to `<Scene>` (Task 4: constant starter; Task 7: selected car) and render `<Garage>` in the intro (Task 7).

---

### Task 1: Add three buyable cars to the registry (pure data)

Add Muscle (1500), Monster Truck (4000), Demolisher (9000) with genuinely different stats to the existing `CARS` array. Pure data + tests only; nothing consumes the new cars yet, so this is behavior-preserving by construction.

**Files:**
- Modify: `app/games/crash-course/content/cars/index.ts:33-42` (the `CARS` array)
- Test: `app/games/crash-course/content/cars/__tests__/cars.test.ts`

**Interfaces:**
- Consumes: existing `CarDef`, `CarStats` (unchanged).
- Produces: `CARS` now has 4 entries with ids `rust-bucket`, `muscle`, `monster-truck`, `demolisher`. `getCar` / `STARTER_CAR_ID` unchanged.

- [ ] **Step 1: Add the failing tests for the new cars**

Add to `app/games/crash-course/content/cars/__tests__/cars.test.ts` inside the existing `describe("car registry", …)`:

```ts
  it("ships four cars in ascending price tiers", () => {
    const prices = CARS.map((c) => c.price);
    expect(prices).toEqual([0, 1500, 4000, 9000]);
    expect(CARS.map((c) => c.id)).toEqual([
      "rust-bucket",
      "muscle",
      "monster-truck",
      "demolisher",
    ]);
  });

  it("gives each paid car a genuinely different stat profile", () => {
    const muscle = getCar("muscle").stats;
    const monster = getCar("monster-truck").stats;
    const demolisher = getCar("demolisher").stats;
    // Muscle: fast + nimble, light. Monster: heavy + tough, less nimble.
    expect(muscle.topSpeed).toBeGreaterThan(getCar("rust-bucket").stats.topSpeed);
    expect(monster.mass).toBeGreaterThan(muscle.mass);
    expect(demolisher.mass).toBeGreaterThan(monster.mass);
    expect(demolisher.durability).toBeGreaterThan(monster.durability);
    expect(muscle.grip).toBeGreaterThan(monster.grip);
    // No two cars share an identical stat block.
    const blocks = new Set([muscle, monster, demolisher].map((s) => JSON.stringify(s)));
    expect(blocks.size).toBe(3);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/cars.test.ts`
Expected: FAIL — prices are `[0]`, ids are `["rust-bucket"]`.

- [ ] **Step 3: Add the three cars to `CARS`**

In `app/games/crash-course/content/cars/index.ts`, replace the `CARS` array body (keep `rust-bucket` first, exactly as it is) with:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/cars.test.ts`
Expected: PASS (all car-registry tests, including the pre-existing starter checks).

- [ ] **Step 5: Run the full per-task gate**

Run: `npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build`
Expected: all green / exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/games/crash-course/content/cars/index.ts app/games/crash-course/content/cars/__tests__/cars.test.ts
git commit -m "feat(crash-course): add muscle/monster/demolisher car tiers"
```

---

### Task 2: Pure ownership/purchase reducer

A React-free, Three-free reducer that owns the garage state machine: which cars are owned (starter always), which is selected, whether a car can be bought, and the pure `buy` transition. This is the tested core the server route and the client hook both build on.

**Files:**
- Create: `app/games/crash-course/content/cars/garage.ts`
- Test: `app/games/crash-course/content/cars/__tests__/garage.test.ts`

**Interfaces:**
- Consumes: `getCar`, `STARTER_CAR_ID`, `CarDef` from `./index` (Task 1).
- Produces:
  - `interface GarageState { owned: string[]; selected: string }`
  - `initialGarage(): GarageState`
  - `normalizeGarage(raw: Partial<GarageState> | null | undefined): GarageState`
  - `isOwned(state: GarageState, id: string): boolean`
  - `canAfford(car: CarDef, balance: number): boolean`
  - `buyable(state: GarageState, car: CarDef, balance: number): boolean`
  - `addOwned(state: GarageState, id: string): GarageState`
  - `selectCar(state: GarageState, id: string): GarageState`
  - `buy(state: GarageState, car: CarDef, balance: number): { state: GarageState; ok: boolean }`

- [ ] **Step 1: Write the failing tests**

Create `app/games/crash-course/content/cars/__tests__/garage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getCar, STARTER_CAR_ID } from "../index";
import {
  initialGarage,
  normalizeGarage,
  isOwned,
  canAfford,
  buyable,
  addOwned,
  selectCar,
  buy,
} from "../garage";

const muscle = getCar("muscle");
const starter = getCar(STARTER_CAR_ID);

describe("garage reducer", () => {
  it("starts owning only the starter, selected", () => {
    const g = initialGarage();
    expect(g.owned).toEqual([STARTER_CAR_ID]);
    expect(g.selected).toBe(STARTER_CAR_ID);
  });

  it("normalizes persisted data: starter is always owned", () => {
    const g = normalizeGarage({ owned: ["muscle"], selected: "muscle" });
    expect(isOwned(g, STARTER_CAR_ID)).toBe(true);
    expect(isOwned(g, "muscle")).toBe(true);
    expect(g.selected).toBe("muscle");
  });

  it("normalizes: drops unknown ids and falls selection back to starter", () => {
    const g = normalizeGarage({ owned: ["ghost-car"], selected: "ghost-car" });
    expect(g.owned).toEqual([STARTER_CAR_ID]);
    expect(g.selected).toBe(STARTER_CAR_ID);
  });

  it("normalizes null/undefined to the initial garage", () => {
    expect(normalizeGarage(null)).toEqual(initialGarage());
    expect(normalizeGarage(undefined)).toEqual(initialGarage());
  });

  it("canAfford is false for the free starter and unaffordable cars", () => {
    expect(canAfford(starter, 999999)).toBe(false); // price 0 is never "bought"
    expect(canAfford(muscle, 1499)).toBe(false);
    expect(canAfford(muscle, 1500)).toBe(true);
  });

  it("buyable requires not-owned AND affordable", () => {
    const g = initialGarage();
    expect(buyable(g, muscle, 1500)).toBe(true);
    expect(buyable(g, muscle, 1000)).toBe(false);
    expect(buyable(addOwned(g, "muscle"), muscle, 999999)).toBe(false);
  });

  it("buy adds the car and reports ok when affordable", () => {
    const { state, ok } = buy(initialGarage(), muscle, 2000);
    expect(ok).toBe(true);
    expect(isOwned(state, "muscle")).toBe(true);
  });

  it("buy is a no-op when unaffordable or already owned", () => {
    const poor = buy(initialGarage(), muscle, 100);
    expect(poor.ok).toBe(false);
    expect(isOwned(poor.state, "muscle")).toBe(false);

    const owned = addOwned(initialGarage(), "muscle");
    const again = buy(owned, muscle, 999999);
    expect(again.ok).toBe(false);
    expect(again.state).toBe(owned); // unchanged reference
  });

  it("selectCar only selects an owned car", () => {
    const g = addOwned(initialGarage(), "muscle");
    expect(selectCar(g, "muscle").selected).toBe("muscle");
    expect(selectCar(g, "demolisher").selected).toBe(STARTER_CAR_ID); // not owned → unchanged
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/garage.test.ts`
Expected: FAIL — cannot resolve `../garage`.

- [ ] **Step 3: Implement the pure reducer**

Create `app/games/crash-course/content/cars/garage.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/garage.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full per-task gate**

Run: `npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build`
Expected: all green / exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/games/crash-course/content/cars/garage.ts app/games/crash-course/content/cars/__tests__/garage.test.ts
git commit -m "feat(crash-course): pure garage ownership/purchase reducer"
```

---

### Task 3: Pure car-stat → handling mapper

Map a `CarDef`'s stats onto the handling numbers `Car.tsx` uses, so the physics reads from data. Behavior-preservation is enforced here by a test asserting `carHandling(starter)` equals today's `config.CAR` values exactly.

**Files:**
- Create: `app/games/crash-course/content/cars/handling.ts`
- Test: `app/games/crash-course/content/cars/__tests__/handling.test.ts`

**Interfaces:**
- Consumes: `CAR`, `IMPACT` from `../../config`; `getCar`, `STARTER_CAR_ID`, `CarDef` from `./index`.
- Produces:
  - `interface CarHandling { topSpeed: number; accel: number; steerRate: number; density: number; damageForce: number }`
  - `carHandling(car: CarDef): CarHandling`

- [ ] **Step 1: Write the failing tests**

Create `app/games/crash-course/content/cars/__tests__/handling.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CAR, IMPACT } from "../../../config";
import { getCar, STARTER_CAR_ID } from "../index";
import { carHandling } from "../handling";

describe("carHandling", () => {
  it("is behavior-preserving for the starter (equals config.CAR)", () => {
    const h = carHandling(getCar(STARTER_CAR_ID));
    expect(h.topSpeed).toBe(CAR.topSpeed); // 34
    expect(h.accel).toBe(CAR.accel); // 26
    expect(h.steerRate).toBe(CAR.steerRate); // grip 1 → unchanged
    expect(h.density).toBe(CAR.density); // mass 1 → unchanged
    expect(h.damageForce).toBe(IMPACT.carDamageForce); // durability ratio 1
  });

  it("scales steering by grip and density by mass", () => {
    const monster = getCar("monster-truck");
    const h = carHandling(monster);
    expect(h.steerRate).toBeCloseTo(CAR.steerRate * monster.stats.grip);
    expect(h.density).toBeCloseTo(CAR.density * monster.stats.mass);
  });

  it("raises the car-damage threshold with durability (tougher = harder to dent)", () => {
    const starterDur = getCar(STARTER_CAR_ID).stats.durability;
    const demolisher = getCar("demolisher");
    const h = carHandling(demolisher);
    expect(h.damageForce).toBeCloseTo(
      IMPACT.carDamageForce * (demolisher.stats.durability / starterDur),
    );
    expect(h.damageForce).toBeGreaterThan(IMPACT.carDamageForce);
  });

  it("passes topSpeed and accel straight through", () => {
    const muscle = getCar("muscle");
    const h = carHandling(muscle);
    expect(h.topSpeed).toBe(muscle.stats.topSpeed);
    expect(h.accel).toBe(muscle.stats.accel);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/handling.test.ts`
Expected: FAIL — cannot resolve `../handling`.

- [ ] **Step 3: Implement the mapper**

Create `app/games/crash-course/content/cars/handling.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/handling.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full per-task gate**

Run: `npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build`
Expected: all green / exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/games/crash-course/content/cars/handling.ts app/games/crash-course/content/cars/__tests__/handling.test.ts
git commit -m "feat(crash-course): pure car-stat → handling mapper"
```

---

### Task 4: `Car.tsx` + `Scene.tsx` consume the active `CarDef`

Thread a `car: CarDef` prop from `index.tsx` → `Scene` → `Car`, and make `Car` read handling from `carHandling(car)` instead of the hardcoded `CAR.*` / `IMPACT.carDamageForce`. In THIS task `index.tsx` passes a **constant starter** (`getCar(STARTER_CAR_ID)`), so the change is behavior-preserving and independently shippable; Task 7 swaps in the selected car. No unit test (R3F body) — gated by build + a documented playtest.

**Files:**
- Modify: `app/games/crash-course/Car.tsx` (import line 14; `CarProps` 48-54; signature 56; driving block 169-183; damage gate 226; RigidBody density 268)
- Modify: `app/games/crash-course/Scene.tsx` (`SceneProps` 64-72; destructure 74; `<Car>` 156; add `CarDef` import)
- Modify: `app/games/crash-course/index.tsx` (import; `<Scene>` props ~180)

**Interfaces:**
- Consumes: `carHandling`, `CarHandling` from `./content/cars/handling` (Task 3); `getCar`, `STARTER_CAR_ID`, `CarDef` from `./content/cars` (Task 1).
- Produces: `Car` and `Scene` each gain a required `car: CarDef` prop. `<Scene car={…}>` is now the way the active car reaches the physics body.

- [ ] **Step 1: Add the `car` prop and handling to `Car.tsx` imports and props**

In `app/games/crash-course/Car.tsx`, extend the config import (line 14) and add the car imports below it:

```ts
import { CAR, NITROUS, IMPACT, TRACK, CAR_FX_COOLDOWN_MS } from "./config";
import { carHandling } from "./content/cars/handling";
import type { CarDef } from "./content/cars";
```

Change `CarProps` (lines 48-54) to add `car`:

```ts
export interface CarProps {
  phase: Phase;
  hud: RunHud;
  onEnterCrash: () => void;
  armedAt: number;
  terrain: TerrainParams;
  car: CarDef;
}
```

Change the function signature (line 56) to destructure `car`:

```ts
export default function Car({ phase, hud, onEnterCrash, armedAt, terrain, car }: CarProps) {
```

- [ ] **Step 2: Derive handling once and apply it in the driving + damage code**

Immediately after the `phaseRef` line near the top of the component body, add:

```ts
  // Handling derived from the active car's stats. carHandling(starter) equals
  // config.CAR exactly, so the starter is behavior-preserving.
  const handling = useMemo(() => carHandling(car), [car]);
```

Add `useMemo` to the React import at the top of the file (it currently imports `Suspense, useEffect, useRef`):

```ts
import { Suspense, useEffect, useMemo, useRef } from "react";
```

In the driving block (lines 170-171) replace the `CAR.*` reads:

```ts
      const top = handling.topSpeed * (boost ? NITROUS.speedMult : 1);
      const accel = handling.accel * (boost ? NITROUS.accelMult : 1);
```

In the steering line (line 182) replace `CAR.steerRate` with `handling.steerRate`:

```ts
      b.setAngvel({ x: 0, y: steer * handling.steerRate * speedFactor * dir, z: 0 }, true);
```

In the damage gate (line 226) replace `IMPACT.carDamageForce` with `handling.damageForce`:

```ts
    if (mag < handling.damageForce || now < armedAt) return;
```

In the `<RigidBody>` props (line 268) replace `density={CAR.density}` with `density={handling.density}`:

```ts
      density={handling.density}
```

Leave every other `CAR.*` / `IMPACT.*` reference untouched (reverseSpeed, brake, steerSpeedRef, damping, spawn, the cosmetic impact-FX normalization, cooldowns) — those are not car-stat-driven in Phase 4.

- [ ] **Step 3: Thread `car` through `Scene.tsx`**

In `app/games/crash-course/Scene.tsx`, add the type import near the other content import (line 15):

```ts
import type { CarDef } from "./content/cars";
```

Add `car` to `SceneProps` (lines 64-72):

```ts
export interface SceneProps {
  phase: Phase;
  hud: RunHud;
  onDestroyed: (kind: PropKind) => void;
  onEnterCrash: () => void;
  runKey: number;
  armedAt: number;
  map: MapDef;
  car: CarDef;
}
```

Destructure it (line 74):

```ts
function Scene({ phase, hud, onDestroyed, onEnterCrash, runKey, armedAt, map, car }: SceneProps) {
```

Pass it to `<Car>` (line 156):

```ts
      <Car phase={phase} hud={hud} onEnterCrash={onEnterCrash} armedAt={armedAt} terrain={map.terrain} car={car} />
```

- [ ] **Step 4: Pass a constant starter from `index.tsx`**

In `app/games/crash-course/index.tsx`, add the import beside the other content imports (near line 19):

```ts
import { getCar, STARTER_CAR_ID } from "./content/cars";
```

Add the `car` prop to `<Scene>` (in the JSX around line 180-189):

```tsx
              <Scene
                key={runKey}
                phase={phase}
                hud={hud.current}
                onDestroyed={onDestroyed}
                onEnterCrash={enterCrash}
                runKey={runKey}
                armedAt={driveStartMs === null ? Infinity : driveStartMs + ARM_GRACE_MS}
                map={map}
                car={getCar(STARTER_CAR_ID)}
              />
```

- [ ] **Step 5: Typecheck, lint, build**

Run: `npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm test && npm run build`
Expected: all green / exit 0. (`memo(Scene)` still valid; `car={getCar(STARTER_CAR_ID)}` is a stable module-constant reference, so it does not defeat Scene's memoization.)

- [ ] **Step 6: Playtest — behavior-preservation on Downtown**

Run: `npm run dev`, open Crash Course, select Downtown, press START. Confirm the starter drives, steers, boosts, crashes, and dents exactly as on `main` (same top speed, same turn rate, same damage feel). This is the behavior-preservation gate; there is no unit test for the R3F body.

- [ ] **Step 7: Commit**

```bash
git add app/games/crash-course/Car.tsx app/games/crash-course/Scene.tsx app/games/crash-course/index.tsx
git commit -m "feat(crash-course): drive the active CarDef via carHandling (starter behavior-preserving)"
```

---

### Task 5: Server-authoritative garage route (spend + persist ownership)

Add the one platform-touching piece: a route that reads the garage, and on POST either spends real B-Tokens through `Economy.spend(price, "purchase", "crash-course")` and records the car as owned, or changes the selection. Prices come from the pure registry (never the client). Ownership persists via the server `SaveApi`, keyed by the same account/guest id as the balance.

**Files:**
- Create: `app/api/games/crash-course/garage/route.ts`

**Interfaces:**
- Consumes: `getServerEconomy` (`@/lib/platform/server/getServerEconomy`) → `{ economy, save }`; `getCar` (`@/app/games/crash-course/content/cars`); `normalizeGarage`, `addOwned`, `selectCar`, `initialGarage`, `GarageState` (`@/app/games/crash-course/content/cars/garage`).
- Produces: HTTP endpoint `/api/games/crash-course/garage`.
  - `GET` → `{ owned: string[]; selected: string; balance: number }`
  - `POST { action: "buy" | "select"; carId: string }` → `{ ok: boolean; reason?: "insufficient" | "not_owned" | "invalid_car"; owned: string[]; selected: string; balance: number }`

- [ ] **Step 1: Implement the route**

Create `app/api/games/crash-course/garage/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";
import { getCar } from "@/app/games/crash-course/content/cars";
import {
  normalizeGarage,
  addOwned,
  selectCar,
  initialGarage,
  type GarageState,
} from "@/app/games/crash-course/content/cars/garage";
import type { SaveApi } from "@/lib/platform/save";

const GAME_ID = "crash-course";
const STATE_KEY = "garage";

async function loadGarage(save: SaveApi): Promise<GarageState> {
  const raw = await save.getState<GarageState>(GAME_ID, STATE_KEY);
  return normalizeGarage(raw ?? initialGarage());
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : "economy error";
  if (message.includes("not implemented")) {
    return NextResponse.json({ error: "mongo_not_ready" }, { status: 503 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const { economy, save } = await getServerEconomy();
    const [garage, balance] = await Promise.all([loadGarage(save), economy.getBalance()]);
    return NextResponse.json({ ...garage, balance });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  let body: { action?: string; carId?: string };
  try {
    body = (await req.json()) as { action?: string; carId?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const action = body.action;
  const carId = typeof body.carId === "string" ? body.carId : "";
  if (!carId || (action !== "buy" && action !== "select")) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const { economy, save } = await getServerEconomy();
    let garage = await loadGarage(save);

    if (action === "select") {
      if (!garage.owned.includes(carId)) {
        return NextResponse.json(
          { ok: false, reason: "not_owned", ...garage, balance: await economy.getBalance() },
        );
      }
      garage = selectCar(garage, carId);
      await save.setState(GAME_ID, STATE_KEY, garage);
      return NextResponse.json({ ok: true, ...garage, balance: await economy.getBalance() });
    }

    // action === "buy" — price is taken from the trusted registry, never the client.
    const car = getCar(carId);
    if (car.id !== carId) {
      // getCar fell back to the starter → unknown id.
      return NextResponse.json(
        { ok: false, reason: "invalid_car", ...garage, balance: await economy.getBalance() },
        { status: 400 },
      );
    }
    // Already owned (or the free starter): idempotent no-op, never charged twice.
    if (garage.owned.includes(carId) || car.price <= 0) {
      garage = addOwned(garage, carId);
      await save.setState(GAME_ID, STATE_KEY, garage);
      return NextResponse.json({ ok: true, ...garage, balance: await economy.getBalance() });
    }

    const paid = await economy.spend(car.price, "purchase", GAME_ID);
    if (!paid) {
      return NextResponse.json(
        { ok: false, reason: "insufficient", ...garage, balance: await economy.getBalance() },
      );
    }
    garage = addOwned(garage, carId);
    await save.setState(GAME_ID, STATE_KEY, garage);
    return NextResponse.json({ ok: true, ...garage, balance: await economy.getBalance() });
  } catch (err) {
    return fail(err);
  }
}
```

- [ ] **Step 2: Manual smoke test the route (dev server)**

Run: `npm run dev`, then in a second terminal:

```bash
curl -s http://localhost:3000/api/games/crash-course/garage
```
Expected: `{"owned":["rust-bucket"],"selected":"rust-bucket","balance":<n>}`.

```bash
curl -s -X POST http://localhost:3000/api/games/crash-course/garage \
  -H 'Content-Type: application/json' -d '{"action":"buy","carId":"muscle"}'
```
Expected (guest / 0 balance): `{"ok":false,"reason":"insufficient",...,"balance":0}` — proving the spend gate is real. (A signed-in account with ≥1500 tokens returns `"ok":true` and a balance reduced by 1500.)

- [ ] **Step 3: Typecheck, lint (both trees), test, build**

Run: `npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npx eslint app/api/games/crash-course --max-warnings=0 && npm test && npm run build`
Expected: all green / exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/games/crash-course/garage/route.ts
git commit -m "feat(crash-course): server garage route — spend B-Tokens + persist ownership"
```

---

### Task 6: `useGarage` client hook

A hook that loads the garage from the route on mount, exposes `buy`/`select`, and keeps the shop balance live — updating from POST responses and reflecting run earnings via `balanceBus`. On buy it publishes the new balance with `notifyBalanceChanged` so the shell `TokenBalance` chrome stays in step.

**Files:**
- Create: `app/games/crash-course/useGarage.ts`

**Interfaces:**
- Consumes: `subscribeBalance`, `notifyBalanceChanged` (`@/lib/platform/balanceBus`); `initialGarage`, `normalizeGarage`, `GarageState` (`./content/cars/garage`).
- Produces:
  - `interface UseGarageResult { owned: string[]; selected: string; balance: number; buy: (carId: string) => Promise<boolean>; select: (carId: string) => Promise<void> }`
  - `useGarage(): UseGarageResult`

- [ ] **Step 1: Implement the hook**

Create `app/games/crash-course/useGarage.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeBalance, notifyBalanceChanged } from "@/lib/platform/balanceBus";
import { initialGarage, normalizeGarage, type GarageState } from "./content/cars/garage";

const ENDPOINT = "/api/games/crash-course/garage";

interface GarageResponse extends GarageState {
  balance: number;
  ok?: boolean;
  reason?: string;
}

export interface UseGarageResult {
  owned: string[];
  selected: string;
  balance: number;
  /** Returns true when the purchase went through. */
  buy: (carId: string) => Promise<boolean>;
  select: (carId: string) => Promise<void>;
}

/**
 * Client view of the server-authoritative garage. The route owns the truth
 * (spend + ownership); this hook mirrors it and keeps the shop balance live as
 * runs earn tokens (via balanceBus) and as purchases spend them.
 */
export function useGarage(): UseGarageResult {
  const [state, setState] = useState<GarageState>(initialGarage());
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(ENDPOINT, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as GarageResponse;
        if (!active) return;
        setState(normalizeGarage(data));
        if (typeof data.balance === "number") setBalance(data.balance);
      } catch {
        // Offline: keep the starter-only defaults so the intro still renders.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Earnings from a completed run are published here by useCartridge; mirror
  // them so the shop can afford newly-earned tokens without a reload.
  useEffect(() => subscribeBalance(setBalance), []);

  const buy = useCallback(async (carId: string): Promise<boolean> => {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "buy", carId }),
      });
      const data = (await res.json()) as GarageResponse;
      setState(normalizeGarage(data));
      if (typeof data.balance === "number") {
        setBalance(data.balance);
        notifyBalanceChanged(data.balance); // keep shell chrome in step
      }
      return Boolean(data.ok);
    } catch {
      return false;
    }
  }, []);

  const select = useCallback(async (carId: string): Promise<void> => {
    // Optimistic: only if already owned (the route enforces this too).
    setState((s) => (s.owned.includes(carId) ? { ...s, selected: carId } : s));
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "select", carId }),
      });
      const data = (await res.json()) as GarageResponse;
      setState(normalizeGarage(data));
    } catch {
      // Keep the optimistic selection; it re-syncs on next load.
    }
  }, []);

  return { owned: state.owned, selected: state.selected, balance, buy, select };
}
```

- [ ] **Step 2: Typecheck, lint, test, build**

Run: `npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm test && npm run build`
Expected: all green / exit 0. (No unit test: this is thin fetch/`useState` glue over the tested reducer and tested route; its behavior is exercised by the playtest in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add app/games/crash-course/useGarage.ts
git commit -m "feat(crash-course): useGarage hook (load/buy/select + live balance)"
```

---

### Task 7: Garage/shop UI + wire the selected car into gameplay

Render a garage panel in the intro screen showing every car as owned / buyable / unaffordable, with BUY (spends) and SELECT (owned only) actions and the live balance. Then swap `index.tsx`'s constant starter for the selected car so choosing a car actually changes the drive on the next run.

**Files:**
- Create: `app/games/crash-course/Garage.tsx`
- Modify: `app/games/crash-course/index.tsx` (use `useGarage`; render `<Garage>` in the intro; pass `getCar(selected)` to `<Scene>`)

**Interfaces:**
- Consumes: `CARS`, `getCar`, `type CarDef` (`./content/cars`); `buyable`, `isOwned` (`./content/cars/garage`); `useGarage`, `UseGarageResult` (`./useGarage`).
- Produces: `<Garage state={UseGarageResult} />` intro panel; `index.tsx` now drives the selected car.

- [ ] **Step 1: Implement the Garage panel**

Create `app/games/crash-course/Garage.tsx`:

```tsx
"use client";

import { CARS } from "./content/cars";
import { buyable, isOwned } from "./content/cars/garage";
import type { UseGarageResult } from "./useGarage";

/**
 * Intro-screen shop. Each car is one of: SELECTED (active), OWNED (click to
 * select), BUYABLE (afford → BUY), or LOCKED (can't afford, greyed). Buying
 * spends real B-Tokens through the server route; selection is free.
 */
export default function Garage({ state }: { state: UseGarageResult }) {
  const { owned, selected, balance, buy, select } = state;
  const gstate = { owned, selected };

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2 font-[family-name:var(--font-mono)] text-sm">
        <span className="text-[var(--muted)]">GARAGE</span>
        <span>
          <span className="text-[var(--muted)]">B </span>
          <span className="text-[var(--accent)]">{balance.toLocaleString()}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {CARS.map((car) => {
          const own = isOwned(gstate, car.id);
          const active = selected === car.id;
          const canBuy = buyable(gstate, car, balance);
          const locked = !own && !canBuy;
          return (
            <div
              key={car.id}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded border font-[family-name:var(--font-mono)] text-xs ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)]"
              } ${locked ? "opacity-45" : ""}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: car.color }}
                />
                <span className="text-[var(--foreground)]">{car.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[var(--muted)]">
                  SPD {car.stats.topSpeed} · MAS {car.stats.mass} · DUR {car.stats.durability}
                </span>
                {active ? (
                  <span className="px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--background)]">
                    ACTIVE
                  </span>
                ) : own ? (
                  <button
                    onClick={() => void select(car.id)}
                    className="pixel-edge px-2 py-0.5 rounded bg-[var(--crt-green)] text-[var(--background)]"
                  >
                    SELECT
                  </button>
                ) : (
                  <button
                    disabled={!canBuy}
                    onClick={() => void buy(car.id)}
                    className={`pixel-edge px-2 py-0.5 rounded ${
                      canBuy
                        ? "bg-[var(--accent-hot)] text-[var(--background)]"
                        : "bg-transparent border border-[var(--border)] text-[var(--muted)] cursor-not-allowed"
                    }`}
                  >
                    BUY {car.price.toLocaleString()}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `useGarage` + `<Garage>` + the selected car into `index.tsx`**

In `app/games/crash-course/index.tsx`, add the imports (beside the Task-4 car import):

```ts
import { getCar } from "./content/cars";
import { useGarage } from "./useGarage";
import Garage from "./Garage";
```

(If Task 4 left `import { getCar, STARTER_CAR_ID } from "./content/cars";`, drop the now-unused `STARTER_CAR_ID` to keep eslint clean.)

Inside `CrashCourse()`, after the `useCartridge` line, add:

```ts
  const garage = useGarage();
  const activeCar = getCar(garage.selected);
```

Change the `<Scene>` `car` prop from the constant starter to the selected car:

```tsx
                car={activeCar}
```

In the intro block (the `phase === "intro"` panel), insert the garage between the map picker `<div>` and the START button:

```tsx
            <div className="mb-3 flex justify-center">
              <Garage state={garage} />
            </div>
```

- [ ] **Step 3: Typecheck, lint, test, build**

Run: `npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm test && npm run build`
Expected: all green / exit 0. (`activeCar` changes reference when selection changes; during intro that only re-renders Scene while physics is paused, and the RigidBody density applies on the next START remount via `key={runKey}`.)

- [ ] **Step 4: Playtest — the full shop loop**

Run: `npm run dev`. Signed in with enough tokens (earn some by crashing, or seed a signed-in account):
  1. Intro shows GARAGE with the starter ACTIVE and 3 buyable cars; unaffordable ones are greyed/disabled.
  2. BUY an affordable car → balance drops by its price, the shell token chrome updates, the row flips to SELECT.
  3. SELECT it → row shows ACTIVE.
  4. Press START → the selected car drives to its stats (e.g. Monster Truck plows heavier, steers slower).
  5. Reload the page → the bought car is still owned and still selected (starter still owned).
  6. Select the starter, START on Downtown → identical to today (behavior-preserving).
  As a guest (0 balance): all paid cars stay LOCKED; only the starter is ACTIVE.

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/Garage.tsx app/games/crash-course/index.tsx
git commit -m "feat(crash-course): garage/shop UI + drive the selected car"
```

---

## Self-Review

**Spec coverage:**
- 3 new cars in price tiers with different stats → Task 1. ✅
- Garage/shop UI (owned vs buyable, buy spends B-Tokens, select owned, reflects balance, unaffordable greyed) → Task 7 (UI) + Task 6 (hook) + Task 5 (spend). ✅
- Ownership + selection persist across reloads, starter always owned → Task 5 (`SaveApi` + `normalizeGarage` forcing starter) verified in Task 7 playtest step 5. ✅
- `Car.tsx` consumes the active `CarDef` (mass/topSpeed/accel/grip to handling; mass → crash momentum via density; durability → damage threshold) instead of `config.CAR` → Tasks 3 + 4. ✅
- Downtown + starter behavior-preserving → asserted by `handling.test.ts` (Task 3) and playtested (Tasks 4 & 7). ✅
- Pure, unit-tested cores (ownership/purchase reducer; car-stat mapping) → Tasks 2 & 3. ✅
- `durability` mapping decision (feeds damage-force threshold; no wreck-out mechanic) → Global Constraints + Task 3. ✅
- Real economy path (server spend + persisted garage) vs fallback → Platform reality + Task 5. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code step shows the actual code. ✅

**Type consistency:** `GarageState { owned: string[]; selected: string }` is identical across `garage.ts`, the route, and `useGarage.ts`. `CarHandling` fields (`topSpeed/accel/steerRate/density/damageForce`) match between `handling.ts` and their use in `Car.tsx`. `carHandling`, `carHandling(car)`, `buy`, `buyable`, `isOwned`, `addOwned`, `selectCar`, `normalizeGarage`, `initialGarage`, `useGarage`, `UseGarageResult` are named identically everywhere they appear. The route's `POST` response shape (`ok`, `reason`, `owned`, `selected`, `balance`) matches `GarageResponse` in the hook. ✅

**Known limitations (acceptable for Phase 4, flagged):**
- Car `color`/`model` art: only the procedural fallback body would show `color`; the shared GLB is not retinted and no per-car GLB is wired. Left as art follow-up (the `model?` field already anticipates it).
- Selection takes effect on the **next** run (density is set at RigidBody mount; the scene remounts on START via `key={runKey}`), not mid-run. Documented in Task 7 Step 3.
- There is no idempotency key on buy; the server-persisted owned set **is** the idempotency guard (a repeat buy of an owned car is a no-op, never re-charged), so a double-click cannot double-spend.
