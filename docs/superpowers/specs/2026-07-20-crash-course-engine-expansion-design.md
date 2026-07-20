# Crash Course — engine robustness & expansion design

**Status:** Approved design (2026-07-20). Supersedes the vertical-slice scope of
`2026-07-19-crash-course-design.md` — that slice shipped; this turns it into a
robust, data-driven, content-rich demolition-driving game.

**One-line goal:** Make Crash Course a *distinctive* car game — real drivable
hills, multiple maps, buyable stat-differentiated cars, real metal-crumple
damage, a deeper combo multiplier — on top of a hardened, adaptive, testable 3D
engine that runs well on any device and never breaks.

## 1. Confirmed decisions

| Area | Decision |
| --- | --- |
| **Engine model** | Clean module boundaries inside `crash-course/engine/` now; defer extraction to a shared `lib/engine3d/` until a 2nd 3D game proves what's reusable ("both, phased") |
| **Sequencing** | **Foundation-first (Approach A):** engine + robustness before content; terrain before the content that stands on it |
| **Terrain** | Real drivable heightfield — the car climbs, crests, and launches off hills; ramps become terrain |
| **Car controller** | **(A) Ground-raycast arcade** — single dynamic body, raycast-to-ground for height + slope-normal alignment, arcade velocity along the slope. (Rejected: full `DynamicRayCastVehicleController` sim — higher tuning risk, not exposed by the R3F wrapper) |
| **Maps** | 3–4 free-select maps (Downtown / Hills / Highway / Canyon), all unlocked, chosen before a run |
| **Cars** | Stat-differentiated (mass, top speed, accel, grip, durability) on B-Token price tiers — the first real token sink |
| **Multiplier** | Deepen the existing in-run combo (higher ceiling, window tuning, screen-shake + escalating flash). No shop involvement |
| **Robustness** | All three pillars: adaptive GPU quality scaling · never-breaks hardening (error boundary, context-loss recovery, physics safety, no leaks) · data-driven + unit-tested architecture |
| **Fidelity** | More unique props, cohesive "real object" models, real metal-crumple car damage |

## 2. Architecture & module boundaries

Turn today's hardcoded single track into a **data-driven engine**: maps, cars,
and props become data, not code. Target layout inside `app/games/crash-course/`:

```
crash-course/
  engine/                    ← reusable spine (extraction candidate later)
    Viewport.tsx             Canvas + <Physics> + error boundary + context-loss recovery
    quality.ts               GPU detect → tier (low/med/high): pixel ratio, shadow res, effects, draw distance
    QualityContext.tsx       provides the active tier to the scene
    Terrain.tsx              heightfield mesh + <HeightfieldCollider>
    terrain.ts               PURE: height(x,z) & normal(x,z) samplers, procedural gen from a seed
    physicsSafety.ts         PURE: NaN/Infinity guards, out-of-bounds respawn, velocity clamps
    useSettle.ts             crashing→results rest-watcher (lifted out of index.tsx)
  content/
    maps/     index.ts + downtown.ts hills.ts highway.ts canyon.ts   (MapDef registry)
    cars/     index.ts + one file per car                            (CarDef registry)
    props/    catalog.ts                                             (PropDef catalog)
  car/
    Car.tsx                  consumes the active CarDef; ground-aware handling
    damage.ts                PURE: crumple/dent state machine (vertex deform budget, panel shedding)
  game/
    index.tsx                state machine + HUD + mounts <Viewport><Scene/>
    Scene.tsx                composes terrain + active map's props + car
    scoring.ts               (exists) combo reducer — higher ceiling
    Shop.tsx / Garage.tsx    (Phase 4)
```

**Boundary rules**

- `terrain.ts`, `physicsSafety.ts`, `scoring.ts`, `damage.ts`, and the
  `maps/cars/props` registries are **pure data/logic — no React, no Three** — so
  they are all unit-testable. This *is* the "clean, testable architecture"
  pillar.
- **A map is a data file:** terrain seed + params, prop layout (reusing the
  `tower/wall/pyramid/pack` builders), spawn, pile location, theme (sky, fog,
  light rig). Adding a 5th map = one file.
- **A car is a data file:** stats + model params. The current single `CAR`
  constant in `config.ts` becomes the starter-car `CarDef`.
