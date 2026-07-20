# Crash Course Phase 3 — Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 free-select maps (Downtown + Hills + Highway + Canyon) with per-map terrain, theme, and lighting, plus an intro-screen map picker — while Downtown stays pixel-identical to today.

**Architecture:** Maps are pure data (`content/maps/*.ts`) validated by unit tests; the map registry and the terrain sampler stay React/Three-free. `Scene.tsx` reads the active `MapDef` to drive lights, ground colour, and terrain, and anchors every ground-object to the terrain surface via the pure `heightAt` sampler. Because Downtown keeps `amplitude 0` (so `heightAt` returns `0` everywhere) and its theme copies today's hardcoded values verbatim, every task is behavior-preserving on Downtown.

**Tech Stack:** `@react-three/rapier`, `@react-three/fiber`, `three`, React, Vitest, TypeScript, Next.js.

## Global Constraints

- **Pure modules stay pure:** the maps registry (`content/maps/index.ts`) and the terrain sampler (`engine/terrainSampler.ts`) import **no React and no Three**, and `engine/` stays content-agnostic (no imports of `content/` or `structures.ts`). Content may depend on engine, never the reverse.
- **Behavior-preserving on Downtown at every task:** `amplitude 0` + Downtown's theme numbers must equal today's look/feel exactly. Downtown's terrain params, `spawn`, `pileZ`, and `trackWidth` do not change.
- **Per-task gate — all four must pass before the task's commit:**
  - `npm test` — full suite green.
  - `npx tsc --noEmit` — clean.
  - `npx eslint app/games/crash-course --max-warnings=0` — clean.
  - `npm run build` — exit 0.
- **Branch:** `feat/crash-course-engine-expansion`. Commit after each task.
- **Automated coverage lives on the pure data + pure helpers** (maps registry, terrain anchoring, `mapChoices`). 3D feel, lighting, and visual placement are validated by **playtest**, not unit tests.
- **Folds in Phase 2 FOLLOW-UPs:** the case-only filename collision (`engine/terrain.ts` vs `engine/Terrain.tsx`) is resolved in Task 1; the `groundColor` theming gap is resolved in Tasks 2 & 4. The optional cosmetic "road strip" and the Phase-5 catalog SIZE reconciliation are explicitly out of scope here.

---

## File Structure

**Rename (Task 1):**
- `app/games/crash-course/engine/terrain.ts` → `app/games/crash-course/engine/terrainSampler.ts` (unchanged contents; pure sampler).
- `app/games/crash-course/engine/__tests__/terrain.test.ts` → `app/games/crash-course/engine/__tests__/terrainSampler.test.ts` (import path updated).

**Create (Task 2):**
- `app/games/crash-course/content/maps/hills.ts` — gentle rolling terrain, green/warm theme.
- `app/games/crash-course/content/maps/highway.ts` — near-flat long straight, dusk grey/blue theme, wider/longer.
- `app/games/crash-course/content/maps/canyon.ts` — high-amplitude rock, narrow, orange/red theme.

**Create (Task 3):**
- `app/games/crash-course/__tests__/structures.test.ts` — tests the pure `anchorToTerrain` helper.

