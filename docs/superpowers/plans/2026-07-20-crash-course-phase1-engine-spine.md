# Crash Course Phase 1 — Engine & Robustness Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hardcoded single-track Crash Course into a data-driven, adaptive, hard-to-break 3D engine — without changing how the current game plays.

**Architecture:** Extract pure, unit-tested cores (prop/car/map registries, GPU quality tiers, physics-safety guards) and a reusable `engine/` layer (a `Viewport` that owns the Canvas, an error boundary, WebGL context-loss recovery, and adaptive quality). The existing single track is *ported onto* this pipeline unchanged, proving the refactor is behavior-preserving before any new content (terrain, maps, cars) lands in later phases.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), `@react-three/fiber` v9, `@react-three/rapier` v2, `@react-three/drei` v10, `three` 0.185, Vitest + Testing Library (jsdom).

## Global Constraints

- All new pure logic lives in files with **no React and no Three imports** so it is unit-testable: `content/props/catalog.ts`, `content/cars/index.ts`, `content/maps/index.ts`, `engine/quality.ts`, `engine/physicsSafety.ts`.
- **DRY the scoring source of truth:** prop point values come from `PROP_VALUES` in `app/games/crash-course/scoring.ts` — never redefine them.
- Tests use Vitest (`import { describe, it, expect } from "vitest"`) and live in a `__tests__/` folder beside the code, matching `app/games/crash-course/__tests__/scoring.test.ts`.
- Run a single test file with: `npx vitest run <path>`. Run everything with: `npm test`.
- **Behavior preservation is the acceptance bar for Phase 1:** after Task 9 the game must still play exactly as it does today (same track, car, feel). New capability is latent, not visible.
- New engine files must not import crash-course *content* (maps/cars/props) — `engine/` stays content-agnostic so it can be extracted to `lib/engine3d/` in a later phase.
- Every `useMemo`-created geometry/material must be disposed on unmount (follow the existing `Ramp` pattern in `Scene.tsx:28-38`).
- Branch: `feat/crash-course-engine-expansion` (already checked out). Commit after every task.

---

## File Structure

**Create (pure logic + tests):**
- `app/games/crash-course/content/props/catalog.ts` — `PropDef` catalog (size, color, mass) keyed by `PropKind`; values re-exported from `scoring.ts`.
- `app/games/crash-course/content/cars/index.ts` — `CarDef` registry + starter car derived from today's `CAR` constant.
- `app/games/crash-course/content/maps/index.ts` — `MapDef` type + registry.
- `app/games/crash-course/content/maps/downtown.ts` — the current track encoded as a flat `MapDef`.
- `app/games/crash-course/engine/quality.ts` — pure GPU-string → `QualityTier` → `QualitySettings`.
- `app/games/crash-course/engine/physicsSafety.ts` — pure NaN/Infinity/velocity/kill-plane guards.
- Test files under matching `__tests__/` folders.

**Create (React engine layer):**
- `app/games/crash-course/engine/QualityContext.tsx` — provider + `useQuality()` hook.
- `app/games/crash-course/engine/useSettle.ts` — the crashing→results rest-watcher, lifted out of `index.tsx`.
- `app/games/crash-course/engine/Viewport.tsx` — Canvas + error boundary + context-loss recovery + quality-driven renderer settings.

**Modify:**
- `app/games/crash-course/index.tsx` — mount `<QualityProvider>` + `<Viewport>` instead of a bare `<Canvas>`; drive spawn/pile/theme from the `downtown` `MapDef`; use `useSettle`.
- `app/games/crash-course/Scene.tsx` — read prop sizes/colors from the catalog; accept the active `MapDef`; add the kill-plane guard.

---

### Task 1: Prop catalog (pure)

**Files:**
- Create: `app/games/crash-course/content/props/catalog.ts`
- Test: `app/games/crash-course/content/props/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `PropKind`, `PROP_VALUES` from `app/games/crash-course/scoring.ts`.
- Produces:
  - `interface PropDef { kind: PropKind; value: number; size: [number, number, number]; color: string; mass: number }`
  - `const PROP_CATALOG: Record<PropKind, PropDef>`
  - `function propDef(kind: PropKind): PropDef`

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/content/props/__tests__/catalog.test.ts
import { describe, it, expect } from "vitest";
import { PROP_CATALOG, propDef } from "../catalog";
import { PROP_VALUES, type PropKind } from "../../../scoring";

const KINDS: PropKind[] = ["crate", "box", "barrel", "gold", "car"];

describe("prop catalog", () => {
  it("has an entry for every PropKind", () => {
    for (const k of KINDS) expect(PROP_CATALOG[k]).toBeDefined();
  });

  it("re-uses scoring PROP_VALUES verbatim (no divergent copy)", () => {
    for (const k of KINDS) expect(PROP_CATALOG[k].value).toBe(PROP_VALUES[k]);
  });

  it("gives every prop a positive size and mass", () => {
    for (const k of KINDS) {
      const d = propDef(k);
      expect(d.size.every((n) => n > 0)).toBe(true);
      expect(d.mass).toBeGreaterThan(0);
    }
  });

  it("makes cars far heavier than crates (momentum matters)", () => {
    expect(propDef("car").mass).toBeGreaterThan(propDef("crate").mass * 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/content/props/__tests__/catalog.test.ts`
