# Crash Course Phase 5 — Feel & Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the final Crash Course phase *feel* good — a combo multiplier that climbs to ×10+ with a sane ceiling and escalating screen-shake + on-screen juice, a car body that crumples like real metal on ordinary impacts (not just the biggest hits), and a handful of new smashable prop kinds — while keeping all pure logic unit-tested and never breaking the running game.

**Architecture:** All *decisions* stay pure and unit-tested in `scoring.ts` (combo cap/window, a `comboShake` shake-curve, an `accrueDeform` plastic-deformation budget) and in `content/props/catalog.ts` (new prop data). The already-real vertex denting in `Vehicle.tsx` is *enhanced* (more pronounced + budgeted + fired on a lower threshold, decoupled from part-shedding), and the 3D/HUD feel is gated by `npm run build` + a documented playtest rather than unit tests. New props reuse the existing per-`RigidBody` `Destructible` path; `InstancedRigidBodies` is noted as a future optimization, not adopted.

**Tech Stack:** Next.js 16 (App Router), React 19, `@react-three/fiber`, `@react-three/rapier` (2.2.0), `three`, Vitest, TypeScript.

## Investigation results (read before implementing — this is what exists on `main`)

- **Combo (`scoring.ts:46-63`).** `registerDestruction` does `multiplier = chained ? state.multiplier + 1 : 1`, `chained = lastHitMs !== null && timeMs - lastHitMs <= windowMs`. **There is NO cap today** — the multiplier is unbounded (a dense pile can spike it arbitrarily high), and `COMBO_WINDOW_MS = 500` (`scoring.ts:25`) is tight. `bestMultiplier` tracks the max. HUD shows it at `index.tsx:147-151` (`COMBO ×{score.multiplier}`, a static badge) and the results screen at `index.tsx:268` (`best combo ×{score.bestMultiplier}`). Scoring is applied in `index.tsx:132-135` (`onDestroyed`), which already imports `fxBus` (`index.tsx:15`).
- **Car denting is ALREADY real vertex deformation.** `Vehicle.tsx:93-116` `dent(worldPoint, worldDir, strength)`: for every body-mesh vertex within `DENT_RADIUS = 0.9` (`Vehicle.tsx:8`) of the world impact point, it pushes the vertex along `worldDir` by `push * f²` (quadratic falloff, `push = min(0.75, strength)`), sets it back into local space, and recomputes normals. Geometry is cloned per instance (`Vehicle.tsx:56`), so dents are **permanent within a run** and localized — this is genuine plastic denting, *not* a whole-body squash. (`Model.tsx:115-191` `DentableModel` is a near-identical, currently-unused twin.)
- **`detachNext` (`Vehicle.tsx:120-133`)** is separate panel-shedding: it walks `detachables` (named `wheel*` nodes + `spoiler`), hides the next visible one, and returns a debris model + world position.
- **How denting fires today (`Car.tsx:220-267`, `onCarContact`).** Denting is gated behind the *heavy* threshold: `mag < handling.damageForce` (starter `carDamageForce = 1100`, `config.ts:52`) returns early, then `applyDamage` (cooldown `carDamageCooldownMs = 220`, `config.ts:54`) gates it further, and **every** damage event both dents (`Car.tsx:251`) AND sheds a part (`Car.tsx:258`). So the car only dents on the biggest slams, and denting and part-loss are welded together.
- **`squashScale` (`scoring.ts:147`) is dead in production** — referenced only by `scoring.test.ts:125-127`. Leave it; removing it is needless churn.
- **Props (`Destructible.tsx`).** Each prop is one `RigidBody` + `CuboidCollider` + a model/procedural mesh; live `SIZE` at `Destructible.tsx:16-22`, `DENSITY` at `:26-32`. Props do **not** vertex-dent — they flash (`:83-87`) and scatter on impact. `PropKind` = `crate | box | barrel | gold | car` (`scoring.ts:11`); `PROP_VALUES` (`scoring.ts:14-20`); colours in `config.ts:84-90` (`PROP_COLOR`) AND `catalog.ts:33-39` (`COLOR`).
- **Catalog SIZE mismatch is real and the catalog is NOT consumed by rendering yet** (no `propDef`/`PROP_CATALOG` import outside `catalog.test.ts`). `catalog.ts:25-31` has `barrel [1.6,1.9,1.6]` and `car [2.0,1.6,4.0]`; the live meshes in `Destructible.tsx` use `barrel [1.35,1.9,1.35]` and `car [4.2,1.6,2.0]`. `structures.ts:17` has its own `H` height table (`car: 1.6`) used by `tower`/`wall`/`pyramid`.
- **`InstancedRigidBodies` IS available** (`@react-three/rapier@2.2.0` exports it). But per-prop denting/flash/destroy state and per-prop model selection make a switch a risky rewrite for no clear win at current prop counts — keep the per-prop path; note instancing as future work.

## How the three §7 items are scoped given that reality

