# Crash Course (3D car game) — vertical slice design

**Status:** Approved design. Supersedes the requirements-capture note
(`2026-07-19-crash-course-requirements.md`) for the first build. Scope here is
deliberately one track — "prove the crash is fun" — with the full 10-level +
multiplayer vision explicitly deferred.

## 1. Goal & core loop

A single playable track that ends in an Angry-Birds-style destruction finale.
The drive is the wind-up; the crash is the game.

```
ready (countdown) → driving → crashing (physics settle) → results → replay
```

A run is ~30–45 seconds. The player spawns in their car, drives a short track,
banks three nitrous charges for the run-up, then plows into a destruction zone
packed with crates, barrels, props, parked junk cars, and a couple of
slow-moving cars. Physics settle for ~2–3s, then a results screen tallies the
score (with the biggest combo) and offers **Replay**.

## 2. Confirmed decisions (from requirements + brainstorming)

| Decision | Choice |
| --- | --- |
| Scope of this build | Vertical slice — one track only |
| Stack | Three.js + React Three Fiber + Rapier physics |
| Prototype art | Primitive boxes (Kenney CC0 models swap in later) |
| Handling | Arcade — grippy, forgiving, momentum-based |
| Nitrous | 3 charges/run, moderate ~2s boost, usable anytime — control not launch |
| Scoring | **Weighted destruction + combo** (see §6) |
| Car damage | **Detach panels into debris + squash the surviving body** |
| Other cars | **Both** — parked cars in the pile + 2–3 dead-simple slow movers |

## 3. Stack & portal integration

- New game lives in `app/games/crash-course/` (a folder — several files).
- One entry in `lib/games.ts` (slug `crash-course`, category `action`, 🚗).
  The registry is the source of truth, so the tile and `/play/crash-course`
  route appear automatically.
- One line in `app/play/[slug]/gameRegistry.ts`
  (`"crash-course": () => import("@/app/games/crash-course/index")`). The
  `gameRegistry` test enforces registry ↔ `games.ts` parity.
- The whole game is already **dynamically imported with `ssr: false`** by the
  existing `gameComponents` machinery, so Three + Rapier only download when a
  player opens this game. The rest of the portal stays instant.
- The game adopts the platform via `useCartridge("crash-course")` and reports
  the final score through `host.reportScore(finalScore)` — that is how the
  crash turns into B-Token rewards. A tuned rate is added to
  `lib/platform/earnRates.ts`.
- Wrapped by the existing `GameShell` (pause/mute/fullscreen). The game honors
  `host.onPause`/`onResume` to stop stepping physics under the pause overlay.

## 4. Modules (isolation & boundaries)

Each file has one clear purpose and a small surface:

- **`scoring.ts`** — pure, no React, no Three. The point-value table, the combo
  reducer (add a destroyed prop, applying the time-window multiplier), and the
  run tally. Fully unit-tested. Everything else depends on this; it depends on
  nothing.
  Data flow into scoring is one-way: the scene reports
  `{ propId, baseValue, timeMs }` to a scoring accumulator; scoring never
  reaches back into the scene.
- **`config.ts`** — tunables in one place (car accel/top speed/steer, nitrous
  boost & duration, combo window, impact thresholds, prop layout). Physics
  feel is tuning; keeping it isolated means playtesting edits touch one file.
- **`index.tsx`** — the entry. Owns the game-state machine
  (`ready|driving|crashing|results`), the HUD, the results screen, and mounts
  the R3F `<Canvas>` + `<Physics>` + `<Scene>`. Client component.
- **`Scene.tsx`** — the 3D world: lights, ground/track, camera rig, and it
  composes `Car`, the destruction `Pile`, and the slow movers.
- **`Car.tsx`** — the player car: a dynamic Rapier body driven arcade-style,
  nitrous, the chase camera follow, and the detach-panel + squash damage.
- **`Destructible.tsx`** — one smashable object (prop or parked/moving car):
  a dynamic body that, when its contact force crosses the threshold, reports
  its value once and is marked destroyed.

## 5. Car & handling

- Body assembled from box meshes: chassis, cabin, front bumper, 4 wheels.
- A single **dynamic Rapier rigid body** (cuboid collider). During `driving`,
  X/Z rotations are locked so the car stays upright and drivable; the crash
  keeps it dynamic so it transfers momentum into the pile.
- **Arcade control** each physics step: desired velocity along the car's facing
  from throttle, eased toward top speed (grippy, forgiving); steering sets yaw
  angular velocity scaled by current speed (no turning in place).
- **Controls**: `W`/`↑` throttle, `S`/`↓` brake-reverse, `A`/`D` or `←`/`→`
  steer, `Space` = spend one nitrous charge (moderate top-speed + accel bump
  for ~2s; explicitly not a launch). Chase camera trails and looks ahead.

## 6. The crash finale & scoring

**Destruction zone** at the track end: a stacked jumble of dynamic bodies.

Point values by type/color:

| Object | Value |
| --- | --- |
| Gray crate | 10 |
| Wood box | 25 |
| Red barrel | 50 |
| Gold crate | 200 |
| Parked / slow-moving car | 300 |

- **Slow movers**: 2–3 cars near the finale on a fixed straight path at a
  constant low speed. No pathfinding, no avoidance — just moving smashables.
- **Weighted + combo**: each destroyed object adds its value; objects destroyed
  within the combo window (~0.5s) of the previous one **chain**, escalating the
  multiplier (×2, ×3, ×4 …). One giant pile-driver = a huge score. The
  multiplier resets when the window lapses.
- **Destroyed** = a body's reported contact-force magnitude crosses the impact
  threshold, counted **once** per object (id-tracked). A destroyed object also
  gets a small extra impulse for drama.

**Car damage — detach + squash (cosmetic only):**

- The car tracks a small set of attachable panels (roof, bumper, a wheel …).
- On each big self-impact (car contact force over threshold, rate-limited), one
  panel **detaches** into a loose dynamic debris body with an impulse, **and**
  the surviving chassis **squashes** (scales down a notch).
- The player never "dies"; they wreck gloriously. The run ends when the car and
  pile come to rest (velocities below a threshold) or a short timeout, moving
  the state machine to `crashing` → `results`.

## 7. States & HUD

- `ready`: countdown overlay (3·2·1·GO).
- `driving`: HUD shows live score, **3 nitrous pips**, speed.
- `crashing`: input released; camera pulls back on the pile; physics settle.
- `results`: total score, biggest combo, objects wrecked, **Replay** button.
  `host.reportScore(total)` fires once on entering `results`.

## 8. Loading treatment

The heavy chunk (~1–2 MB gzipped: Three + R3F + Rapier WASM) is isolated behind
the existing per-game dynamic import and the `GameLoading` Suspense fallback, so
it never blocks the rest of the site. No change needed beyond registering the
game the normal way; the loader already covers it.

## 9. Testing

- **Unit (Vitest, matching `app/games/__tests__` + `lib/platform/__tests__`):**
  scoring point-value table, combo-window multiplier (in/out of window, reset),
  run tally, nitrous charge accounting, damage-threshold state transitions.
- The 3D rendering and physics *feel* are validated by playtesting, not unit
  tests — this is the part the whole slice exists to prove.

## 10. Explicitly out of scope (deferred)

10 levels, level select, multiplayer, networked physics, real car/Kenney
models, real mesh deformation, and any real traffic AI or pathfinding.