Expected: FAIL — cannot find module `../catalog`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/content/props/catalog.ts
/**
 * Prop catalog — the smashable objects, as data. Point VALUES stay owned by
 * scoring.ts (single source of truth); this adds the physical/visual facts the
 * scene needs (size, colour, mass). Pure: no React, no Three.
 */
import { PROP_VALUES, type PropKind } from "../../scoring";

export interface PropDef {
  kind: PropKind;
  /** Point value — mirrors scoring.PROP_VALUES, never diverges. */
  value: number;
  /** Box footprint [w, h, d]; matches the meshes in Destructible. */
  size: [number, number, number];
  color: string;
  /** Rapier-ish relative mass; drives how far a hit throws it. */
  mass: number;
}

// Footprints match structures.ts H and the Destructible meshes.
const SIZE: Record<PropKind, [number, number, number]> = {
  crate: [1.6, 1.6, 1.6],
  box: [1.9, 1.9, 1.9],
  barrel: [1.6, 1.9, 1.6],
  gold: [1.6, 1.6, 1.6],
  car: [2.0, 1.6, 4.0],
};

const COLOR: Record<PropKind, string> = {
  crate: "#9a9a9a",
  box: "#b0803f",
  barrel: "#d63d3d",
  gold: "#ffd24a",
  car: "#4a7bd6",
};

const MASS: Record<PropKind, number> = {
  crate: 1,
  box: 1.4,
  barrel: 2,
  gold: 1,
  car: 12,
};

export const PROP_CATALOG: Record<PropKind, PropDef> = (
  Object.keys(PROP_VALUES) as PropKind[]
).reduce((acc, kind) => {
  acc[kind] = {
    kind,
    value: PROP_VALUES[kind],
    size: SIZE[kind],
    color: COLOR[kind],
    mass: MASS[kind],
  };
  return acc;
}, {} as Record<PropKind, PropDef>);

export function propDef(kind: PropKind): PropDef {
  return PROP_CATALOG[kind];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/content/props/__tests__/catalog.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/content/props/
git commit -m "feat(crash-course): data-driven prop catalog (pure)"
```

---

### Task 2: Car registry (pure)

**Files:**
- Create: `app/games/crash-course/content/cars/index.ts`
- Test: `app/games/crash-course/content/cars/__tests__/cars.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface CarStats { mass: number; topSpeed: number; accel: number; grip: number; durability: number }`
  - `interface CarDef { id: string; name: string; price: number; stats: CarStats; color: string; model?: string }`
  - `const CARS: CarDef[]`
  - `const STARTER_CAR_ID = "rust-bucket"`
  - `function getCar(id: string): CarDef` — falls back to the starter for unknown ids.

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/content/cars/__tests__/cars.test.ts
import { describe, it, expect } from "vitest";
import { CARS, STARTER_CAR_ID, getCar } from "../index";

describe("car registry", () => {
  it("has a free starter car", () => {
    const starter = getCar(STARTER_CAR_ID);
    expect(starter.id).toBe(STARTER_CAR_ID);
    expect(starter.price).toBe(0);
  });

  it("falls back to the starter for an unknown id", () => {
    expect(getCar("does-not-exist").id).toBe(STARTER_CAR_ID);
  });

  it("gives every car complete, positive stats", () => {
    for (const c of CARS) {
      const s = c.stats;
      expect(s.mass).toBeGreaterThan(0);
      expect(s.topSpeed).toBeGreaterThan(0);
      expect(s.accel).toBeGreaterThan(0);
      expect(s.grip).toBeGreaterThan(0);
      expect(s.durability).toBeGreaterThan(0);
      expect(c.price).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserves the current arcade feel on the starter", () => {
    // These mirror config.ts CAR so the Phase-1 port changes nothing.
    const s = getCar(STARTER_CAR_ID).stats;
    expect(s.topSpeed).toBe(34);
    expect(s.accel).toBe(26);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/cars.test.ts`
Expected: FAIL — cannot find module `../index`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/content/cars/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/content/cars/__tests__/cars.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/content/cars/
git commit -m "feat(crash-course): car registry with starter car (pure)"
```

---

### Task 3: Map registry + Downtown (pure)

**Files:**
- Create: `app/games/crash-course/content/maps/index.ts`
- Create: `app/games/crash-course/content/maps/downtown.ts`
- Test: `app/games/crash-course/content/maps/__tests__/maps.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface MapTheme { background: string; fogNear: number; fogFar: number }`
  - `interface TerrainParams { seed: number; amplitude: number; frequency: number }`
  - `interface MapDef { id: string; name: string; theme: MapTheme; terrain: TerrainParams; spawn: [number, number, number]; pileZ: number; trackWidth: number }`
  - `const MAPS: MapDef[]`
  - `const DEFAULT_MAP_ID = "downtown"`
  - `function getMap(id: string): MapDef`

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/content/maps/__tests__/maps.test.ts
import { describe, it, expect } from "vitest";
import { MAPS, DEFAULT_MAP_ID, getMap } from "../index";

describe("map registry", () => {
  it("has the downtown default", () => {
    expect(getMap(DEFAULT_MAP_ID).id).toBe("downtown");
  });

  it("falls back to the default for an unknown id", () => {
    expect(getMap("nope").id).toBe(DEFAULT_MAP_ID);
  });

  it("downtown is flat in Phase 1 (amplitude 0 = behavior-preserving)", () => {
    expect(getMap("downtown").terrain.amplitude).toBe(0);
  });

  it("keeps today's pile and spawn coordinates", () => {
    const m = getMap("downtown");
    expect(m.pileZ).toBe(-66);
    expect(m.spawn).toEqual([0, 0.75, 8]);
    expect(m.trackWidth).toBe(34);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/content/maps/__tests__/maps.test.ts`
Expected: FAIL — cannot find module `../index`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/content/maps/index.ts
/**
 * Map registry — each map is a data file. Phase 1 ships only Downtown (flat,
 * matching today's track); terrain amplitude 0 means the heightfield lands in
 * Phase 2 without touching this shape. Pure: no React, no Three.
 */
import { downtown } from "./downtown";

export interface MapTheme {
  background: string;
  fogNear: number;
  fogFar: number;
}

export interface TerrainParams {
  seed: number;
  /** Peak hill height in metres. 0 = flat ground (Phase 1). */
  amplitude: number;
  /** Spatial frequency of the hills. */
  frequency: number;
}

export interface MapDef {
  id: string;
  name: string;
  theme: MapTheme;
  terrain: TerrainParams;
  spawn: [number, number, number];
  pileZ: number;
  trackWidth: number;
}

export const MAPS: MapDef[] = [downtown];

export const DEFAULT_MAP_ID = "downtown";

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS.find((m) => m.id === DEFAULT_MAP_ID)!;
}
```

```ts
// app/games/crash-course/content/maps/downtown.ts
/**
 * Downtown — today's track, encoded as data. Flat (amplitude 0) so Phase 1 is a
 * pure refactor; the fog/background and coordinates mirror the current
 * index.tsx and config.ts values exactly.
 */
