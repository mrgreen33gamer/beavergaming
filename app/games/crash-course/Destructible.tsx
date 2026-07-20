"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { PROP_COLOR, IMPACT } from "./config";
import type { PropKind } from "./scoring";

/** Box dimensions per kind (metres). Cars are much bigger and heavier. */
const SIZE: Record<PropKind, [number, number, number]> = {
  crate: [1, 1, 1],
  box: [1.2, 1.2, 1.2],
  barrel: [0.95, 1.3, 0.95],
  gold: [1, 1, 1],
  car: [3.4, 1.3, 1.7],
};

const DENSITY: Record<PropKind, number> = {
  crate: 0.6,
  box: 0.7,
  barrel: 0.8,
  gold: 0.9,
  car: 1.4,
};

export interface DestructibleProps {
  kind: PropKind;
  position: [number, number, number];
  /** Called once, the first time this object is smashed hard enough. */
  onDestroyed: (kind: PropKind) => void;
  /** Optional constant drift velocity [vx, vz] for slow movers. */
  drift?: [number, number];
  /** When false, impacts are ignored (pile is still settling / drive phase). */
  active: boolean;
}

/**
 * One smashable object. Stays a normal dynamic body until a contact force
 * crosses the destroy threshold, at which point it reports its value exactly
 * once, gets a dramatic scatter impulse, and dims to show it has been counted.
 */
export default function Destructible({
  kind,
  position,
  onDestroyed,
  drift,
  active,
}: DestructibleProps) {
  const body = useRef<RapierRigidBody>(null);
  const destroyed = useRef(false);
  const [dim, setDim] = useState(false);
  const size = SIZE[kind];
  const color = PROP_COLOR[kind];

  // Slow movers keep a constant horizontal velocity until they are hit.
  useFrame(() => {
    if (!drift || destroyed.current) return;
    const b = body.current;
    if (!b) return;
    const v = b.linvel();
    b.setLinvel({ x: drift[0], y: v.y, z: drift[1] }, true);
  });

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders="cuboid"
      position={position}
      density={DENSITY[kind]}
      onContactForce={(payload) => {
        if (!active || destroyed.current) return;
        if (payload.totalForceMagnitude < IMPACT.destroyForce) return;
        destroyed.current = true;
        setDim(true);
        onDestroyed(kind);
        // A kick so the pile erupts rather than politely nudging apart.
        const dir = payload.totalForce;
        const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
        body.current?.applyImpulse(
          {
            x: (dir.x / len) * IMPACT.scatterImpulse,
            y: IMPACT.scatterImpulse * 0.6,
            z: (dir.z / len) * IMPACT.scatterImpulse,
          },
          true,
        );
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={dim ? 0.35 : 0}
          metalness={kind === "gold" ? 0.7 : 0.1}
          roughness={kind === "gold" ? 0.25 : 0.8}
        />
      </mesh>
    </RigidBody>
  );
}
