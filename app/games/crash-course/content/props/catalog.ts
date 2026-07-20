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
  /** Box footprint [w, h, d]. */
  size: [number, number, number];
  color: string;
  /** Rapier-ish relative mass; drives how far a hit throws it. */
  mass: number;
}

// Reconciled with the live meshes in Destructible.tsx (Phase 5). Kept in
// lockstep with Destructible.tsx's own SIZE and structures.ts H — the scene
// currently reads Destructible's own copy, not this catalog.
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
