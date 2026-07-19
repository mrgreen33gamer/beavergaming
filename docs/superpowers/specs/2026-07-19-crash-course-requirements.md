# Crash Course (3D car game) — captured requirements

**Status:** Requirements capture only. Not a design. Parked behind the economy
work; will be turned into a full spec before any code is written.

## Confirmed decisions

- **Prototype art:** primitive boxes first. Kenney CC0 models swap in later,
  once the crash is proven fun.
- **Handling:** chosen per map. Prototype uses arcade — grippy and forgiving.
  Later maps may vary grip (tighter on technical tracks, looser on open ones).
- **Stack:** Three.js + React Three Fiber + Rapier physics.
- **Nitrous:** three charges per run, usable at any time. A *moderate* speed
  increase — explicitly not a launch. The point is control and timing, not
  being fired down the track.
- **The payoff:** the end-of-track pile. Cars should end up visibly smashed and
  damaged among scattered crates, boxes, and other stackable props.
- **Props:** varied objects, not just crates. Different colours carry different
  point values.

## Open conflict to resolve at spec time

Scoring was agreed as **pure destruction count** (simplest; no reason to drive
fast). Coloured objects worth different points changes that to **weighted
destruction**. These are compatible — weighting is still destruction-based —
but the earlier reasoning for rejecting speed-weighted scoring should be
revisited, since weighting reintroduces the "which crates do I aim for"
decision that pure counting deliberately removed.

## Notable implementation risks, to address in the spec

- **Visible car damage** is not free. Real mesh deformation is expensive and
  fiddly; the cheap approaches are swapping to a pre-damaged model at
  thresholds, or detaching/rotating panel meshes on impact. Decide deliberately.
- **Multiplayer** remains out of scope until single player is proven. Real-time
  networked physics is a distinct, much harder project.
- **Bundle weight** — Three.js plus Rapier WASM is roughly 1–2 MB gzipped even
  code-split, which sits awkwardly against the site's "instant play" promise
  and needs its own loading treatment.

## Full scope the user has described (for the eventual spec)

- 10 single-player levels
- Multiplayer rotating through those same 10 maps
- Track driving that ends in an Angry-Birds-style destruction finale