1. **Combo ceiling + multiplier juice (HIGH).** The multiplier already climbs (unbounded) but the window is tight. Scope: add a real **ceiling** (`COMBO_MAX`, so it can't spike to nonsense) and widen `COMBO_WINDOW_MS` so ×10+ is reliably reachable in a pile — pure, unit-tested, with `scoring.test.ts` **updated** to assert the new behavior. Add a pure `comboShake(multiplier)` curve (tested). Then wire escalating shake through the existing `fxBus.addShake` in `index.tsx.onDestroyed`, and make the HUD badge flash/scale-up with the multiplier. Feel gated by build + playtest.
2. **Real metal crumple (HIGH).** `dent()` *already* deforms vertices, so this is an **enhancement**, not a rewrite: extract a pure `accrueDeform` deform-budget helper (tested), make the deformation more pronounced/localized/plastic and clamp it to a per-run budget so the body progressively wrecks, and **decouple denting from part-shedding** — dent on a *lower* threshold (ordinary impacts) while parts still shed only on heavy hits. Feel gated by build + playtest.
3. **Richer props (MEDIUM, kept modest).** Add four light kinds — `cone`, `hydrant`, `signpost`, `fence` — to `PropKind` + `PROP_VALUES` + the catalog (**reconciling** the catalog SIZE table with the live meshes as part of the same task) + `PROP_COLOR`, render them procedurally in `Destructible.tsx`, and scatter a few via `structures.ts`. Keep the per-prop `RigidBody`; note `InstancedRigidBodies` as a future optimization. No new mechanics.

## Global Constraints

- **Pure modules stay pure.** `scoring.ts` and `content/props/catalog.ts` import **no React and no Three**. New scoring behavior (combo cap/window, `comboShake`, `accrueDeform`) and new prop values/sizes are unit-tested with Vitest.
- **Update tests intentionally, don't delete them.** `scoring.test.ts` currently encodes the *old* combo behavior. Where behavior changes, the assertions are **rewritten to the new intended behavior** and the change is called out — never left asserting stale caps and never silently removed.
- **Feel over behavior-preservation, but nothing breaks.** This phase *intentionally* changes feel (combo climbs higher, car crumples more, new props exist). That's fine. The bar is: the game still runs, `npm run build` is exit 0, and the pure test suite is green against the new intended behavior.
- **Per-task gate — all must pass before that task's commit:**
  - `npm test` — full suite green.
  - `npx tsc --noEmit` — clean.
  - `npx eslint app/games/crash-course --max-warnings=0` — clean.
  - `npm run build` — exit 0.
- **Automated coverage lives on the pure logic** (combo math, `comboShake`, `accrueDeform`, new prop values/sizes). **3D and HUD feel is validated by playtest**, not unit tests: Tasks 2, 4, and 6 have no unit test for the R3F/JSX changes and are gated by build + a documented playtest note.
- **Branch:** `feat/crash-course-engine-expansion`. Commit after each task.

---

## File Structure

**Modify:**
- `app/games/crash-course/scoring.ts` — combo cap + window (Task 1), `comboShake` (Task 1), `accrueDeform` + `PANEL_DEFORM_BUDGET` (Task 3), new `PropKind`s + `PROP_VALUES` (Task 5).
- `app/games/crash-course/__tests__/scoring.test.ts` — rewrite combo assertions to new behavior + cover `comboShake` (Task 1), `accrueDeform` (Task 3), new prop values (Task 5).
- `app/games/crash-course/index.tsx` — escalating shake in `onDestroyed` + HUD combo flash/scale (Task 2).
- `app/games/crash-course/Vehicle.tsx` — budgeted, more-pronounced denting (Task 4).
- `app/games/crash-course/Car.tsx` — lower dent threshold decoupled from part-shedding (Task 4).
- `app/games/crash-course/config.ts` — `IMPACT.dentForce` + `IMPACT.dentCooldownMs` (Task 4), `PROP_COLOR` new kinds (Task 5).
- `app/games/crash-course/content/props/catalog.ts` — new kinds + **reconcile SIZE with live meshes** (Task 5).
- `app/games/crash-course/content/props/__tests__/catalog.test.ts` — extend for new kinds + size reconciliation (Task 5).
- `app/games/crash-course/Destructible.tsx` — `SIZE`/`DENSITY` + procedural meshes for new kinds (Task 6).
- `app/games/crash-course/structures.ts` — `H` entries + a scatter of new props (Task 6).

**Create:** none.

---

### Task 1: Combo ceiling, wider window, and a tested shake curve (pure)

Give the combo a real ceiling and a more forgiving window so it reliably reaches ×10+, and add a pure `comboShake` curve that Task 2 will drive the camera with. Update the existing combo tests to the new intended behavior.

**Files:**
- Modify: `app/games/crash-course/scoring.ts:22-63`
- Test: `app/games/crash-course/__tests__/scoring.test.ts:16-64`

**Interfaces:**
- Consumes: existing `ScoreState`, `PropKind`, `PROP_VALUES`.
- Produces: `COMBO_WINDOW_MS = 900`, `COMBO_MAX = 15`, `registerDestruction` capped at `COMBO_MAX`, `comboShake(multiplier: number): number` returning a `0..1` shake amount.

- [ ] **Step 1: Rewrite the combo tests to the new intended behavior**

In `app/games/crash-course/__tests__/scoring.test.ts`, replace the `"resets the combo once the window lapses"` test and add two new ones inside `describe("scoring — weighted destruction + combo", …)`. The reset test's gap must exceed the *new* 900ms window:

```ts
  it("resets the combo once the window lapses", () => {
    let s = initialScore();
    s = registerDestruction(s, "crate", 0); // x1
    s = registerDestruction(s, "crate", 400); // x2 (inside 900ms)
    s = registerDestruction(s, "crate", 1400); // gap 1000 > 900ms -> x1
    expect(s.multiplier).toBe(1);
    expect(s.bestMultiplier).toBe(2);
  });

  it("caps the multiplier at COMBO_MAX no matter how long the chain", () => {
    let s = initialScore();
    for (let i = 0; i < COMBO_MAX + 5; i++) s = registerDestruction(s, "crate", i * 100);
    expect(s.multiplier).toBe(COMBO_MAX);
    expect(s.bestMultiplier).toBe(COMBO_MAX);
  });

  it("chains within the wider 900ms window", () => {
    let s = initialScore();
    s = registerDestruction(s, "crate", 0);
    s = registerDestruction(s, "crate", 850); // was a reset under 500ms, now chains
    expect(s.multiplier).toBe(2);
  });
```

Add `COMBO_MAX` to the import block at `scoring.test.ts:2-14`.

- [ ] **Step 2: Add a `comboShake` test**

Append a new `describe` to `scoring.test.ts`:

```ts
describe("comboShake", () => {
  it("starts modest at x1 and escalates with the multiplier", () => {
    expect(comboShake(1)).toBeCloseTo(0.25);
    expect(comboShake(5)).toBeGreaterThan(comboShake(1));
  });
  it("never exceeds 1", () => {
    expect(comboShake(COMBO_MAX)).toBeLessThanOrEqual(1);
    expect(comboShake(999)).toBe(1);
  });
});
```

Add `comboShake` to the import block.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run app/games/crash-course/__tests__/scoring.test.ts`
Expected: FAIL — `COMBO_MAX` / `comboShake` not exported; the `x850` chain still resets under the old 500ms window.

- [ ] **Step 4: Implement the cap, window, and curve**

In `app/games/crash-course/scoring.ts`, change the window constant (`:25`) and cap the multiplier (`:54`):

```ts
/** Destructions chained within this window escalate the multiplier. */
export const COMBO_WINDOW_MS = 900;

/** Hard ceiling on the combo multiplier — keeps a dense pile from spiking it
 *  to nonsense while still letting it climb well past x10. */
export const COMBO_MAX = 15;
```

Inside `registerDestruction`, replace the `multiplier` line:

```ts
  const multiplier = chained ? Math.min(COMBO_MAX, state.multiplier + 1) : 1;
```

Then add the curve at the end of the combo section (after `registerDestruction`):

```ts
/**
 * Screen-shake amount in [0..1] for a given combo multiplier. Modest at x1 and
 * climbs with the combo so a big chain rattles the camera harder. Pure.
 */
export function comboShake(multiplier: number): number {
  return Math.min(1, 0.25 + (multiplier - 1) * 0.06);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/games/crash-course/__tests__/scoring.test.ts`
Expected: PASS. (The unchanged `"chains the multiplier…"` and `"treats a hit exactly on the window edge as chained"` tests still pass — they use ≤500ms gaps and the `COMBO_WINDOW_MS` constant.)

- [ ] **Step 6: Full gate + commit**

```bash
npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build
git add app/games/crash-course/scoring.ts app/games/crash-course/__tests__/scoring.test.ts
git commit -m "feat(crash-course): cap combo at x15, widen window to 900ms, add comboShake curve"
```

---

### Task 2: Multiplier juice — escalating shake + HUD flash/scale (feel; build + playtest)

Drive the camera shake by the combo through the existing `fxBus`, and make the on-screen `COMBO` badge pop and grow with the multiplier. No unit test — presentational; gated by build + playtest.

**Files:**
- Modify: `app/games/crash-course/index.tsx:132-135` (`onDestroyed`) and `:147-151` (HUD badge)

**Interfaces:**
- Consumes: `comboShake` (Task 1), the module `fxBus` (already imported at `index.tsx:15`).
- Produces: no new exports.

- [ ] **Step 1: Feed the combo into the shake bus**

In `app/games/crash-course/index.tsx`, add `comboShake` to the scoring import (`:7-12`):

```ts
import {
  initialScore,
  registerDestruction,
  comboShake,
  type ScoreState,
  type PropKind,
} from "./scoring";
```

Replace `onDestroyed` (`:132-135`) so the *new* multiplier drives an escalating shake. Compute the next state once, kick the shake, then store it:

```ts
  const onDestroyed = useCallback((kind: PropKind) => {
    if (phaseRef.current !== "driving" && phaseRef.current !== "crashing") return;
    setScore((prev) => {
      const next = registerDestruction(prev, kind, performance.now());
      // Escalating juice: a longer chain shakes the camera harder. fxBus.shake
      // is clamped to 1 internally, so this can never run away.
      fxBus.addShake(comboShake(next.multiplier));
      return next;
    });
  }, []);
```

- [ ] **Step 2: Make the HUD combo badge flash and scale with the multiplier**

Replace the badge block (`index.tsx:147-151`) so its scale and glow grow with `score.multiplier`. Re-keying on the multiplier restarts the CSS transition each bump so it visibly *pops*:

```tsx
        {score.multiplier > 1 && running && (
          <span
            key={score.multiplier}
            className="px-2 py-0.5 rounded bg-[var(--accent-hot)]/30 text-[var(--accent-hot)] flicker origin-center transition-transform duration-150"
            style={{
              transform: `scale(${Math.min(1.9, 1 + score.multiplier * 0.06)})`,
              textShadow: `0 0 ${Math.min(14, score.multiplier)}px var(--accent-hot)`,
            }}
          >
            COMBO ×{score.multiplier}
          </span>
        )}
```

- [ ] **Step 3: Gate + playtest**

Run: `npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build`
Expected: all green / exit 0.

Playtest (`npm run dev`, open the game): start a run, plow a dense structure. **Verify:** the `COMBO ×N` badge grows and brightens as N climbs to ×10+, the camera shake noticeably intensifies on long chains, and there is no runaway/vomit-inducing shake (it's clamped to 1). Note in the commit that feel was playtested.

- [ ] **Step 4: Commit**

```bash
git add app/games/crash-course/index.tsx
git commit -m "feat(crash-course): escalating combo shake + HUD flash/scale (playtested)"
```

---

### Task 3: Plastic-deformation budget helper (pure)

Extract the metal-crumple math — accumulate deformation toward a per-run budget and clamp it — as a pure, tested helper that Task 4 wires into the mesh denting.

**Files:**
- Modify: `app/games/crash-course/scoring.ts` (append after the car-damage section, ~`:149`)
- Test: `app/games/crash-course/__tests__/scoring.test.ts` (new `describe`)

**Interfaces:**
- Consumes: nothing.
- Produces: `PANEL_DEFORM_BUDGET = 2.4`, `interface DeformResult { used: number; applied: number }`, `accrueDeform(used: number, amount: number, max: number): DeformResult`.

- [ ] **Step 1: Write the failing tests**

Append to `app/games/crash-course/__tests__/scoring.test.ts`:

```ts
describe("accrueDeform — plastic deformation budget", () => {
  it("applies the full amount when there is room", () => {
    const r = accrueDeform(0, 0.5, PANEL_DEFORM_BUDGET);
    expect(r.applied).toBeCloseTo(0.5);
    expect(r.used).toBeCloseTo(0.5);
  });

  it("clamps so used never exceeds the budget", () => {
    const r = accrueDeform(PANEL_DEFORM_BUDGET - 0.1, 0.5, PANEL_DEFORM_BUDGET);
    expect(r.used).toBeCloseTo(PANEL_DEFORM_BUDGET);
    expect(r.applied).toBeCloseTo(0.1);
  });

  it("applies nothing once the budget is spent", () => {
    const r = accrueDeform(PANEL_DEFORM_BUDGET, 0.5, PANEL_DEFORM_BUDGET);
    expect(r.applied).toBe(0);
    expect(r.used).toBe(PANEL_DEFORM_BUDGET);
  });

  it("ignores negative amounts", () => {
    const r = accrueDeform(1, -0.3, PANEL_DEFORM_BUDGET);
    expect(r.applied).toBe(0);
    expect(r.used).toBe(1);
  });
});
```

Add `PANEL_DEFORM_BUDGET` and `accrueDeform` to the import block at the top of the test file.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run app/games/crash-course/__tests__/scoring.test.ts`
Expected: FAIL — `accrueDeform` / `PANEL_DEFORM_BUDGET` not exported.

- [ ] **Step 3: Implement the helper**

Append to `app/games/crash-course/scoring.ts`:

```ts
// --- Metal crumple budget --------------------------------------------------

/**
 * How much cumulative plastic deformation (in world metres of vertex push) a
 * car body may accrue over one run before it stops caving further. Bounds the
 * wreck so the body crumples progressively but never turns inside-out.
 */
export const PANEL_DEFORM_BUDGET = 2.4;

export interface DeformResult {
  /** New cumulative deformation total. */
  used: number;
  /** How much of `amount` was actually allowed this hit (0 when spent). */
  applied: number;
}

/**
 * Accrue deformation toward the budget. Returns the new total and the amount
 * actually allowed this hit, clamped so `used` never exceeds `max` and a
 * negative `amount` is a no-op. Pure.
 */
export function accrueDeform(used: number, amount: number, max: number): DeformResult {
  const room = Math.max(0, max - used);
  const applied = Math.max(0, Math.min(amount, room));
  return { used: used + applied, applied };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run app/games/crash-course/__tests__/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build
git add app/games/crash-course/scoring.ts app/games/crash-course/__tests__/scoring.test.ts
git commit -m "feat(crash-course): add plastic-deformation budget helper (accrueDeform)"
```

---

### Task 4: Enhanced metal crumple — budgeted, pronounced denting on ordinary impacts (feel; build + playtest)

Make the *already-real* vertex denting deeper and more localized, clamp it to the per-run budget from Task 3, and fire it on ordinary impacts — decoupled from part-shedding, which stays on heavy hits only. Feel gated by build + playtest.

**Files:**
- Modify: `app/games/crash-course/config.ts:44-57` (`IMPACT`)
- Modify: `app/games/crash-course/Vehicle.tsx:8`, `:86-138`
- Modify: `app/games/crash-course/Car.tsx:220-267` (`onCarContact`)

**Interfaces:**
- Consumes: `accrueDeform`, `PANEL_DEFORM_BUDGET` (Task 3).
- Produces: `IMPACT.dentForce = 400`, `IMPACT.dentCooldownMs = 90`. `VehicleApi.dent` signature is unchanged (Car keeps calling `dent(point, dir, amount)`); its behavior becomes budgeted + more pronounced. `VehicleApi.detachNext` unchanged.

- [ ] **Step 1: Add the lighter dent thresholds to config**

In `app/games/crash-course/config.ts`, add two fields inside the `IMPACT` object (after `carDamageCooldownMs`, `:54`):

```ts
  /** Contact-force that dents the body (localized crumple only, no part loss).
   *  Much lower than carDamageForce so the car visibly takes damage on ordinary
   *  scrapes and shunts, not just the biggest slams. */
  dentForce: 400,
  /** Min ms between dent events — denser than part-shedding so crumple builds
   *  smoothly without deforming every physics frame. */
  dentCooldownMs: 90,
```

- [ ] **Step 2: Make `dent()` budgeted and more pronounced in Vehicle.tsx**

Tighten the dent radius for a more localized cave (`Vehicle.tsx:8`):

```ts
const DENT_RADIUS = 0.7;
```

In the `useEffect` (`Vehicle.tsx:86-138`), add a running deform accumulator alongside `detachIdx`, and rewrite the `dent` body to pull the allowed push from `accrueDeform` and deepen the falloff. Import the helpers at the top of the file:

```ts
import { accrueDeform, PANEL_DEFORM_BUDGET } from "./scoring";
```

Then inside the effect:

```ts
    const inv = new THREE.Matrix4();
    const wv = new THREE.Vector3();
    const lp = new THREE.Vector3();
    let detachIdx = 0;
    let deformUsed = 0;

    apiRef.current = {
      dent: (worldPoint, worldDir, strength) => {
        // Budgeted plastic crumple: a deeper base push than before, but the run
        // total is clamped so the body wrecks progressively and never inverts.
        const want = Math.min(0.9, strength) * 0.7;
        const { used, applied } = accrueDeform(deformUsed, want, PANEL_DEFORM_BUDGET);
        deformUsed = used;
        if (applied <= 0) return;
        for (const m of state.bodyMeshes) {
          m.updateWorldMatrix(true, false);
          inv.copy(m.matrixWorld).invert();
          const attr = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          let touched = false;
          for (let i = 0; i < attr.count; i++) {
            wv.fromBufferAttribute(attr, i).applyMatrix4(m.matrixWorld);
            const d = wv.distanceTo(worldPoint);
            if (d < DENT_RADIUS) {
              const f = 1 - d / DENT_RADIUS;
              // f*f*f gives a sharper, more localized crater than the old f*f.
              wv.addScaledVector(worldDir, applied * f * f * f);
              lp.copy(wv).applyMatrix4(inv);
              attr.setXYZ(i, lp.x, lp.y, lp.z);
              touched = true;
            }
          }
          if (touched) {
            attr.needsUpdate = true;
            m.geometry.computeVertexNormals();
          }
        }
      },
      spinWheels: (delta) => {
        for (const w of state.wheels) w.rotation.x += delta;
      },
      detachNext: () => {
        // unchanged from current implementation
        while (detachIdx < state.detachables.length) {
          const d = state.detachables[detachIdx++];
          if (d.node.visible) {
            d.node.visible = false;
            d.node.updateWorldMatrix(true, false);
            const p = new THREE.Vector3().setFromMatrixPosition(d.node.matrixWorld);
            const model =
              d.part === "wheel" ? DEBRIS_MODELS[2] : DEBRIS_MODELS[3];
            return { model, pos: [p.x, p.y, p.z] };
          }
        }
        return null;
      },
    };
```

- [ ] **Step 3: Decouple denting from part-shedding in Car.tsx**

In `app/games/crash-course/Car.tsx.onCarContact` (`:220-267`), split the two paths. Dent on the *lighter* `IMPACT.dentForce` with its own cooldown; keep `applyDamage` + `detachNext` (part loss) on the *heavy* `handling.damageForce`. Replace the body from the `if (mag < handling.damageForce …) return;` line (`:233`) onward with:

```ts
    if (now < armedAt) return;

    // --- Light crumple path: dents on ordinary impacts. -------------------
    if (mag >= IMPACT.dentForce && now - lastDent.current > IMPACT.dentCooldownMs) {
      lastDent.current = now;
      const o = p.other.rigidBody?.translation();
      let px = t.x, py = t.y + 0.2, pz = t.z;
      let dx = _fwd.x, dy = -0.2, dz = _fwd.z;
      if (o) {
        const vx = o.x - t.x, vy = o.y - t.y, vz = o.z - t.z;
        const dist = Math.hypot(vx, vy, vz) || 1;
        const nx = vx / dist, ny = vy / dist, nz = vz / dist;
        const reach = Math.min(dist, 2.2);
        px = t.x + nx * reach; py = t.y + ny * reach; pz = t.z + nz * reach;
        dx = -nx; dy = -Math.abs(ny) * 0.5 - 0.1; dz = -nz;
      }
      vehicle.current?.dent(
        new THREE.Vector3(px, py, pz),
        new THREE.Vector3(dx, dy, dz).normalize(),
        Math.min(0.9, 0.3 + mag / 6000),
      );
    }

    // --- Heavy path: shed a real part on genuine slams only. --------------
    if (mag < handling.damageForce) return;
    const res = applyDamage(damageRef.current, now, IMPACT.carDamageCooldownMs);
    if (!res.applied) return;
    damageRef.current = res.state;

    const part = vehicle.current?.detachNext();
    if (part) {
      const lv = b.linvel();
      debrisBus.emit(part.model, part.pos, [
        lv.x + (Math.random() - 0.5) * 6,
        lv.y + 4 + Math.random() * 3,
        lv.z + (Math.random() - 0.5) * 6,
      ]);
    }
```

Add the `lastDent` ref beside the existing refs (near `Car.tsx:74`, `const vehicle = useRef<VehicleApi | null>(null);`):

```ts
  const lastDent = useRef(0);
```

(The old combined block that called `dent` then `detachNext` on every `applyDamage` event is fully replaced by the two paths above.)

- [ ] **Step 4: Gate + playtest**

Run: `npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build`
Expected: all green / exit 0. (No unit test asserts mesh geometry — the crumple math is covered by Task 3's `accrueDeform` tests.)

Playtest (`npm run dev`): drive through the track structures and into the pile. **Verify:** the car body visibly dents on ordinary shunts (not only huge slams), the dents are localized craters that deepen as you keep hitting things, the body stops caving once thoroughly wrecked (budget), and wheels/spoiler still fly off on the big hits. **FLAG:** `DENT_RADIUS` (0.7), the `*0.7` base-push and `f*f*f` falloff, `PANEL_DEFORM_BUDGET` (2.4), and `IMPACT.dentForce` (400) are feel knobs — expect to tune them in playtest; they live in one place each for exactly that.

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/config.ts app/games/crash-course/Vehicle.tsx app/games/crash-course/Car.tsx
git commit -m "feat(crash-course): deeper budgeted metal crumple on ordinary impacts, decoupled from part-shedding (playtested)"
```

---

### Task 5: New smashable prop kinds + catalog SIZE reconciliation (pure)

Add `cone`, `hydrant`, `signpost`, `fence` to the pure prop data — `PropKind`, `PROP_VALUES`, `PROP_COLOR`, and the catalog — and **reconcile** the catalog's provisional SIZE table with the live meshes at the same time (so the long-standing Phase-1 mismatch is fixed before Task 6 consumes these sizes).

**Files:**
- Modify: `app/games/crash-course/scoring.ts:11`, `:14-20`
- Modify: `app/games/crash-course/config.ts:84-90` (`PROP_COLOR`)
- Modify: `app/games/crash-course/content/props/catalog.ts:25-47`
- Test: `app/games/crash-course/__tests__/scoring.test.ts` (extend prop-value coverage)
- Test: `app/games/crash-course/content/props/__tests__/catalog.test.ts:5` and add a reconciliation test

**Interfaces:**
- Consumes: existing `PropDef`.
- Produces: `PropKind` gains `"cone" | "hydrant" | "signpost" | "fence"`; `PROP_VALUES` gains `cone: 15, hydrant: 40, fence: 30, signpost: 60`; catalog `SIZE` now matches the live meshes for all kinds. The values Task 6's `Destructible`/`structures` rely on: `cone [0.7,1.1,0.7]`, `hydrant [0.6,1.1,0.6]`, `signpost [0.3,2.6,0.3]`, `fence [2.4,1.4,0.3]`.

- [ ] **Step 1: Write failing tests for the new kinds + size reconciliation**

In `app/games/crash-course/__tests__/scoring.test.ts`, extend the weighting test to reference a new light kind, and add a value assertion inside `describe("scoring — weighted destruction + combo", …)`:

```ts
  it("scores the new light props below the heavy ones", () => {
    expect(PROP_VALUES.cone).toBe(15);
    expect(PROP_VALUES.cone).toBeLessThan(PROP_VALUES.barrel);
    expect(PROP_VALUES.signpost).toBeGreaterThan(PROP_VALUES.cone);
  });
```

In `app/games/crash-course/content/props/__tests__/catalog.test.ts`, extend the `KINDS` array (`:5`) and add a reconciliation test that pins the catalog SIZE to the live-mesh values:

```ts
const KINDS: PropKind[] = [
  "crate", "box", "barrel", "gold", "car",
  "cone", "hydrant", "signpost", "fence",
];
```

```ts
  it("catalog sizes match the live Destructible meshes (reconciled)", () => {
    expect(propDef("barrel").size).toEqual([1.35, 1.9, 1.35]);
    expect(propDef("car").size).toEqual([4.2, 1.6, 2.0]);
    expect(propDef("cone").size).toEqual([0.7, 1.1, 0.7]);
    expect(propDef("fence").size).toEqual([2.4, 1.4, 0.3]);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run app/games/crash-course/__tests__/scoring.test.ts app/games/crash-course/content/props/__tests__/catalog.test.ts`
Expected: FAIL — new keys missing; catalog `barrel`/`car` sizes still `[1.6,1.9,1.6]`/`[2.0,1.6,4.0]`.

- [ ] **Step 3: Extend `PropKind` + `PROP_VALUES`**

In `app/games/crash-course/scoring.ts`:

```ts
export type PropKind =
  | "crate" | "box" | "barrel" | "gold" | "car"
  | "cone" | "hydrant" | "signpost" | "fence";

/** Weighted destruction: colour/type carries the value. */
export const PROP_VALUES: Record<PropKind, number> = {
  crate: 10,
  box: 25,
  barrel: 50,
  gold: 200,
  car: 300,
  cone: 15,
  hydrant: 40,
  fence: 30,
  signpost: 60,
};
```

- [ ] **Step 4: Add colours in config**

In `app/games/crash-course/config.ts`, extend `PROP_COLOR` (`:84-90`):

```ts
export const PROP_COLOR: Record<PropKind, string> = {
  crate: "#9a9a9a",
  box: "#b0803f",
  barrel: "#d63d3d",
  gold: "#ffd24a",
  car: "#4a7bd6",
  cone: "#ff6a1f",
  hydrant: "#c8352b",
  signpost: "#3ba35a",
  fence: "#8a8f96",
};
```

- [ ] **Step 5: Reconcile + extend the catalog**

In `app/games/crash-course/content/props/catalog.ts`, replace the SIZE table (`:20-31`) with reconciled + new values (drop the "PROVISIONAL" note), and extend `COLOR` (`:33-39`) and `MASS` (`:41-47`):

```ts
// Reconciled with the live meshes in Destructible.tsx (Phase 5). These sizes
// are now the source the scene consumes — keep them in lockstep with
// Destructible SIZE and structures.ts H.
const SIZE: Record<PropKind, [number, number, number]> = {
  crate: [1.6, 1.6, 1.6],
  box: [1.9, 1.9, 1.9],
  barrel: [1.35, 1.9, 1.35],
  gold: [1.6, 1.6, 1.6],
  car: [4.2, 1.6, 2.0],
  cone: [0.7, 1.1, 0.7],
  hydrant: [0.6, 1.1, 0.6],
  signpost: [0.3, 2.6, 0.3],
  fence: [2.4, 1.4, 0.3],
};

const COLOR: Record<PropKind, string> = {
  crate: "#9a9a9a",
  box: "#b0803f",
  barrel: "#d63d3d",
  gold: "#ffd24a",
  car: "#4a7bd6",
  cone: "#ff6a1f",
  hydrant: "#c8352b",
  signpost: "#3ba35a",
  fence: "#8a8f96",
};

const MASS: Record<PropKind, number> = {
  crate: 1,
  box: 1.4,
  barrel: 2,
  gold: 1,
  car: 12,
  cone: 0.3,
  hydrant: 1.6,
  signpost: 0.8,
  fence: 0.9,
};
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run app/games/crash-course/__tests__/scoring.test.ts app/games/crash-course/content/props/__tests__/catalog.test.ts`
Expected: PASS. (`catalog.test.ts`'s existing "positive size and mass" and "cars heavier than crates" tests now also cover the new kinds via the extended `KINDS`.)

- [ ] **Step 7: Full gate + commit**

```bash
npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build
git add app/games/crash-course/scoring.ts app/games/crash-course/config.ts app/games/crash-course/content/props/catalog.ts app/games/crash-course/__tests__/scoring.test.ts app/games/crash-course/content/props/__tests__/catalog.test.ts
git commit -m "feat(crash-course): add cone/hydrant/signpost/fence prop data + reconcile catalog sizes with live meshes"
```

---

### Task 6: Render + place the new props (feel; build + playtest)

Give the four new kinds live meshes/colliders in `Destructible.tsx` and scatter a few down the track via `structures.ts`. Keep the per-`RigidBody` path; note `InstancedRigidBodies` as future work.

**Files:**
- Modify: `app/games/crash-course/Destructible.tsx:16-32` (`SIZE`, `DENSITY`) and `:138-169` (render branch)
- Modify: `app/games/crash-course/structures.ts:17` (`H`) and add a scatter helper + calls

**Interfaces:**
- Consumes: reconciled sizes/colours from Task 5 (`Destructible` keeps its own literal `SIZE`/`DENSITY`, which must match the catalog).
- Produces: no new exports; new props appear in the scene.

- [ ] **Step 1: Add SIZE + DENSITY for the new kinds in Destructible**

In `app/games/crash-course/Destructible.tsx`, extend `SIZE` (`:16-22`) to match the catalog exactly, and `DENSITY` (`:26-32`) with light values:

```ts
const SIZE: Record<PropKind, [number, number, number]> = {
  crate: [1.6, 1.6, 1.6],
  box: [1.9, 1.9, 1.9],
  barrel: [1.35, 1.9, 1.35],
  gold: [1.6, 1.6, 1.6],
  car: [4.2, 1.6, 2.0],
  cone: [0.7, 1.1, 0.7],
  hydrant: [0.6, 1.1, 0.6],
  signpost: [0.3, 2.6, 0.3],
  fence: [2.4, 1.4, 0.3],
};

const DENSITY: Record<PropKind, number> = {
  crate: 0.1,
  box: 0.12,
  barrel: 0.14,
  gold: 0.2,
  car: 0.7,
  cone: 0.05,
  hydrant: 0.18,
  signpost: 0.08,
  fence: 0.09,
};
```

- [ ] **Step 2: Render the new kinds**

In the render branch (`Destructible.tsx:138-169`), add cases before the final `else`. `cone` and `hydrant` are cylinders; `signpost` and `fence` are boxes. They reuse the existing `material` (coloured from `PROP_COLOR`) and share the existing `CuboidCollider args={half}`. Insert after the `barrel` branch (`:156-159`):

```tsx
      ) : kind === "cone" ? (
        <mesh material={material} castShadow receiveShadow>
          <coneGeometry args={[size[0] / 2, size[1], 16]} />
        </mesh>
      ) : kind === "hydrant" ? (
        <mesh material={material} castShadow receiveShadow>
          <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[1], 14]} />
        </mesh>
      ) : kind === "signpost" ? (
        <mesh material={material} castShadow receiveShadow>
          <boxGeometry args={size} />
        </mesh>
      ) : kind === "fence" ? (
        <RoundedBox args={size} radius={0.05} smoothness={2} material={material} castShadow receiveShadow />
      ) : (
```

(The existing final `else` — the generic `RoundedBox` for `box`/`gold` — stays as the last branch.)

- [ ] **Step 3: Add H entries + a scatter of new props in structures.ts**

In `app/games/crash-course/structures.ts`, extend the `H` height table (`:17`) so `tower`/`wall`/`pyramid` type-check against the widened `PropKind`, and add small-prop heights:

```ts
const H = {
  crate: 1.6, box: 1.9, barrel: 1.9, gold: 1.6, car: 1.6,
  cone: 1.1, hydrant: 1.1, signpost: 2.6, fence: 1.4,
};
```

Add a scatter helper after `pack` (`:56`):

```ts
/** A roadside dressing of light street props around a point. */
function streetDressing(x: number, z: number, out: PileItem[]) {
  out.push({ kind: "cone", position: [x, 0.55, z] });
  out.push({ kind: "cone", position: [x + 1.0, 0.55, z + 0.6] });
  out.push({ kind: "hydrant", position: [x - 1.2, 0.55, z] });
  out.push({ kind: "signpost", position: [x + 2.0, 1.3, z - 0.5] });
  out.push({ kind: "fence", position: [x - 0.4, 0.7, z - 1.4] });
}
```

Call it a couple of times inside `buildTrackStructures` (before its `return out;`, `:105`) so the new props line the run-in:

```ts
  streetDressing(-8, -14, out);
  streetDressing(9, -38, out);
```

- [ ] **Step 4: Gate + playtest**

Run: `npm test && npx tsc --noEmit && npx eslint app/games/crash-course --max-warnings=0 && npm run build`
Expected: all green / exit 0.

Playtest (`npm run dev`): drive the track. **Verify:** cones, a hydrant, a signpost, and a fence appear roadside, smash and scatter when hit, score their values (15/40/60/30), and feed the combo like any other prop. Confirm no collider/mesh mismatch (props sit on the ground, not floating or sunk). Note in the commit that placement was playtested.

- [ ] **Step 5: Commit**

```bash
git add app/games/crash-course/Destructible.tsx app/games/crash-course/structures.ts
git commit -m "feat(crash-course): render + scatter cone/hydrant/signpost/fence props (playtested)"
```

> **Future optimization (not in scope):** `@react-three/rapier@2.2.0` exports `InstancedRigidBodies`, which could render many identical light props (cones/fences) in one draw call. It's deferred: the current per-prop `RigidBody` carries per-prop destroy/flash/scatter state and per-prop model selection, so instancing is a real rewrite of `Destructible` for no clear win at present prop counts.

---

## Self-Review

**1. Spec coverage.**
- §7 item 1 (combo ceiling + juice, HIGH): Task 1 (cap ×15, window 900ms, `comboShake`, tests updated) + Task 2 (escalating shake + HUD flash/scale). ✓
- §7 item 2 (real metal crumple, HIGH): Task 3 (`accrueDeform` budget, tested) + Task 4 (deeper/localized/budgeted denting on lower threshold, decoupled from part-shedding). ✓
- §7 item 3 (richer props, MEDIUM): Task 5 (data + SIZE reconciliation, tested) + Task 6 (render + place). Instancing noted as future, not forced. ✓
- Global: pure logic tested (Tasks 1, 3, 5); feel gated by build + playtest (Tasks 2, 4, 6); tests updated intentionally, not deleted (Task 1 Step 1, Task 5 Steps 1–2). ✓

**2. Placeholder scan.** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows real code. ✓

**3. Type consistency.** `PropKind` widened once in Task 5 and every `Record<PropKind, …>` consumer (`PROP_VALUES`, `PROP_COLOR`, catalog `SIZE`/`COLOR`/`MASS`, `Destructible` `SIZE`/`DENSITY`, `structures` `H`) is updated to match. `comboShake`/`accrueDeform`/`PANEL_DEFORM_BUDGET`/`COMBO_MAX` names are identical across `scoring.ts`, the tests, `index.tsx`, and `Vehicle.tsx`. `VehicleApi.dent`/`detachNext` signatures are unchanged, so `Car.tsx`'s existing calls stay valid. `IMPACT.dentForce`/`dentCooldownMs` defined in Task 4 Step 1 before use in Step 3. `catalog` `SIZE` (Task 5) and `Destructible` `SIZE` (Task 6) carry identical literals, pinned by the Task 5 reconciliation test. ✓

**Note:** `squashScale` (`scoring.ts:147`) remains dead production code (only its tests reference it); intentionally left untouched to avoid needless churn.
