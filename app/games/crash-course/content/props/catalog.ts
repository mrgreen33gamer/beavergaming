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