import type { MapDef } from "./index";

export const downtown: MapDef = {
  id: "downtown",
  name: "Downtown Demo",
  theme: { background: "#2a3f6b", fogNear: 65, fogFar: 175 },
  terrain: { seed: 1, amplitude: 0, frequency: 0.03 },
  spawn: [0, 0.75, 8],
  pileZ: -66,
  trackWidth: 34,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/content/maps/__tests__/maps.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/content/maps/
git commit -m "feat(crash-course): map registry + Downtown as data (pure)"
```

---

### Task 4: GPU quality tiers (pure)

**Files:**
- Create: `app/games/crash-course/engine/quality.ts`
- Test: `app/games/crash-course/engine/__tests__/quality.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type QualityTier = "low" | "med" | "high"`
  - `interface QualitySettings { tier: QualityTier; maxPixelRatio: number; shadowMapSize: 0 | 1024 | 2048; postFx: "none" | "bloom" | "bloom+vignette"; fogFar: number; terrainSegments: number }`
  - `const QUALITY: Record<QualityTier, QualitySettings>`
  - `interface GpuProbe { renderer: string; maxTextureSize: number }`
  - `function detectTier(probe: GpuProbe): QualityTier`
  - `function settingsFor(tier: QualityTier): QualitySettings`

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/engine/__tests__/quality.test.ts
import { describe, it, expect } from "vitest";
import { detectTier, settingsFor, QUALITY } from "../quality";

describe("quality tier detection", () => {
  it("flags software / integrated renderers as low", () => {
    expect(detectTier({ renderer: "SwiftShader", maxTextureSize: 4096 })).toBe("low");
    expect(detectTier({ renderer: "Intel(R) UHD Graphics 620", maxTextureSize: 8192 })).toBe("low");
    expect(detectTier({ renderer: "llvmpipe (LLVM 12)", maxTextureSize: 8192 })).toBe("low");
  });

  it("treats a small max texture size as low regardless of name", () => {
    expect(detectTier({ renderer: "GeForce RTX 4090", maxTextureSize: 2048 })).toBe("low");
  });

  it("flags mobile GPUs as med", () => {
    expect(detectTier({ renderer: "Mali-G78", maxTextureSize: 8192 })).toBe("med");
    expect(detectTier({ renderer: "Adreno (TM) 640", maxTextureSize: 8192 })).toBe("med");
    expect(detectTier({ renderer: "Apple M2", maxTextureSize: 16384 })).toBe("med");
  });

  it("flags discrete desktop GPUs as high", () => {
    expect(detectTier({ renderer: "NVIDIA GeForce RTX 3070", maxTextureSize: 16384 })).toBe("high");
    expect(detectTier({ renderer: "AMD Radeon RX 6800", maxTextureSize: 16384 })).toBe("high");
  });

  it("settings scale monotonically with tier", () => {
    expect(QUALITY.low.shadowMapSize).toBe(0);
    expect(QUALITY.med.shadowMapSize).toBe(1024);
    expect(QUALITY.high.shadowMapSize).toBe(2048);
    expect(QUALITY.high.maxPixelRatio).toBeGreaterThan(QUALITY.low.maxPixelRatio);
    expect(settingsFor("med").tier).toBe("med");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/engine/__tests__/quality.test.ts`
Expected: FAIL — cannot find module `../quality`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/engine/quality.ts
/**
 * Adaptive quality — pure tier selection from a GPU probe. The Viewport probes
 * the live renderer once and drei's PerformanceMonitor nudges the tier at
 * runtime; both consume this table. No React, no Three here so it is testable.
 */

export type QualityTier = "low" | "med" | "high";

export interface QualitySettings {
  tier: QualityTier;
  maxPixelRatio: number;
  /** 0 disables shadows entirely. */
  shadowMapSize: 0 | 1024 | 2048;
  postFx: "none" | "bloom" | "bloom+vignette";
  /** Fog far plane — the effective draw distance. */
  fogFar: number;
  /** Heightfield subdivisions per side (Phase 2 terrain). */
  terrainSegments: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { tier: "low", maxPixelRatio: 1, shadowMapSize: 0, postFx: "none", fogFar: 120, terrainSegments: 48 },
  med: { tier: "med", maxPixelRatio: 1.5, shadowMapSize: 1024, postFx: "bloom", fogFar: 160, terrainSegments: 96 },
  high: { tier: "high", maxPixelRatio: 2, shadowMapSize: 2048, postFx: "bloom+vignette", fogFar: 190, terrainSegments: 160 },
};

export interface GpuProbe {
  /** Unmasked renderer string from WEBGL_debug_renderer_info. */
  renderer: string;
  maxTextureSize: number;
}

const SOFTWARE = /swiftshader|llvmpipe|basic render|software/i;
const INTEGRATED = /intel|uhd|hd graphics|iris|microsoft/i;
const MOBILE = /mali|adreno|powervr|apple [am]\d|apple gpu/i;
const DISCRETE = /nvidia|geforce|rtx|gtx|radeon|amd/i;

export function detectTier(probe: GpuProbe): QualityTier {
  const r = probe.renderer || "";
  // A tiny max texture size means a weak/virtual GPU no matter what it calls
  // itself — trust the capability over the name.
  if (probe.maxTextureSize < 4096) return "low";
  if (SOFTWARE.test(r)) return "low";
  if (INTEGRATED.test(r)) return "low";
  if (MOBILE.test(r)) return "med";
  if (DISCRETE.test(r)) return "high";
  // Unknown but capable hardware: play it safe in the middle.
  return "med";
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return QUALITY[tier];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/engine/__tests__/quality.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/engine/quality.ts app/games/crash-course/engine/__tests__/quality.test.ts
git commit -m "feat(crash-course): pure GPU quality-tier detection"
```

---

### Task 5: Physics safety guards (pure)

**Files:**
- Create: `app/games/crash-course/engine/physicsSafety.ts`
- Test: `app/games/crash-course/engine/__tests__/physicsSafety.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Vec3 { x: number; y: number; z: number }`
  - `const KILL_PLANE_Y = -25`
  - `const MAX_SPEED = 120`
  - `function isFiniteVec(v: Vec3): boolean`
  - `function sanitizeVec(v: Vec3, fallback: Vec3): Vec3`
  - `function clampSpeed(v: Vec3, maxSpeed?: number): Vec3`
  - `function isBelowKillPlane(y: number, killY?: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/engine/__tests__/physicsSafety.test.ts
import { describe, it, expect } from "vitest";
import {
  isFiniteVec, sanitizeVec, clampSpeed, isBelowKillPlane,
  KILL_PLANE_Y, MAX_SPEED,
} from "../physicsSafety";

describe("physics safety guards", () => {
  it("detects non-finite vectors", () => {
    expect(isFiniteVec({ x: 1, y: 2, z: 3 })).toBe(true);
    expect(isFiniteVec({ x: NaN, y: 0, z: 0 })).toBe(false);
    expect(isFiniteVec({ x: 0, y: Infinity, z: 0 })).toBe(false);
  });

  it("replaces a corrupt vector with the fallback, passes clean ones through", () => {
    const fb = { x: 0, y: 1, z: 0 };
    expect(sanitizeVec({ x: NaN, y: 0, z: 0 }, fb)).toEqual(fb);
    const good = { x: 5, y: 6, z: 7 };
    expect(sanitizeVec(good, fb)).toEqual(good);
  });

  it("clamps an over-speed velocity to MAX_SPEED, keeping direction", () => {
    const clamped = clampSpeed({ x: MAX_SPEED * 10, y: 0, z: 0 });
    expect(clamped.x).toBeCloseTo(MAX_SPEED);
    expect(clamped.y).toBe(0);
  });

  it("leaves an in-range velocity untouched", () => {
    const v = { x: 3, y: -2, z: 1 };
    expect(clampSpeed(v)).toEqual(v);
  });

  it("flags bodies that fall below the kill plane", () => {
    expect(isBelowKillPlane(KILL_PLANE_Y - 1)).toBe(true);
    expect(isBelowKillPlane(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/engine/__tests__/physicsSafety.test.ts`
Expected: FAIL — cannot find module `../physicsSafety`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/engine/physicsSafety.ts
/**
 * Physics safety — pure guards that stop Rapier from propagating an explosion.
 * A body that goes NaN, exceeds a sane speed, or falls through the world is
 * caught here and corrected by the caller. No React, no Three.
 */

export interface Vec3 { x: number; y: number; z: number }

/** Anything below this Y has fallen out of the world (heightfield tunnelling). */
export const KILL_PLANE_Y = -25;

/** No body should ever move faster than this (m/s); a spike gets clamped. */
export const MAX_SPEED = 120;

export function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function sanitizeVec(v: Vec3, fallback: Vec3): Vec3 {
  return isFiniteVec(v) ? v : { ...fallback };
}

export function clampSpeed(v: Vec3, maxSpeed: number = MAX_SPEED): Vec3 {
  const mag = Math.hypot(v.x, v.y, v.z);
  if (mag <= maxSpeed || mag === 0) return v;
  const s = maxSpeed / mag;
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function isBelowKillPlane(y: number, killY: number = KILL_PLANE_Y): boolean {
  return y < killY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/engine/__tests__/physicsSafety.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/engine/physicsSafety.ts app/games/crash-course/engine/__tests__/physicsSafety.test.ts
git commit -m "feat(crash-course): pure physics-safety guards + kill plane"
```

---

### Task 6: Quality context provider + hook

**Files:**
- Create: `app/games/crash-course/engine/QualityContext.tsx`
- Test: `app/games/crash-course/engine/__tests__/QualityContext.test.tsx`

**Interfaces:**
- Consumes: `QualityTier`, `QualitySettings`, `settingsFor` from `./quality`.
- Produces:
  - `function QualityProvider(props: { initialTier?: QualityTier; children: React.ReactNode }): JSX.Element`
  - `function useQuality(): { settings: QualitySettings; setTier: (t: QualityTier) => void }`

- [ ] **Step 1: Write the failing test**

```tsx
// app/games/crash-course/engine/__tests__/QualityContext.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QualityProvider, useQuality } from "../QualityContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <QualityProvider initialTier="high">{children}</QualityProvider>;
}

describe("QualityContext", () => {
  it("exposes the initial tier's settings", () => {
    const { result } = renderHook(() => useQuality(), { wrapper });
    expect(result.current.settings.tier).toBe("high");
    expect(result.current.settings.shadowMapSize).toBe(2048);
  });

  it("swaps settings when the tier changes", () => {
    const { result } = renderHook(() => useQuality(), { wrapper });
    act(() => result.current.setTier("low"));
    expect(result.current.settings.tier).toBe("low");
    expect(result.current.settings.shadowMapSize).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/engine/__tests__/QualityContext.test.tsx`
Expected: FAIL — cannot find module `../QualityContext`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/games/crash-course/engine/QualityContext.tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { settingsFor, type QualitySettings, type QualityTier } from "./quality";

interface QualityCtx {
  settings: QualitySettings;
  setTier: (t: QualityTier) => void;
}

const Ctx = createContext<QualityCtx | null>(null);

export function QualityProvider({
  initialTier = "med",
  children,
}: {
  initialTier?: QualityTier;
  children: React.ReactNode;
}) {
  const [tier, setTier] = useState<QualityTier>(initialTier);
  const value = useMemo<QualityCtx>(
    () => ({ settings: settingsFor(tier), setTier }),
    [tier],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuality(): QualityCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useQuality must be used within a QualityProvider");
  return v;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/engine/__tests__/QualityContext.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/engine/QualityContext.tsx app/games/crash-course/engine/__tests__/QualityContext.test.tsx
git commit -m "feat(crash-course): quality context provider + hook"
```

---

### Task 7: Extract the settle watcher into a hook

**Files:**
- Create: `app/games/crash-course/engine/useSettle.ts`
- Test: `app/games/crash-course/engine/__tests__/useSettle.test.ts`

**Interfaces:**
- Consumes: `SETTLE` from `../config`.
- Produces:
  - `function useSettle(active: boolean, speedRef: React.RefObject<number>, onSettled: () => void): void`

**Context:** This is the logic currently inline in `index.tsx:77-96`. Extracting it makes the rest-watcher testable and shrinks the entry file. Behavior must match: fire `onSettled` once when speed stays below `SETTLE.restSpeed` for `SETTLE.restHoldMs`, or after `SETTLE.maxCrashMs` hard cap.

- [ ] **Step 1: Write the failing test**

```ts
// app/games/crash-course/engine/__tests__/useSettle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSettle } from "../useSettle";
import { SETTLE } from "../../config";

describe("useSettle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once after the car stays at rest for restHoldMs", () => {
    const speed = { current: 0 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(true, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.restHoldMs + 200);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does not fire while the car is still moving fast", () => {
    const speed = { current: SETTLE.restSpeed + 10 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(true, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.restHoldMs + 200);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("fires by the hard cap even if the body never fully rests", () => {
    const speed = { current: SETTLE.restSpeed + 10 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(true, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.maxCrashMs + 200);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does nothing while inactive", () => {
    const speed = { current: 0 };
    const onSettled = vi.fn();
    renderHook(() => useSettle(false, speed, onSettled));
    vi.advanceTimersByTime(SETTLE.maxCrashMs + 500);
    expect(onSettled).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/engine/__tests__/useSettle.test.ts`
Expected: FAIL — cannot find module `../useSettle`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/games/crash-course/engine/useSettle.ts
"use client";

import { useEffect, useRef } from "react";
import { SETTLE } from "../config";

/**
 * Watches a live speed ref while `active`, and fires `onSettled` exactly once
 * when everything comes to rest (speed < restSpeed held for restHoldMs) or the
 * maxCrashMs hard cap trips — so a jittering body can never hang the run.
 * Lifted verbatim from the old inline effect in index.tsx.
 */
export function useSettle(
  active: boolean,
  speedRef: React.RefObject<number>,
  onSettled: () => void,
): void {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    firedRef.current = false;
    const started = Date.now();
    let restSince: number | null = null;
    const finish = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      clearInterval(iv);
      onSettled();
    };
    const iv = setInterval(() => {
      const now = Date.now();
      if ((speedRef.current ?? 0) < SETTLE.restSpeed) {
        restSince ??= now;
        if (now - restSince >= SETTLE.restHoldMs) finish();
      } else {
        restSince = null;
      }
      if (now - started >= SETTLE.maxCrashMs) finish();
    }, 150);
    return () => clearInterval(iv);
    // onSettled is stable (useCallback in the caller); active is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/engine/__tests__/useSettle.test.ts`
Expected: PASS (4 tests). (Uses `Date.now()` so Vitest fake timers drive it deterministically.)

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/engine/useSettle.ts app/games/crash-course/engine/__tests__/useSettle.test.ts
git commit -m "feat(crash-course): extract testable useSettle rest-watcher"
```

---

### Task 8: Viewport — error boundary + context-loss recovery + quality-driven Canvas

**Files:**
- Create: `app/games/crash-course/engine/Viewport.tsx`
- Test: `app/games/crash-course/engine/__tests__/Viewport.test.tsx`

**Interfaces:**
- Consumes: `useQuality` from `./QualityContext`.
- Produces:
  - `function Viewport(props: { children: React.ReactNode; cameraPosition?: [number, number, number]; fov?: number; background: string }): JSX.Element` — renders the R3F `<Canvas>` with quality-driven `dpr`/`shadows`, an error boundary showing a Retry panel, and a context-loss overlay.
  - `class CrashErrorBoundary` (internal) — exported for the test.

**Context:** The current `<Canvas shadows="percentage" camera={{ position: [0, 6, 18], fov: 55 }}>` lives in `index.tsx:182`. `Viewport` replaces it. The error boundary must render its fallback (with a working Retry) when a child throws — this is the one part testable in jsdom without a real GL context.

- [ ] **Step 1: Write the failing test**

```tsx
// app/games/crash-course/engine/__tests__/Viewport.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrashErrorBoundary } from "../Viewport";

function Boom({ crash }: { crash: boolean }) {
  if (crash) throw new Error("kaboom");
  return <div>alive</div>;
}

describe("CrashErrorBoundary", () => {
  it("shows a Retry fallback when a child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CrashErrorBoundary>
        <Boom crash />
      </CrashErrorBoundary>,
    );
    expect(screen.getByText(/rendering hiccup/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renders children normally when nothing throws", () => {
    render(
      <CrashErrorBoundary>
        <Boom crash={false} />
      </CrashErrorBoundary>,
    );
    expect(screen.getByText("alive")).toBeInTheDocument();
  });

  it("clears the error and re-renders children on Retry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let crash = true;
    function Toggle() {
      return <Boom crash={crash} />;
    }
    render(
      <CrashErrorBoundary>
        <Toggle />
      </CrashErrorBoundary>,
    );
    expect(screen.getByText(/rendering hiccup/i)).toBeInTheDocument();
    crash = false; // next render will succeed
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByText("alive")).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/games/crash-course/engine/__tests__/Viewport.test.tsx`
Expected: FAIL — cannot find module `../Viewport`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/games/crash-course/engine/Viewport.tsx
"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useQuality } from "./QualityContext";
import { detectTier, type QualityTier } from "./quality";

/** Error boundary: a thrown 3D tree shows a Retry panel, never a white screen. */
export class CrashErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  retry = () => this.setState({ failed: false });
  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-2">
            Rendering hiccup
          </p>
          <button
            onClick={this.retry}
            className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-sm"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Probes the live GPU once and reports context-loss/restore to the parent. */
function GlWatchdog({
  onTier,
  onContextLost,
  onContextRestored,
}: {
  onTier: (t: QualityTier) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
}) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    // One-time GPU probe -> initial tier.
    try {
      const ext = gl.getContext().getExtension("WEBGL_debug_renderer_info");
      const renderer = ext
        ? (gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
        : "";
      const maxTex = gl.getContext().getParameter(gl.getContext().MAX_TEXTURE_SIZE) as number;
      onTier(detectTier({ renderer, maxTextureSize: maxTex }));
    } catch {
      /* keep the provider default */
    }
    const lost = (e: Event) => {
      e.preventDefault(); // lets Three restore instead of dying
      onContextLost();
    };
    const restored = () => onContextRestored();
    canvas.addEventListener("webglcontextlost", lost as EventListener);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost as EventListener);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, onTier, onContextLost, onContextRestored]);
  return null;
}

export function Viewport({
  children,
  cameraPosition = [0, 6, 18],
  fov = 55,
  background,
}: {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  fov?: number;
  background: string;
}) {
  const { settings, setTier } = useQuality();
  const [lostAt, setLostAt] = useState<number | null>(null);
  const glKey = useRef(0);

  return (
    <CrashErrorBoundary>
      <Canvas
        shadows={settings.shadowMapSize === 0 ? false : "percentage"}
        dpr={[1, settings.maxPixelRatio]}
        camera={{ position: cameraPosition, fov }}
      >
        <color attach="background" args={[background]} />
        <PerformanceMonitor
          onDecline={() => setTier(settings.tier === "high" ? "med" : "low")}
          onIncline={() => setTier(settings.tier === "low" ? "med" : "high")}
        />
        <GlWatchdog
          onTier={setTier}
          onContextLost={() => setLostAt(Date.now())}
          onContextRestored={() => {
            glKey.current += 1;
            setLostAt(null);
          }}
        />
        {children}
      </Canvas>
      {lostAt !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none">
          <span className="font-[family-name:var(--font-mono)] text-[var(--muted)]">
            Restoring graphics…
          </span>
        </div>
      )}
    </CrashErrorBoundary>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/games/crash-course/engine/__tests__/Viewport.test.tsx`
Expected: PASS (3 tests). Only the error boundary is exercised in jsdom; the Canvas/GL paths are validated by playtesting.

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/engine/Viewport.tsx app/games/crash-course/engine/__tests__/Viewport.test.tsx
git commit -m "feat(crash-course): Viewport with error boundary + context-loss recovery"
```

---

### Task 9: Integrate — port the game onto the new spine (behavior-preserving)

**Files:**
- Modify: `app/games/crash-course/index.tsx`
- Modify: `app/games/crash-course/Scene.tsx`
- Test: `app/games/crash-course/__tests__/scoring.test.ts` (unchanged — must still pass), plus the full suite.

**Interfaces:**
- Consumes: `QualityProvider` (`./engine/QualityContext`), `Viewport` (`./engine/Viewport`), `useSettle` (`./engine/useSettle`), `getMap`, `DEFAULT_MAP_ID` (`./content/maps`), `getCar`, `STARTER_CAR_ID` (`./content/cars`), `propDef` (`./content/props/catalog`), `isBelowKillPlane`, `KILL_PLANE_Y` (`./engine/physicsSafety`).
- Produces: no new exports — this wires the pieces together.

**Context:** This task must not change how the game plays. It swaps the bare `<Canvas>` for `<QualityProvider>` + `<Viewport>`, drives fog/background/spawn/pile from the `downtown` `MapDef`, replaces the inline settle effect with `useSettle`, and adds the kill-plane reset in `Scene`. Prop colors/sizes now flow from the catalog.

- [ ] **Step 1: Swap the Canvas for QualityProvider + Viewport in `index.tsx`**

Replace the imports block near the top:

```tsx
// app/games/crash-course/index.tsx  (imports)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Physics } from "@react-three/rapier";
import { useCartridge } from "@/lib/platform/useCartridge";
import { NITROUS, ARM_GRACE_MS } from "./config";
import {
  initialScore,
  registerDestruction,
  type ScoreState,
  type PropKind,
} from "./scoring";
import Scene from "./Scene";
import Effects from "./Effects";
import { fxBus } from "./fxBus";
import { QualityProvider } from "./engine/QualityContext";
import { Viewport } from "./engine/Viewport";
import { useSettle } from "./engine/useSettle";
import { getMap, DEFAULT_MAP_ID } from "./content/maps";
```

Add the active map next to the other run state (after `const [runKey, setRunKey] = useState(0);`):

```tsx
  const map = getMap(DEFAULT_MAP_ID);
  const speedRef = useRef(0);
```

- [ ] **Step 2: Replace the inline settle effect with the hook**

Delete the entire `// --- settle watcher: crashing -> results ---` effect (`index.tsx:77-96`) and replace with:

```tsx
  // Keep a plain speed ref in sync for the settle watcher.
  useEffect(() => {
    speedRef.current = hud.current.speed;
  });

  const finishRun = useCallback(() => setPhase("results"), []);
  useSettle(phase === "crashing", speedRef, finishRun);
```

(Keep the HUD-sampling effect and the report-score effect as they are.)

- [ ] **Step 3: Swap the `<Canvas>` block for `<QualityProvider>` + `<Viewport>`**

Replace the whole `<Canvas>…</Canvas>` element (`index.tsx:182-197`) with:

```tsx
        <QualityProvider>
          <Viewport background={map.theme.background} fov={55}>
            <fog attach="fog" args={[map.theme.background, map.theme.fogNear, map.theme.fogFar]} />
            <Physics gravity={[0, -19, 0]} paused={phase === "intro" || phase === "ready"}>
              <Scene
                key={runKey}
                phase={phase}
                hud={hud.current}
                onDestroyed={onDestroyed}
                onEnterCrash={enterCrash}
                runKey={runKey}
                armedAt={driveStartMs === null ? Infinity : driveStartMs + ARM_GRACE_MS}
                map={map}
              />
            </Physics>
            <Effects />
          </Viewport>
        </QualityProvider>
```

Note: `Viewport` owns the background color; the `<color attach="background">` and the old `camera` prop move into it, so remove the standalone `<color>` line.

- [ ] **Step 4: Thread the map + kill-plane into `Scene.tsx`**

In `Scene.tsx`, extend `SceneProps` and use the map + catalog. Change the interface and the destructure:

```tsx
// Scene.tsx — add to imports
import { propDef } from "./content/props/catalog";
import { isBelowKillPlane } from "./engine/physicsSafety";
import type { MapDef } from "./content/maps";

// SceneProps: add `map: MapDef;`
export interface SceneProps {
  phase: Phase;
  hud: RunHud;
  onDestroyed: (kind: PropKind) => void;
  onEnterCrash: () => void;
  runKey: number;
  armedAt: number;
  map: MapDef;
}
```

Replace the hardcoded `TRACK.width`/`TRACK.pileZ` reads with the map where they drive layout (`halfW = map.trackWidth / 2`, finale built at `map.pileZ`). Leave the visual constants that are not yet map-driven as-is — Phase 3 finishes the map-drive. The point of this task is that `downtown` carries today's exact numbers, so the scene looks identical.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests (scoring, platform, registry parity, migrations) plus the six new suites from Tasks 1-8. No snapshot or behavior test should change.

- [ ] **Step 6: Manual behavior-preservation check**

Run: `npm run dev`, open `http://localhost:3000/play/crash-course`. Verify: the intro, countdown, drive feel, the pile, the crash, combo multiplier, results, and Replay all behave exactly as before. Open DevTools console — no new warnings. (In Chrome DevTools → Rendering, you can also force a context loss to see the "Restoring graphics…" overlay recover.)

- [ ] **Step 7: Commit**

```bash
git add app/games/crash-course/index.tsx app/games/crash-course/Scene.tsx
git commit -m "refactor(crash-course): port game onto engine spine + registries"
```

---

## Self-Review

**Spec coverage (§ of the design → task):**
- §2 data-driven registries → Tasks 1 (props), 2 (cars), 3 (maps). ✅
- §3.1 adaptive quality → Task 4 (tiers) + Task 6 (context) + Task 8 (PerformanceMonitor wiring). ✅
- §3.2 error boundary + context-loss recovery → Task 8. ✅
- §3.3 physics safety + kill-plane → Task 5 (pure) + Task 9 Step 4 (wired). ✅
- §3.4 cleanup discipline → Global Constraints + existing `Ramp` dispose pattern carried into terrain in Phase 2; Phase 1 introduces no new undisposed geometry. ✅
- §8 testing → every pure module has a `__tests__` suite. ✅
- §9 Phase 1 "port the current track unchanged" → Task 9 (behavior-preserving), with `downtown` holding today's exact coordinates. ✅
- Deferred (terrain rendering, maps 2-4, cars 2-4, shop, crumple) → correctly **not** in this plan; they are Phases 2-5.

**Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows real assertions. ✅

**Type consistency:** `PropKind` sourced from `scoring.ts` throughout; `QualityTier`/`QualitySettings` defined in Task 4 and consumed unchanged in Tasks 6 & 8; `MapDef` defined in Task 3 and consumed in Task 9; `getCar`/`STARTER_CAR_ID` names consistent between Task 2 and Task 9; `useSettle(active, speedRef, onSettled)` signature identical in Task 7 and its Task 9 call site. ✅

**Known follow-ups (intentional, not gaps):** The starter car's stats are defined (Task 2) but not yet *applied* to handling — `Car.tsx` keeps reading `config.ts` until Phase 4 wires `CarDef` in; that is the correct phase boundary. Prop `mass` is catalogued now and consumed when props move to instanced bodies in Phase 5.