**Modify:**
- `app/games/crash-course/engine/Terrain.tsx` (Task 1) — import from `./terrainSampler`.
- `app/games/crash-course/Car.tsx` (Task 1) — import from `./engine/terrainSampler`.
- `app/games/crash-course/Scene.tsx` (Task 1 import fix; Task 3 anchoring; Task 4 theme lights).
- `app/games/crash-course/content/maps/index.ts` (Task 2 `MapTheme`/`MAPS`; Task 5 `mapChoices`).
- `app/games/crash-course/content/maps/downtown.ts` (Task 2 — theme enriched with today's exact values).
- `app/games/crash-course/content/maps/__tests__/maps.test.ts` (Task 2 four-map coverage; Task 5 `mapChoices`).
- `app/games/crash-course/structures.ts` (Task 3 — pure `anchorToTerrain`).
- `app/games/crash-course/index.tsx` (Task 5 — `selectedMapId` state + picker UI).

---

### Task 1: Resolve the case-only filename collision (pure refactor)

The sampler `engine/terrain.ts` and the component `engine/Terrain.tsx` differ only in case, which forced the ugly explicit `"./engine/Terrain.tsx"` import in `Scene.tsx`. Rename the sampler to `terrainSampler.ts`, repoint its three importers, and drop the extension from Scene's component import. No logic changes — the existing (renamed) sampler test is the safety net.

**Files:**
- Rename: `app/games/crash-course/engine/terrain.ts` → `app/games/crash-course/engine/terrainSampler.ts`
- Rename: `app/games/crash-course/engine/__tests__/terrain.test.ts` → `app/games/crash-course/engine/__tests__/terrainSampler.test.ts`
- Modify: `app/games/crash-course/engine/Terrain.tsx:7`
- Modify: `app/games/crash-course/Car.tsx:22`
- Modify: `app/games/crash-course/Scene.tsx:9`

**Interfaces:**
- Consumes: nothing new.
- Produces: module `./engine/terrainSampler` exporting the unchanged `heightAt`, `normalAt`, `buildHeightfield`, `TerrainParams`, `Vec3`, `Heightfield`. The physical file `engine/Terrain.tsx` (the component) is now importable extensionless as `./engine/Terrain`.

- [ ] **Step 1: Rename the sampler and its test with git (preserves history)**

```bash
git mv app/games/crash-course/engine/terrain.ts app/games/crash-course/engine/terrainSampler.ts
git mv app/games/crash-course/engine/__tests__/terrain.test.ts app/games/crash-course/engine/__tests__/terrainSampler.test.ts
```

- [ ] **Step 2: Repoint the renamed test's import**

In `app/games/crash-course/engine/__tests__/terrainSampler.test.ts`, change line 2:

```ts
import { heightAt, normalAt, buildHeightfield, type TerrainParams } from "../terrainSampler";
```

- [ ] **Step 3: Repoint `Terrain.tsx`**

In `app/games/crash-course/engine/Terrain.tsx`, change line 7:

```ts
import { buildHeightfield, heightAt, type TerrainParams } from "./terrainSampler";
```

- [ ] **Step 4: Repoint `Car.tsx`**

In `app/games/crash-course/Car.tsx`, change line 22:

```ts
import { heightAt, normalAt, type TerrainParams } from "./engine/terrainSampler";
```

- [ ] **Step 5: Drop the `.tsx` workaround in `Scene.tsx`**

In `app/games/crash-course/Scene.tsx`, change line 9 from the explicit-extension import back to extensionless (now unambiguous):

```ts
import { Terrain } from "./engine/Terrain";
```

- [ ] **Step 6: Prove no stale references to the old module name remain**

Run: `git grep -n "engine/terrain\"\|\"\./terrain\"\|\"\.\./terrain\"\|Terrain\.tsx" -- app/games/crash-course`
Expected: no matches (all importers now say `terrainSampler` / `./engine/Terrain`).

- [ ] **Step 7: Run the renamed sampler test — must still pass (refactor is behavior-preserving)**

Run: `npx vitest run app/games/crash-course/engine/__tests__/terrainSampler.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Full gate**

Run each and confirm:
- `npm test` → all green.
- `npx tsc --noEmit` → clean (no more case-collision workaround).
- `npx eslint app/games/crash-course --max-warnings=0` → clean.
- `npm run build` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add app/games/crash-course/engine/terrainSampler.ts \
        app/games/crash-course/engine/__tests__/terrainSampler.test.ts \
        app/games/crash-course/engine/Terrain.tsx \
        app/games/crash-course/Car.tsx \
        app/games/crash-course/Scene.tsx
git commit -m "refactor(crash-course): rename terrain.ts -> terrainSampler.ts to kill case collision"
```

---

### Task 2: Enrich `MapDef` theme + add Hills, Highway, Canyon

Extend `MapTheme` with `groundColor` and light params, backfill Downtown with today's exact values (behavior-preserving), and add three distinct maps. Nothing renders differently yet (Scene still uses its hardcoded lights until Task 4) — this task is pure data plus its tests.

**Files:**
- Modify: `app/games/crash-course/content/maps/index.ts`
- Modify: `app/games/crash-course/content/maps/downtown.ts`
- Create: `app/games/crash-course/content/maps/hills.ts`
- Create: `app/games/crash-course/content/maps/highway.ts`
- Create: `app/games/crash-course/content/maps/canyon.ts`
- Modify (test): `app/games/crash-course/content/maps/__tests__/maps.test.ts`

**Interfaces:**
- Consumes: `MapDef` shape from the registry.
- Produces:
  - Extended `interface MapTheme { background; fogNear; fogFar; groundColor: string; sunColor: string; sunIntensity: number; ambientIntensity: number; hemiSky: string; hemiGround: string; hemiIntensity: number }`.
  - `MAPS: MapDef[]` = `[downtown, hills, highway, canyon]`.
  - `getMap(id)` resolves each id and falls back to `DEFAULT_MAP_ID`.

- [ ] **Step 1: Write the failing test — four maps + theme/terrain invariants**

Replace the contents of `app/games/crash-course/content/maps/__tests__/maps.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_ID, getMap, MAPS } from "../index";

describe("map registry", () => {
  it("has the downtown default", () => {
    expect(getMap(DEFAULT_MAP_ID).id).toBe("downtown");
  });

  it("falls back to the default for an unknown id", () => {
    expect(getMap("nope").id).toBe(DEFAULT_MAP_ID);
  });

  it("ships all four maps in registry order with unique ids", () => {
    const ids = MAPS.map((m) => m.id);
    expect(ids).toEqual(["downtown", "hills", "highway", "canyon"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every map by its own id", () => {
    for (const m of MAPS) {
      expect(getMap(m.id).id).toBe(m.id);
    }
  });

  it("keeps downtown flat + today's coordinates (behavior-preserving)", () => {
    const m = getMap("downtown");
    expect(m.terrain.amplitude).toBe(0);
    expect(m.pileZ).toBe(-66);
    expect(m.spawn).toEqual([0, 0.75, 8]);
    expect(m.trackWidth).toBe(34);
  });

  it("keeps downtown's theme equal to today's hardcoded scene values", () => {
    const t = getMap("downtown").theme;
    expect(t.background).toBe("#2a3f6b");
    expect(t.fogNear).toBe(65);
    expect(t.fogFar).toBe(175);
    expect(t.groundColor).toBe("#26331f"); // Terrain's old default color
    expect(t.ambientIntensity).toBe(0.55);
    expect(t.sunColor).toBe("#fff2e0");
    expect(t.sunIntensity).toBe(1.8);
    expect(t.hemiSky).toBe("#bcd8ff");
    expect(t.hemiGround).toBe("#3a2e22");
    expect(t.hemiIntensity).toBe(0.8);
  });

  it("every map carries a complete theme + terrain + layout", () => {
    for (const m of MAPS) {
      expect(m.name.length).toBeGreaterThan(0);
      for (const hex of [
        m.theme.background,
        m.theme.groundColor,
        m.theme.sunColor,
        m.theme.hemiSky,
        m.theme.hemiGround,
      ]) {
        expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      expect(m.theme.fogFar).toBeGreaterThan(m.theme.fogNear);
      expect(m.theme.ambientIntensity).toBeGreaterThan(0);
      expect(m.theme.sunIntensity).toBeGreaterThan(0);
      expect(m.theme.hemiIntensity).toBeGreaterThan(0);
      expect(m.terrain.amplitude).toBeGreaterThanOrEqual(0);
      expect(m.terrain.frequency).toBeGreaterThan(0);
      expect(m.trackWidth).toBeGreaterThan(0);
      expect(m.pileZ).toBeLessThan(0);
    }
  });

  it("gives the three new maps distinct, non-flat terrain", () => {
    const others = ["hills", "highway", "canyon"];
    for (const id of others) {
      expect(getMap(id).terrain.amplitude).toBeGreaterThan(0);
    }
    const amps = others.map((id) => getMap(id).terrain.amplitude);
    expect(new Set(amps).size).toBe(3); // no two are copies
  });

  it("makes canyon narrower + rougher than the highway straight", () => {
    const canyon = getMap("canyon");
    const highway = getMap("highway");
    expect(canyon.trackWidth).toBeLessThan(highway.trackWidth);
    expect(canyon.terrain.amplitude).toBeGreaterThan(highway.terrain.amplitude);
    expect(highway.trackWidth).toBeGreaterThanOrEqual(getMap("downtown").trackWidth);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/games/crash-course/content/maps/__tests__/maps.test.ts`
Expected: FAIL — `hills`/`highway`/`canyon` unknown (resolve to downtown), and `theme.groundColor` etc. are `undefined`.

- [ ] **Step 3: Extend `MapTheme` in the registry**

In `app/games/crash-course/content/maps/index.ts`, replace the `MapTheme` interface (lines 8-12) with:

```ts
export interface MapTheme {
  /** Sky + fog colour (hex). */
  background: string;
  fogNear: number;
  fogFar: number;
  /** Terrain mesh colour (hex). */
  groundColor: string;
  /** Key/sun directional light. */
  sunColor: string;
  sunIntensity: number;
  /** Flat fill ambient intensity. */
  ambientIntensity: number;
  /** Hemisphere light: sky tint, ground tint, intensity. */
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
}
```

- [ ] **Step 4: Register the new maps**

In `app/games/crash-course/content/maps/index.ts`, update the imports (line 6) and the `MAPS` array (line 32):

```ts
import { downtown } from "./downtown";
import { hills } from "./hills";
import { highway } from "./highway";
import { canyon } from "./canyon";
```

```ts
export const MAPS: MapDef[] = [downtown, hills, highway, canyon];
```

- [ ] **Step 5: Backfill Downtown's theme with today's exact scene values**

Replace `app/games/crash-course/content/maps/downtown.ts` with:

```ts
/**
 * Downtown — today's track, encoded as data. Flat (amplitude 0) so it stays a
 * pure refactor; the theme numbers copy the values that were hardcoded in
 * Scene.tsx (ambient 0.55, hemi #bcd8ff/#3a2e22 @0.8, sun #fff2e0 @1.8) and
 * Terrain's default groundColor (#26331f), so driving Downtown looks/feels
 * identical to before the theme migration.
 */
import type { MapDef } from "./index";

export const downtown: MapDef = {
  id: "downtown",
  name: "Downtown Demo",
  theme: {
    background: "#2a3f6b",
    fogNear: 65,
    fogFar: 175,
    groundColor: "#26331f",
    sunColor: "#fff2e0",
    sunIntensity: 1.8,
    ambientIntensity: 0.55,
    hemiSky: "#bcd8ff",
    hemiGround: "#3a2e22",
    hemiIntensity: 0.8,
  },
  terrain: { seed: 1, amplitude: 0, frequency: 0.03 },
  spawn: [0, 0.75, 8],
  pileZ: -66,
  trackWidth: 34,
};
```

- [ ] **Step 6: Create Hills — gentle rolling, green/warm**

Create `app/games/crash-course/content/maps/hills.ts`:

```ts
/**
 * Rolling Hills — gentle swells the car crests and drifts over. Moderate
 * amplitude/frequency so the ride is bouncy, never a wall. Warm midday-green
 * palette.
 */
import type { MapDef } from "./index";

export const hills: MapDef = {
  id: "hills",
  name: "Rolling Hills",
  theme: {
    background: "#8fb4d6",
    fogNear: 70,
    fogFar: 190,
    groundColor: "#3f6b2e",
    sunColor: "#fff0d0",
    sunIntensity: 2.0,
    ambientIntensity: 0.6,
    hemiSky: "#cfe8ff",
    hemiGround: "#4a3a24",
    hemiIntensity: 0.85,
  },
  terrain: { seed: 11, amplitude: 3.5, frequency: 0.045 },
  spawn: [0, 0.75, 8],
  pileZ: -66,
  trackWidth: 34,
};
```

- [ ] **Step 7: Create Highway — near-flat long straight, dusk grey/blue, wider/longer**

Create `app/games/crash-course/content/maps/highway.ts`:

```ts
/**
 * Sunset Highway — a wide, mostly flat straight (amplitude ~1) that runs long,
 * so nitro chains build real speed. Cool dusk grey/blue palette with a low
 * warm sun.
 */
import type { MapDef } from "./index";

export const highway: MapDef = {
  id: "highway",
  name: "Sunset Highway",
  theme: {
    background: "#3b4a63",
    fogNear: 80,
    fogFar: 220,
    groundColor: "#2b3038",
    sunColor: "#ffcf9a",
    sunIntensity: 1.6,
    ambientIntensity: 0.5,
    hemiSky: "#9fb0d0",
    hemiGround: "#2a2a30",
    hemiIntensity: 0.7,
  },
  terrain: { seed: 5, amplitude: 1, frequency: 0.02 },
  spawn: [0, 0.75, 8],
  pileZ: -84,
  trackWidth: 40,
};
```

- [ ] **Step 8: Create Canyon — high amplitude, narrow, orange/red rock**

Create `app/games/crash-course/content/maps/canyon.ts`:

```ts
/**
 * Red Canyon — tall, rough rock (amplitude ~7) squeezed into a narrow run.
 * Big crests launch the car; the tight width makes lining up the pile hard.
 * Hot orange/red desert palette.
 */
import type { MapDef } from "./index";

export const canyon: MapDef = {
  id: "canyon",
  name: "Red Canyon",
  theme: {
    background: "#c46a3a",
    fogNear: 55,
    fogFar: 160,
    groundColor: "#8a3f22",
    sunColor: "#ffd9a0",
    sunIntensity: 2.1,
    ambientIntensity: 0.5,
    hemiSky: "#e8a86a",
    hemiGround: "#4a1f12",
    hemiIntensity: 0.75,
  },
  terrain: { seed: 23, amplitude: 7, frequency: 0.06 },
  spawn: [0, 0.75, 8],
  pileZ: -60,
  trackWidth: 26,
};
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run app/games/crash-course/content/maps/__tests__/maps.test.ts`
Expected: PASS.

- [ ] **Step 10: Full gate**

- `npm test` → green. `npx tsc --noEmit` → clean. `npx eslint app/games/crash-course --max-warnings=0` → clean. `npm run build` → exit 0.

- [ ] **Step 11: Commit**

```bash
git add app/games/crash-course/content/maps/index.ts \
        app/games/crash-course/content/maps/downtown.ts \
        app/games/crash-course/content/maps/hills.ts \
        app/games/crash-course/content/maps/highway.ts \
        app/games/crash-course/content/maps/canyon.ts \
        app/games/crash-course/content/maps/__tests__/maps.test.ts
git commit -m "feat(crash-course): enrich MapDef theme + add hills/highway/canyon maps"
```

---

### Task 3: Anchor scene structures to the terrain surface

Every ground-anchored object (destructible props/junk cars, ramps, buildings) must sit ON the terrain by adding `heightAt(map.terrain, x, z)` to its Y. Put the reusable lift in a **pure, tested** helper `anchorToTerrain` in `structures.ts`; anchor ramps/buildings inline in Scene with the same pure `heightAt`. On Downtown (`amplitude 0`) `heightAt === 0`, so nothing moves — behavior-preserving. Boundary walls and ground decals (lane marks / finish strips) may stay as-is; they float/sink slightly on hilly maps, which is acceptable and noted.

**Files:**
- Modify: `app/games/crash-course/structures.ts`
- Create (test): `app/games/crash-course/__tests__/structures.test.ts`
- Modify: `app/games/crash-course/Scene.tsx`

**Interfaces:**
- Consumes: `heightAt`, `TerrainParams` from `./engine/terrainSampler` (structures.ts) and `./engine/terrainSampler` (Scene.tsx).
- Produces: `function anchorToTerrain(items: PileItem[], terrain: TerrainParams): PileItem[]` — returns new items with `position[1]` lifted by the terrain height at each item's `(x, z)`; `kind`, `drift`, and `x`/`z` preserved.

- [ ] **Step 1: Write the failing test for `anchorToTerrain`**

Create `app/games/crash-course/__tests__/structures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { anchorToTerrain, type PileItem } from "../structures";
import { heightAt, type TerrainParams } from "../engine/terrainSampler";

const FLAT: TerrainParams = { seed: 1, amplitude: 0, frequency: 0.03 };
const HILLS: TerrainParams = { seed: 11, amplitude: 4, frequency: 0.05 };

describe("anchorToTerrain", () => {
  it("leaves positions untouched on flat ground (behavior-preserving)", () => {
    const items: PileItem[] = [
      { kind: "crate", position: [3, 0.8, -20] },
      { kind: "car", position: [-4, 1.0, -60] },
    ];
    expect(anchorToTerrain(items, FLAT)).toEqual(items);
  });

  it("lifts each item by the terrain height at its (x,z)", () => {
    const items: PileItem[] = [{ kind: "box", position: [5, 1.0, -12] }];
    const out = anchorToTerrain(items, HILLS);
    expect(out[0].position[0]).toBe(5);
    expect(out[0].position[2]).toBe(-12);
    expect(out[0].position[1]).toBeCloseTo(1.0 + heightAt(HILLS, 5, -12));
  });

  it("preserves kind and drift and does not mutate the input", () => {
    const items: PileItem[] = [{ kind: "car", position: [0, 1, -66], drift: [2, 0] }];
    const out = anchorToTerrain(items, HILLS);
    expect(out[0].kind).toBe("car");
    expect(out[0].drift).toEqual([2, 0]);
    expect(items[0].position[1]).toBe(1); // input untouched
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/games/crash-course/__tests__/structures.test.ts`
Expected: FAIL — `anchorToTerrain` is not exported from `../structures`.

- [ ] **Step 3: Add the pure helper to `structures.ts`**

In `app/games/crash-course/structures.ts`, add the import below the existing `PropKind` import (after line 7):

```ts
import { heightAt, type TerrainParams } from "./engine/terrainSampler";
```

Then append at the end of the file (after `buildTrackStructures`):

```ts
/**
 * Lift every item so it rests ON the terrain at its (x, z). On flat ground
 * (amplitude 0) heightAt is 0, so positions are returned unchanged — Downtown
 * is behavior-preserving. Pure: no React, no Three.
 */
export function anchorToTerrain(items: PileItem[], terrain: TerrainParams): PileItem[] {
  return items.map((it) => ({
    ...it,
    position: [
      it.position[0],
      it.position[1] + heightAt(terrain, it.position[0], it.position[2]),
      it.position[2],
    ] as [number, number, number],
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/games/crash-course/__tests__/structures.test.ts`
Expected: PASS.

- [ ] **Step 5: Anchor the destructible props in `Scene.tsx`**

In `app/games/crash-course/Scene.tsx`, update the structures import (line 10) and add the sampler import below it:

```ts
import { buildFinale, buildTrackStructures, anchorToTerrain } from "./structures";
import { heightAt } from "./engine/terrainSampler";
```

Replace the `props` memo (line 74-75) with:

```ts
const props = useMemo(
  () => anchorToTerrain([...buildFinale(map.pileZ), ...buildTrackStructures()], map.terrain),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [runKey, map],
);
```

- [ ] **Step 6: Anchor the ramps**

In `app/games/crash-course/Scene.tsx`, give `Ramp` an optional `y` (default 0 keeps it flush on flat ground) and use it. Replace the `Ramp` component (lines 30-40) with:

```tsx
function Ramp({ x, z, w, h, len, y = 0 }: { x: number; z: number; w: number; h: number; len: number; y?: number }) {
  const geo = useMemo(() => wedgeGeometry(w, h, len), [w, h, len]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <RigidBody type="fixed" colliders="hull" position={[x, y, z]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#e0672a" roughness={0.7} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  );
}
```

Then replace the three `<Ramp>` usages (lines 130-132) with terrain-anchored ones:

```tsx
<Ramp x={0} z={-12} w={10} h={2.2} len={9} y={heightAt(map.terrain, 0, -12)} />
<Ramp x={-9} z={-34} w={8} h={2} len={8} y={heightAt(map.terrain, -9, -34)} />
<Ramp x={9} z={-52} w={8} h={2.4} len={9} y={heightAt(map.terrain, 9, -52)} />
```

- [ ] **Step 7: Anchor the buildings**

In `app/games/crash-course/Scene.tsx`, give `Building` a `y` prop. Replace the `Building` signature and its `<group>` (lines 42 and 47-48) so the group's Y includes `y`. Change line 42:

```tsx
function Building({ x, z, w, h, d, color, y }: { x: number; z: number; w: number; h: number; d: number; color: string; y: number }) {
```

and change the opening `<group>` (line 48) to:

```tsx
    <group position={[x, h / 2 - 0.5 + y, z]}>
```

Then anchor each building as it's built. Replace the buildings loop (lines 84-89) with:

```tsx
  const buildings: { x: number; z: number; w: number; h: number; d: number; color: string; y: number }[] = [];
  for (let z = 4; z > map.pileZ - 6; z -= 9) {
    const idx = buildings.length;
    const xr = halfW + 7;
    const xl = -(halfW + 7);
    buildings.push({ x: xr, z, w: 6, h: 8 + ((z * 5) % 14), d: 6, color: palette[idx % palette.length], y: heightAt(map.terrain, xr, z) });
    buildings.push({ x: xl, z: z - 4, w: 6, h: 6 + ((z * 7) % 16), d: 6, color: palette[(idx + 1) % palette.length], y: heightAt(map.terrain, xl, z - 4) });
  }
```

- [ ] **Step 8: Full gate**

- `npm test` → green (includes the new `structures.test.ts`).
- `npx tsc --noEmit` → clean.
- `npx eslint app/games/crash-course --max-warnings=0` → clean.
- `npm run build` → exit 0.

> Behavior check: because Downtown is `amplitude 0`, every `heightAt` above returns 0, so props/ramps/buildings render at their exact prior Y — Downtown is unchanged. Hilly-map placement is validated by playtest.

- [ ] **Step 9: Commit**

```bash
git add app/games/crash-course/structures.ts \
        app/games/crash-course/__tests__/structures.test.ts \
        app/games/crash-course/Scene.tsx
git commit -m "feat(crash-course): anchor props/ramps/buildings to terrain surface"
```

---

### Task 4: Drive Scene lights + ground colour from the map theme

Replace Scene's hardcoded key/ambient/hemisphere lights and the Terrain `color` with values from `map.theme`. Downtown's theme copies today's numbers (Task 2), so Downtown is behavior-preserving; the other maps now light up in their own palettes. The blue fill directional and the warm finale point light stay hardcoded (not part of the theme spec).

**Files:**
- Modify: `app/games/crash-course/Scene.tsx`

**Interfaces:**
- Consumes: `map.theme.{ambientIntensity, hemiSky, hemiGround, hemiIntensity, sunColor, sunIntensity, groundColor}`.
- Produces: no new exports.

- [ ] **Step 1: Theme the ambient + hemisphere + key lights**

In `app/games/crash-course/Scene.tsx`, replace the ambient light, hemisphere light, and the primary (sun) directional light (lines 93-108) with:

```tsx
      <ambientLight intensity={map.theme.ambientIntensity} />
      <hemisphereLight args={[map.theme.hemiSky, map.theme.hemiGround, map.theme.hemiIntensity]} />
      <directionalLight
        castShadow
        color={map.theme.sunColor}
        position={[26, 36, 20]}
        intensity={map.theme.sunIntensity}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-far={150}
        shadow-bias={-0.0005}
      />
```

Leave the fill directional (`color="#7aa0ff"`) and the finale `pointLight` (lines 109-110) exactly as they are.

- [ ] **Step 2: Theme the terrain ground colour**

In `app/games/crash-course/Scene.tsx`, replace the `<Terrain>` element (line 112) with:

```tsx
      <Terrain params={map.terrain} width={200} length={200} color={map.theme.groundColor} />
```

- [ ] **Step 3: Full gate**

- `npm test` → green.
- `npx tsc --noEmit` → clean.
- `npx eslint app/games/crash-course --max-warnings=0` → clean.
- `npm run build` → exit 0.

> Behavior check: Downtown's theme numbers equal the previous literals (`ambient 0.55`, `hemi #bcd8ff/#3a2e22 @0.8`, `sun #fff2e0 @1.8`, `groundColor #26331f`), so Downtown renders identically. Per-map lighting is validated by playtest.

- [ ] **Step 4: Commit**

```bash
git add app/games/crash-course/Scene.tsx
git commit -m "feat(crash-course): drive scene lights + ground color from map theme"
```

---

### Task 5: Map-select UI on the intro screen

Add a `mapChoices()` helper (pure, testable) and render a row of map buttons on the intro screen. Track `selectedMapId` in state (default `DEFAULT_MAP_ID`); the active `map` becomes `getMap(selectedMapId)` and flows unchanged into `Viewport`/`fog`/`Physics`/`Scene`. All maps are free-select (no locking). Existing START button and controls text stay.

**Files:**
- Modify: `app/games/crash-course/content/maps/index.ts`
- Modify (test): `app/games/crash-course/content/maps/__tests__/maps.test.ts`
- Modify: `app/games/crash-course/index.tsx`

**Interfaces:**
- Consumes: `MAPS`, `getMap`, `DEFAULT_MAP_ID`.
- Produces:
  - `interface MapChoice { id: string; name: string }`
  - `function mapChoices(): MapChoice[]` — `{ id, name }` per map, in registry order.

- [ ] **Step 1: Write the failing test for `mapChoices`**

Append to `app/games/crash-course/content/maps/__tests__/maps.test.ts` a new describe block, and extend the import on line 2 to include `mapChoices`:

```ts
import { DEFAULT_MAP_ID, getMap, MAPS, mapChoices } from "../index";
```

```ts
describe("mapChoices", () => {
  it("lists every map's id + name in registry order", () => {
    expect(mapChoices()).toEqual([
      { id: "downtown", name: "Downtown Demo" },
      { id: "hills", name: "Rolling Hills" },
      { id: "highway", name: "Sunset Highway" },
      { id: "canyon", name: "Red Canyon" },
    ]);
  });

  it("returns one choice per registered map", () => {
    expect(mapChoices()).toHaveLength(MAPS.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/games/crash-course/content/maps/__tests__/maps.test.ts`
Expected: FAIL — `mapChoices` is not exported.

- [ ] **Step 3: Add `mapChoices` to the registry**

In `app/games/crash-course/content/maps/index.ts`, append after `getMap`:

```ts
export interface MapChoice {
  id: string;
  name: string;
}

/**
 * Lightweight list for the map-select UI — id + display name only, in registry
 * order. Pure so the selector's contents are unit-testable without React.
 */
export function mapChoices(): MapChoice[] {
  return MAPS.map((m) => ({ id: m.id, name: m.name }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/games/crash-course/content/maps/__tests__/maps.test.ts`
Expected: PASS.

- [ ] **Step 5: Add selection state in `index.tsx`**

In `app/games/crash-course/index.tsx`, extend the maps import (line 19):

```ts
import { getMap, DEFAULT_MAP_ID, mapChoices } from "./content/maps";
```

Replace the fixed map (line 44):

```ts
const [selectedMapId, setSelectedMapId] = useState<string>(DEFAULT_MAP_ID);
const map = getMap(selectedMapId);
```

(`useState` is already imported at line 3; `map` continues to flow unchanged into `Viewport background`, `fog`, and `<Scene map={map} />`.)

- [ ] **Step 6: Render the map picker in the intro overlay**

In `app/games/crash-course/index.tsx`, inside the `phase === "intro"` overlay, insert the selector row between the description `<p>` and the START `<button>` (i.e. after the paragraph that ends "…Wreck everything." and before `<button onClick={start} …>START</button>`):

```tsx
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              {mapChoices().map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => setSelectedMapId(choice.id)}
                  className={`pixel-edge px-3 py-1 rounded font-[family-name:var(--font-mono)] text-xs ${
                    choice.id === selectedMapId
                      ? "bg-[var(--accent)] text-[var(--background)]"
                      : "bg-transparent border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {choice.name}
                </button>
              ))}
            </div>
