# Crash Course Phase 2 — Drivable Terrain + Car Ground-Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give Crash Course real drivable heightfield terrain the car climbs, crests, and launches off — without breaking today's flat-ground feel.

**Architecture:** Add a pure, seeded terrain sampler (`engine/terrain.ts`) and a `<Terrain>` component that renders a displaced plane AND a **physical** Rapier `HeightfieldCollider`. Because the existing arcade car already sets only horizontal velocity while letting physics drive vertical motion (that's how it launches off the ramp colliders today), a physical heightfield means the car rides terrain via the same proven physics — so `Car.tsx` changes stay minimal (kill-plane wiring, terrain-aware spawn/ride height, cosmetic slope tilt). Downtown stays flat (`amplitude 0`), so a flat heightfield reproduces today's ground: behavior-preserving. The hilly maps that showcase this land in Phase 3.

**Tech Stack:** `@react-three/rapier` `HeightfieldCollider`, `@react-three/fiber`, `three`, Vitest.

## Global Constraints

- `engine/terrain.ts` is **pure — no React, no Three imports** (unit-testable). It must stay content-agnostic (no maps/cars/props imports); it takes a plain params object `{ seed, amplitude, frequency }` structurally compatible with `MapDef.terrain`.
- Determinism: `heightAt` must be a pure function of `(params, x, z)` — same inputs → same output, no `Math.random`, no time. Seed drives the noise.
- **Behavior preservation on Downtown:** with `amplitude === 0`, `heightAt` returns `0` everywhere and the terrain is a flat plane at `y = 0`, matching today's ground-top. The game must still play exactly as today on Downtown.
- Rapier `HeightfieldCollider` args are `[nrows, ncols, heights, scale]` with `heights` in **column-major** order; `scale` is `{ x, y, z }` spanning the whole field.
- Kill-plane: replace the hardcoded `t.y < -25` in `Car.tsx` with `isBelowKillPlane(t.y)` / `KILL_PLANE_Y` from `engine/physicsSafety.ts` (finally wiring the Phase-1 guard).
- Full suite green (`npm test`), `npx tsc --noEmit` clean, `npx eslint app/games/crash-course --max-warnings=0` clean, and `npm run build` succeeds before each task's commit is considered done. Branch `feat/crash-course-engine-expansion`. Commit after each task.
- 3D rendering and physics *feel* are validated by playtesting, not unit tests — the pure terrain math is where the automated coverage lives.

---

## File Structure

**Create:**
- `app/games/crash-course/engine/terrain.ts` — pure: `heightAt`, `normalAt`, `buildHeightfield`, seeded value-noise.
- `app/games/crash-course/engine/Terrain.tsx` — displaced plane mesh + `<RigidBody type="fixed"><HeightfieldCollider/></RigidBody>`; segment count from quality tier; disposes geometry.
- Test: `app/games/crash-course/engine/__tests__/terrain.test.ts`.

**Modify:**
- `app/games/crash-course/Scene.tsx` — replace the flat ground plane + ground box collider with `<Terrain params={map.terrain} width=... length=.../>`. Keep walls, ramps, lane marks, buildings.
- `app/games/crash-course/Car.tsx` — kill-plane via `physicsSafety`; terrain-aware spawn/ride height so the car sits on the surface; cosmetic tilt of the visual model toward the ground normal. Preserve flat-ground control feel.
- `app/games/crash-course/content/maps/downtown.ts` — no numeric change (stays `amplitude 0`); confirm `terrain` shape matches the sampler's params.

---

### Task 1: Pure terrain sampler

**Files:**
- Create: `app/games/crash-course/engine/terrain.ts`
- Test: `app/games/crash-course/engine/__tests__/terrain.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface TerrainParams { seed: number; amplitude: number; frequency: number }`
  - `interface Vec3 { x: number; y: number; z: number }`
  - `function heightAt(p: TerrainParams, x: number, z: number): number`
  - `function normalAt(p: TerrainParams, x: number, z: number): Vec3` — unit normal via finite differences.
  - `interface Heightfield { nrows: number; ncols: number; heights: Float32Array; scale: Vec3 }`
  - `function buildHeightfield(p: TerrainParams, width: number, length: number, segments: number): Heightfield` — column-major heights sampling `heightAt` across a `width × length` field centred on origin.

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/engine/__tests__/terrain.test.ts
import { describe, it, expect } from "vitest";
import { heightAt, normalAt, buildHeightfield, type TerrainParams } from "../terrain";

const FLAT: TerrainParams = { seed: 1, amplitude: 0, frequency: 0.05 };
const HILLS: TerrainParams = { seed: 7, amplitude: 4, frequency: 0.08 };

describe("terrain sampler", () => {
  it("is flat everywhere when amplitude is 0", () => {
    for (const [x, z] of [[0, 0], [12, -30], [-40, 55]]) {
      expect(heightAt(FLAT, x, z)).toBe(0);
    }
  });

  it("is deterministic for a given seed", () => {
    expect(heightAt(HILLS, 10, -20)).toBe(heightAt(HILLS, 10, -20));
  });

  it("varies with position and stays within +/- amplitude", () => {
    const a = heightAt(HILLS, 3, 3);
    const b = heightAt(HILLS, 9, -14);
    expect(a).not.toBe(b);
    for (const [x, z] of [[0, 0], [5, 5], [-8, 20], [30, -30]]) {
      const h = heightAt(HILLS, x, z);
      expect(Math.abs(h)).toBeLessThanOrEqual(HILLS.amplitude + 1e-6);
    }
  });

  it("gives an up-normal on flat ground", () => {
    const n = normalAt(FLAT, 5, 5);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(n.z).toBeCloseTo(0);
  });

  it("gives a unit-length normal on hills", () => {
    const n = normalAt(HILLS, 6, -6);
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 5);
    expect(n.y).toBeGreaterThan(0); // terrain never overhangs
  });

  it("builds a column-major heightfield of the right size", () => {
    const hf = buildHeightfield(HILLS, 40, 60, 4);
    expect(hf.nrows).toBe(5); // segments + 1
    expect(hf.ncols).toBe(5);
    expect(hf.heights.length).toBe(25);
    expect(hf.scale.x).toBe(40);
    expect(hf.scale.z).toBe(60);
    expect(hf.scale.y).toBe(1);
  });

  it("produces an all-zero heightfield when flat", () => {
    const hf = buildHeightfield(FLAT, 40, 40, 4);
    expect([...hf.heights].every((h) => h === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/engine/__tests__/terrain.test.ts`
Expected: FAIL — cannot find module `../terrain`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/engine/terrain.ts
/**
 * Terrain sampler — pure, seeded height/normal generation and a Rapier
 * heightfield builder. No React, no Three, no randomness: heightAt is a pure
 * function of (params, x, z) so the same seed always yields the same hills and
 * every consumer (mesh, collider, prop placement) agrees on the surface.
 */

export interface TerrainParams {
  seed: number;
  /** Peak hill height in metres. 0 = perfectly flat. */
  amplitude: number;
  /** Spatial frequency of the hills (larger = tighter). */
  frequency: number;
}

export interface Vec3 { x: number; y: number; z: number }

// --- seeded value noise (hash -> smooth interpolation) --------------------

function hash2(ix: number, iz: number, seed: number): number {
  // Deterministic hash in [0,1). Integer lattice point -> pseudo-random value.
  let h = ix * 374761393 + iz * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  // >>> 0 forces unsigned; divide to [0,1)
  return ((h >>> 0) % 100000) / 100000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = smooth(x - x0), fz = smooth(z - z0);
  const v00 = hash2(x0, z0, seed);
  const v10 = hash2(x0 + 1, z0, seed);
  const v01 = hash2(x0, z0 + 1, seed);
  const v11 = hash2(x0 + 1, z0 + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fz; // [0,1)
}

export function heightAt(p: TerrainParams, x: number, z: number): number {
  if (p.amplitude === 0) return 0;
  // Centre the [0,1) noise to [-1,1], scale by amplitude.
  const n = valueNoise(x * p.frequency, z * p.frequency, p.seed) * 2 - 1;
  return n * p.amplitude;
}

export function normalAt(p: TerrainParams, x: number, z: number): Vec3 {
  const e = 0.5;
  const hL = heightAt(p, x - e, z);
  const hR = heightAt(p, x + e, z);
  const hD = heightAt(p, x, z - e);
  const hU = heightAt(p, x, z + e);
  // Gradient -> normal = normalize(-dHdx, 1, -dHdz) with the 2e denominator.
  const nx = -(hR - hL) / (2 * e);
  const nz = -(hU - hD) / (2 * e);
  const len = Math.hypot(nx, 1, nz) || 1;
  return { x: nx / len, y: 1 / len, z: nz / len };
}

export interface Heightfield {
  nrows: number;
  ncols: number;
  heights: Float32Array;
  scale: Vec3;
}

/**
 * Sample a `width × length` field centred on the origin into a Rapier
 * heightfield. `segments` cells per side → `segments+1` samples per side.
 * Heights are column-major (Rapier's expected order).
 */
export function buildHeightfield(
  p: TerrainParams,
  width: number,
  length: number,
  segments: number,
): Heightfield {
  const n = segments + 1;
  const heights = new Float32Array(n * n);
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n; row++) {
      // Map grid indices to world X/Z across the centred field.
      const x = (col / segments - 0.5) * width;
      const z = (row / segments - 0.5) * length;
      heights[col * n + row] = heightAt(p, x, z); // column-major
    }
  }
  return { nrows: n, ncols: n, heights, scale: { x: width, y: 1, z: length } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/engine/__tests__/terrain.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/engine/terrain.ts app/games/crash-course/engine/__tests__/terrain.test.ts
git commit -m "feat(crash-course): pure seeded terrain sampler + heightfield builder"
```

---

### Task 2: Terrain component (visual mesh + physical heightfield)

**Files:**
- Create: `app/games/crash-course/engine/Terrain.tsx`
- Test: none (R3F rendering is validated by build + playtest; the math is covered in Task 1). State this explicitly in the report.

**Interfaces:**
- Consumes: `buildHeightfield`, `heightAt`, `type TerrainParams` from `./terrain`; `useQuality` from `./QualityContext`.
- Produces: `function Terrain(props: { params: TerrainParams; width: number; length: number; color?: string }): JSX.Element`

**Context:** Renders one displaced `PlaneGeometry` (segment count from the quality tier: `settings.terrainSegments`) whose vertices are lifted by `heightAt`, and a fixed `RigidBody` holding a `HeightfieldCollider` built from the SAME params/segments so collision matches the visible surface. On `amplitude 0` this is a flat plane at `y=0` — today's ground.

- [ ] **Step 1: Write the component**

```tsx
// app/games/crash-course/engine/Terrain.tsx
"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { useQuality } from "./QualityContext";
import { buildHeightfield, heightAt, type TerrainParams } from "./terrain";

/**
 * Drivable terrain: a displaced ground mesh plus a matching physical Rapier
 * heightfield, both sampled from the same pure `terrain.ts` params so what you
 * see is what you hit. Segment density scales with the quality tier. On
 * amplitude 0 this is a flat plane at y=0 (today's ground).
 */
export function Terrain({
  params,
  width,
  length,
  color = "#26331f",
}: {
  params: TerrainParams;
  width: number;
  length: number;
  color?: string;
}) {
  const { settings } = useQuality();
  const segments = settings.terrainSegments;

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, length, segments, segments);
    g.rotateX(-Math.PI / 2); // XZ ground plane
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(params, x, z));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [params, width, length, segments]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const hf = useMemo(
    () => buildHeightfield(params, width, length, segments),
    [params, width, length, segments],
  );

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <HeightfieldCollider
          args={[hf.nrows - 1, hf.ncols - 1, Array.from(hf.heights), hf.scale]}
        />
      </RigidBody>
    </group>
  );
}
```

- [ ] **Step 2: Verify it type-checks, lints, and builds**

Run: `npx tsc --noEmit` → clean.
Run: `npx eslint app/games/crash-course/engine/Terrain.tsx --max-warnings=0` → clean.
If the `HeightfieldCollider` `args` signature differs in the installed `@react-three/rapier` v2 (check `node_modules/@react-three/rapier` types — it may take `heights` as a number[] and `scale` as a `THREE.Vector3` or a `{x,y,z}`), adapt the call minimally and note it in the report. The nrows/ncols passed to the collider are the number of **cells** (samples − 1); confirm against the type and adjust if it expects sample counts.

- [ ] **Step 3: Commit**

```bash
git add app/games/crash-course/engine/Terrain.tsx
git commit -m "feat(crash-course): Terrain component — displaced mesh + physical heightfield"
```

---

### Task 3: Swap Scene ground for Terrain (behavior-preserving on Downtown)

**Files:**
- Modify: `app/games/crash-course/Scene.tsx`

**Interfaces:**
- Consumes: `Terrain` from `./engine/Terrain`; the `map` prop already threaded in Phase 1 (`map.terrain`, `map.trackWidth`).

**Context:** Replace the two current ground pieces — the large flat visual `<mesh>` plane and the `<RigidBody type="fixed" colliders="cuboid">` ground box — with a single `<Terrain params={map.terrain} width={...} length={...} />`. Keep everything else (walls, ramps, lane marks, buildings, finish line, back wall). On Downtown (`amplitude 0`) the terrain is flat at `y=0`, matching the old ground top, so nothing changes.

- [ ] **Step 1: Read the current ground code**

Read `Scene.tsx`. Identify the visual ground `<mesh rotation={[-Math.PI/2,...]} ... ><planeGeometry args={[600,600]}/>` and the physical `<RigidBody ...><boxGeometry args={[TRACK.width,1,groundLen]}/>` block (the ground collider whose top sits at `y=0`).

- [ ] **Step 2: Replace both with Terrain**

Remove the standalone visual ground plane and the ground-box `RigidBody`. Insert, near the top of the returned scene (before walls/props):

```tsx
<Terrain params={map.terrain} width={200} length={200} />
```

Notes:
- Use a field large enough to cover the play area (the old visual plane was 600×600 and the collider `groundLen` ≈ 102). 200×200 centred on origin covers the track (spawn `z=8` to pile `z=-66`) with margin; widen if the report finds the car can drive off the field. Keep the field centred on origin (matches `buildHeightfield`).
- Add the import: `import { Terrain } from "./engine/Terrain";`
- Leave lane marks / finish-line planes at their small `y` offsets — on flat terrain they still sit just above `y=0` as before.

- [ ] **Step 3: Verify behavior preservation**

Run: `npm test` (378+ green), `npx tsc --noEmit` (clean), `npx eslint app/games/crash-course --max-warnings=0` (clean), `npm run build` (exit 0).
The `allGamesMount` test must still pass (the game mounts). Note in the report that flat-ground equivalence + drive feel need a playtest.

- [ ] **Step 4: Commit**

```bash
git add app/games/crash-course/Scene.tsx
git commit -m "feat(crash-course): drive on Terrain instead of a flat ground plane"
```

---

### Task 4: Car — kill-plane wiring, terrain ride height, cosmetic slope tilt

**Files:**
- Modify: `app/games/crash-course/Car.tsx`

**Interfaces:**
- Consumes: `isBelowKillPlane`, `KILL_PLANE_Y` from `./engine/physicsSafety`; `heightAt`, `normalAt` from `./engine/terrain`; the active map's `terrain` params (thread a `terrain: TerrainParams` prop into `Car` from `Scene`, which has `map`).

**Context:** Keep the arcade control exactly as-is (horizontal velocity along facing, preserving `lv.y`; yaw via angvel; X/Z rotations locked). The car already rides slopes through the physical heightfield. Three focused changes:
1. Replace the hardcoded `t.y < -25` with `isBelowKillPlane(t.y)` (and delete the magic number).
2. Terrain-aware spawn/reset height: when spawning or when a non-finite position resets the body, place it at `heightAt(terrain, x, z) + rideHeight` so it never spawns inside a hill. On Downtown (`amplitude 0`) this is the current spawn Y.
3. Cosmetic slope tilt: lerp the *visual model group's* orientation toward the ground normal from `normalAt(terrain, x, z)` so the car visually hugs hills, while the physics body stays yaw-locked for control stability. Do NOT tilt the collider.

- [ ] **Step 1: Thread the terrain param**

In `Scene.tsx`, pass `terrain={map.terrain}` to `<Car ... />`. In `Car.tsx`, add `terrain: TerrainParams` to `CarProps` and destructure it. Import `type { TerrainParams }` from `./engine/terrain`.

- [ ] **Step 2: Wire the kill-plane**

Replace:

```tsx
if (t.y < -25 && !crashed.current) {
```

with:

```tsx
if (isBelowKillPlane(t.y) && !crashed.current) {
```

Add the import: `import { isBelowKillPlane } from "./engine/physicsSafety";`

- [ ] **Step 3: Terrain-aware spawn/reset height**

At the top of the file, change the fixed `SPAWN` handling so the reset path uses terrain height. In the non-finite reset branch, replace `b.setTranslation(SPAWN, true);` with a spawn whose Y accounts for terrain:

```tsx
const groundY = heightAt(terrain, SPAWN.x, SPAWN.z) + (CAR.spawn[1]);
b.setTranslation({ x: SPAWN.x, y: groundY, z: SPAWN.z }, true);
```

Import `heightAt`. Also set the initial `<RigidBody position>` Y from the same expression (compute `const spawnY = heightAt(terrain, SPAWN.x, SPAWN.z) + CAR.spawn[1];` once in the component body and use it for `position={[SPAWN.x, spawnY, SPAWN.z]}`). On Downtown this equals the current `CAR.spawn[1]`.

- [ ] **Step 4: Cosmetic slope tilt of the visual model**

Wrap the model (`ModelBoundary`/`VehicleModel`) in a `group` with a ref, and each frame lerp its quaternion toward one whose up = the ground normal at the car's position while keeping the car's yaw. Add inside `useFrame`, after computing `t` and `_fwd`:

```tsx
// Cosmetic: tilt the visible body toward the ground slope (physics stays flat).
const gn = normalAt(terrain, t.x, t.z);
_up.set(gn.x, gn.y, gn.z);
// Build an orientation whose up is the ground normal and whose forward keeps yaw.
_look.copy(_fwd).sub(_up.clone().multiplyScalar(_fwd.dot(_up))).normalize();
_m.makeBasis(_look.clone().cross(_up).normalize(), _up, _look.clone().negate());
_tq.setFromRotationMatrix(_m);
if (modelGroup.current) {
  modelGroup.current.quaternion.slerp(_tq, 1 - Math.pow(0.0001, dt));
}
```

Declare the scratch objects at module scope next to `_q`/`_fwd`/`_cam`:

```tsx
const _up = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _tq = new THREE.Quaternion();
```

And a `const modelGroup = useRef<THREE.Group>(null);` in the component, applied as `<group ref={modelGroup}>` around the model. On flat terrain the normal is straight up, so the tilt is identity — no visible change on Downtown.

- [ ] **Step 5: Verify**

Run: `npm test` (green), `npx tsc --noEmit` (clean), `npx eslint app/games/crash-course --max-warnings=0` (clean), `npm run build` (exit 0).
Note in the report: the tilt math and slope-ride behavior need a playtest; the automated checks only prove it compiles, mounts, and preserves the pure logic. If the tilt math proves fiddly/unstable to reason about statically, it is acceptable to ship WITHOUT the cosmetic tilt (Steps 1-3 are the substance) and report the tilt as deferred — flag this clearly rather than committing shaky visual math.

- [ ] **Step 6: Commit**

```bash
git add app/games/crash-course/Car.tsx app/games/crash-course/Scene.tsx
git commit -m "feat(crash-course): terrain-aware spawn + kill-plane + cosmetic slope tilt"
```

---

## Self-Review

- **Spec coverage:** drivable heightfield terrain (Tasks 1-3) ✅; car rides/launches via physical heightfield reusing ramp physics (Task 3 + existing control) ✅; kill-plane finally wired (Task 4) ✅; behavior-preserving on flat Downtown (`amplitude 0` throughout) ✅; hills become *visible* in Phase 3's maps (correctly out of scope here).
- **Placeholder scan:** every code step has full code; the one conditional is Task 4 Step 5's explicit "ship without cosmetic tilt if unstable," which is a bounded, stated fallback, not a TBD.
- **Type consistency:** `TerrainParams`/`Vec3`/`Heightfield` defined in Task 1, consumed unchanged in Tasks 2 & 4; `buildHeightfield(params,width,length,segments)` signature identical across Task 1 def and Task 2 use; `heightAt`/`normalAt` signatures identical across tasks.
- **Risk note for the controller:** Task 2's `HeightfieldCollider` arg shape and Task 4's tilt math are the two spots most likely to need a review loop — dispatch those on a capable model and scrutinize the collider arg order (cells vs samples) and the tilt fallback.