- `engine/` knows nothing about crash-course content — it takes terrain params
  and quality tiers. That is what makes the eventual `lib/engine3d/` extraction
  a *move*, not a *rewrite*.

## 3. Engine robustness spine (Phase 1)

Four independent, individually testable pieces.

**3.1 Adaptive quality (`quality.ts` + `QualityContext`)**
Probe the GPU once on mount (`WEBGL_debug_renderer_info` unmasked renderer, max
texture size, integrated/mobile heuristic) → pick a tier:

| Tier | Pixel ratio | Shadows | Post FX | Draw distance | Terrain segs |
| --- | --- | --- | --- | --- | --- |
| low | 1.0 | off | off | near fog | coarse |
| med | ≤1.5 | 1024 PCF | bloom | mid | medium |
| high | ≤2.0 | 2048 PCF | bloom + vignette | far | fine |

Runtime adaptation uses drei's **`<PerformanceMonitor>`** (onDecline/onIncline
with hysteresis bounds to avoid ping-pong) plus **`<AdaptiveDpr>`** — the
pmndrs-blessed pattern, not a hand-rolled watchdog. It **drops quality, never
framerate**. Tier is user-overridable via a small selector; default Auto.

**3.2 Error boundary + WebGL context-loss recovery (`Viewport.tsx`)**
- React error boundary around the Canvas → on a thrown 3D error, show a
  "Rendering hiccup — Retry" panel over the last frame (not a white screen);
  Retry remounts the scene cleanly.
- Listen for `webglcontextlost` (preventDefault, pause physics, "Restoring…"
  overlay) and `webglcontextrestored` (remount via key bump, the existing
  `runKey` mechanism). Three's `WebGLRenderer` restores GL state by default; our
  job is the UX overlay + a clean scene remount. Note: leaks *cause* context
  loss, so 3.4 is part of this fix.

**3.3 Physics safety (`physicsSafety.ts`, pure)**
- Guard dynamic bodies each step: `NaN`/`Infinity` or out-of-bounds position/
  velocity → clamp or respawn/despawn instead of letting Rapier propagate an
  explosion.
- **Kill-plane / out-of-bounds Y:** anything below the world floor (including
  the car on a bad terrain launch) is caught — car nudged back onto the surface,
  loose props recycled. This is the backstop for heightfield tunnelling (a known
  Rapier finickiness) so the car can never fall through a hill forever.
- Velocity clamps so a bad contact-force spike can't fling a body at absurd speed.

**3.4 Guaranteed cleanup (leak prevention)**
- Every `useMemo` geometry/material/heightfield gets a matching `dispose()` on
  unmount. Per-run deformed car geometry **must** be freed on reset.
- Map remount / car swap tears down the whole physics world via the key-bump
  pattern; nothing carries between runs. A dev/test resource-count assertion
  guards against regressions.

## 4. Drivable terrain + car rework (Phase 2)

**Terrain.** `<HeightfieldCollider args={[nrows, ncols, heights, scale]}>`
(heights column-major) paired with a displaced `PlaneGeometry` visual.
`terrain.ts` generates `heights` from a per-map seed + params and exposes
`height(x,z)` / `normal(x,z)`; the car *and* prop placement query these so props
rest on the hills.

**Car controller (A) — ground-raycast arcade.** Keep the single dynamic body
and the grippy arcade feel. Each physics step:
1. Raycast down from the chassis → ground height + surface normal.
2. Ride at suspension height above the ground; **align the car to the slope
   normal** (smoothed) so it hugs contours.
3. Project desired throttle velocity along the slope tangent → natural climb,
   crest, and launch off ramps; steering stays speed-scaled and forgiving.
4. When airborne (ray misses within suspension range), fall to arcade air
   control — no ground alignment — then re-settle on landing.

The kill-plane (3.3) backstops any tunnelling. No per-wheel suspension tuning —
the arcade body keeps feel-tuning to `config.ts`.

## 5. Maps (Phase 3)

`MapDef = { id, name, terrainParams(seed), theme(sky/fog/lights), propLayout,
spawn, pileZ }`. The `tower/wall/pyramid/pack` builders become the layout
vocabulary, now placed on terrain via the height sampler. Launch set:
- **Downtown** — today's flat-ish city, ported to the new pipeline.
- **Hills** — rolling heightfield, crests and dips.
- **Highway** — long straight, more slow-moving traffic cars.
- **Canyon** — steep walls + big terrain jumps.