```

- [ ] **Step 7: Full gate**

- `npm test` → green.
- `npx tsc --noEmit` → clean.
- `npx eslint app/games/crash-course --max-warnings=0` → clean.
- `npm run build` → exit 0.

> Behavior check: default `selectedMapId === DEFAULT_MAP_ID` means the game boots on Downtown exactly as before; the picker only appears at `phase === "intro"`, so it can't change the map mid-run. Picker visuals + switching between maps are validated by playtest.

- [ ] **Step 8: Commit**

```bash
git add app/games/crash-course/content/maps/index.ts \
        app/games/crash-course/content/maps/__tests__/maps.test.ts \
        app/games/crash-course/index.tsx
git commit -m "feat(crash-course): intro-screen map picker (free-select 4 maps)"
```

---

## Self-Review

**1. Spec coverage:**
- Cleanup / case-collision (spec item 1) → **Task 1** (rename + repoint 4 importers + Scene extensionless + collision grep).
- Enrich `MapDef.theme` (`groundColor`, sun/ambient/hemi params) + add hills/highway/canyon + registry test for all four, Downtown unchanged (spec item 2) → **Task 2**.
- Terrain-anchor props/junk-cars/ramps/buildings via pure `heightAt`; walls may float (spec item 3) → **Task 3**.
- Scene consumes theme for lights + Terrain `color`, Downtown equals today (spec item 4) → **Task 4**.
- Map-select UI with `selectedMapId` state defaulting to `DEFAULT_MAP_ID`, `getMap(selectedMapId)`, testable `mapChoices` helper (spec item 5) → **Task 5**.
- Phase 2 FOLLOW-UPs: filename collision → Task 1; `groundColor` theming → Tasks 2 & 4. Optional road strip and Phase-5 catalog SIZE reconciliation are explicitly out of scope (stated in Global Constraints).

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N". Every code step shows complete code; every map file, test, and edit is spelled out.

**3. Type consistency:**
- `MapTheme` fields (`groundColor`, `sunColor`, `sunIntensity`, `ambientIntensity`, `hemiSky`, `hemiGround`, `hemiIntensity`) are defined once in Task 2 and consumed with the identical names in Task 4 and asserted in Task 2's test.
- `anchorToTerrain(items: PileItem[], terrain: TerrainParams): PileItem[]` — same signature in Task 3's helper, test, and Scene call site.
- `mapChoices(): MapChoice[]` and `MapChoice { id; name }` — same in Task 5's helper, test, and the intro `.map` render.
- Sampler module is `./engine/terrainSampler` everywhere after Task 1 (Scene, Car, Terrain.tsx, structures.ts, both tests); the component import is `./engine/Terrain`.
- `Ramp`'s new `y?: number` and `Building`'s new `y: number` are added in Task 3 and used consistently in the same task.

**4. Behavior-preservation invariant:** Every task states why Downtown is unchanged — `amplitude 0 ⇒ heightAt 0` (Tasks 1, 3), Downtown theme literals equal to the previous hardcoded values (Tasks 2, 4), and `selectedMapId` defaulting to Downtown (Task 5).

No gaps found.