A pre-run map-select strip (all unlocked) picks the `MapDef`; the scene rebuilds
via `runKey`.

## 6. Cars + shop (Phase 4)

`CarDef = { id, name, price, stats:{mass, topSpeed, accel, grip, durability},
model }`. Four tiers: Rust Bucket (free) → Muscle → Monster Truck → Demolisher.

- **Garage/Shop** screen spends **B-Tokens** via the economy's existing
  `spend()` (first real sink). Owned cars + selected car persist through the
  platform save system.
- `Car.tsx` reads the active `CarDef` instead of the hardcoded `CAR` constant.
- Stats feed both handling and the crash: a heavy Monster Truck carries more
  momentum into the pile (deeper plow); a Speedster is fast but fragile.

## 7. Feel & fidelity (Phase 5)

- **Combo ceiling:** raise the cap (×10+), tune the window, add screen-shake and
  a multiplier flash that intensifies as it climbs — the "multiplier juice".
- **Real metal crumple (`damage.ts`):** on impact, displace each nearby vertex
  along the ray from the impact point, scaled by proximity and impact force,
  **plastic (permanent within a run — no elastic spring-back)**, clamped by a
  per-panel deform budget so the car dents progressively into a wreck. Replaces
  the whole-body squash; keeps panel-shedding for big hits. Deformed geometry is
  per-run and disposed on reset (§3.4).
- **Richer props + performance:** expand `PropDef` (signposts, hydrants, fences,
  planters, phone booths, …). Render many cheaply with **`InstancedRigidBodies`**
  (one draw call per prop type) and **`<Physics updateLoop="independent">`** so
  the canvas only re-renders when bodies move — this is what keeps "more objects
  + better graphics" smooth on weak GPUs.

## 8. Testing

Pure cores get Vitest unit tests (matching existing `__tests__` conventions):
- `scoring` — higher ceiling, combo window in/out/reset.
- `terrain` — height/normal sampling, determinism from seed.
- `physicsSafety` — NaN/OOB clamps, kill-plane recycle.
- `damage` — deform budget, plasticity (no spring-back).
- `cars` — stat application to handling/crash.
- shop `spend` — afford/deny, persistence.

3D rendering and physics *feel* stay validated by playtesting, not unit tests.

## 9. Phased roadmap (each phase = its own plan + review)

1. **Engine & robustness spine** — quality tiers + PerformanceMonitor/AdaptiveDpr,
   error boundary + context-loss recovery, physicsSafety + kill-plane, cleanup
   discipline, and the data-driven `maps/cars/props` registries + their tests.
   (Ports the *current* single track onto the new pipeline unchanged, to prove
   the refactor is behavior-preserving.)
2. **Drivable terrain + car ground-handling rework.**
3. **Maps** — Downtown/Hills/Highway/Canyon as data + free-select UI.
4. **Cars + shop** — stat tiers, B-Token spend, garage UI, persistence.
5. **Feel & fidelity** — combo ceiling + juice, metal-crumple damage, richer
   instanced props.

## 10. Explicitly out of scope (deferred)

Extraction to a shared `lib/engine3d/` (revisit when a 2nd 3D game exists),
buyable/gated maps, multiplayer/networked physics, real GLTF vehicle models with
per-wheel suspension sim, and any real traffic AI/pathfinding.

## 11. Research references

- react-three-rapier `HeightfieldCollider` —
  https://pmndrs.github.io/react-three-rapier/functions/HeightfieldCollider.html
- `DynamicRayCastVehicleController` not exposed by the R3F wrapper (why we chose
  arcade) — https://github.com/pmndrs/react-three-rapier/issues/323
- drei `PerformanceMonitor` / `AdaptiveDpr` —
  https://github.com/pmndrs/drei#performance/adaptive-dpr
- R3F scaling performance (independent update loop, instancing) —
  https://r3f.docs.pmnd.rs/advanced/scaling-performance
- `InstancedRigidBodies` — https://pmndrs.github.io/react-three-rapier/
- R3F WebGL context-lost handling —
  https://github.com/pmndrs/react-three-fiber/discussions/723
