"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import { PROP_COLOR, IMPACT } from "./config";
import { fxBus } from "./fxBus";
import { debrisBus } from "./debrisBus";
import { ModelOrShape } from "./Model";
import { CRATE_MODEL, DEBRIS_MODELS, junkCarFor, MODEL_YAW } from "./models";
import type { PropKind } from "./scoring";

/** Box dimensions per kind (metres). Cars are much bigger and heavier. */
const SIZE: Record<PropKind, [number, number, number]> = {
  crate: [1.6, 1.6, 1.6],
  box: [1.9, 1.9, 1.9],
  barrel: [1.35, 1.9, 1.35],
  gold: [1.6, 1.6, 1.6],
  car: [4.2, 1.6, 2.0],
};

// Styrofoam-light props fling away on contact; the "car" props stay heavy
// enough to actually dent you.
const DENSITY: Record<PropKind, number> = {
  crate: 0.1,
  box: 0.12,
  barrel: 0.14,
  gold: 0.2,
  car: 0.7,
};

export interface DestructibleProps {
  kind: PropKind;
  position: [number, number, number];
  onDestroyed: (kind: PropKind) => void;
  drift?: [number, number];
  /** performance.now() timestamp after which impacts count (props ignore the
   *  settling pile before this). */
  armedAt: number;
}

/**
 * One smashable object. Cars and crates render as Kenney models; barrels, gold
 * and generic boxes stay procedural (and flash on impact). All share an
 * explicit cuboid collider so physics never depends on a model finishing load.
 */
export default function Destructible({
  kind,
  position,
  onDestroyed,
  drift,
  armedAt,
}: DestructibleProps) {
  const body = useRef<RapierRigidBody>(null);
  const destroyed = useRef(false);
  const flash = useRef(0);
  const size = SIZE[kind];
  const half: [number, number, number] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const baseEmissive = kind === "gold" ? 0.4 : 0;

  const material = useMemo(() => {
    const color = PROP_COLOR[kind];
    return new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(kind === "gold" ? "#ffcf33" : color),
      emissiveIntensity: baseEmissive,
      metalness: kind === "gold" ? 0.65 : 0.15,
      roughness: kind === "gold" ? 0.3 : 0.75,
    });
  }, [kind, baseEmissive]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (drift && !destroyed.current) {
      const b = body.current;
      if (b) {
        const v = b.linvel();
        b.setLinvel({ x: drift[0], y: v.y, z: drift[1] }, true);
      }
    }
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - 0.055);
      material.emissiveIntensity = baseEmissive + flash.current;
    }
  });

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={position}
      density={DENSITY[kind]}
      restitution={0.05}
      linearDamping={0.4}
      angularDamping={0.6}
      userData={{ smashable: true }}
      onContactForce={(payload) => {
        if (destroyed.current || performance.now() < armedAt) return;
        if (payload.totalForceMagnitude < IMPACT.destroyForce) return;
        destroyed.current = true;
        flash.current = 1.8;
        onDestroyed(kind);
        const t = body.current?.translation();
        if (t) {
          fxBus.triggerImpact(
            t.x, t.y, t.z,
            Math.min(1, payload.totalForceMagnitude / (IMPACT.destroyForce * 4)),
          );
        }
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
        // Smashed cars shed a couple of real parts.
        if (kind === "car" && t) {
          const lv = body.current?.linvel();
          for (const model of [DEBRIS_MODELS[2], DEBRIS_MODELS[0]]) {
            debrisBus.emit(model, [t.x, t.y + 0.6, t.z], [
              (lv?.x ?? 0) + (Math.random() - 0.5) * 6,
              3 + Math.random() * 3,
              (lv?.z ?? 0) + (Math.random() - 0.5) * 6,
            ]);
          }
        }
      }}
    >
      <CuboidCollider args={half} />

      {kind === "car" ? (
        <ModelOrShape
          url={junkCarFor(position[0], position[2])}
          fit={size[0]}
          baseY={-half[1]}
          yaw={MODEL_YAW.junk}
          fallback={<ProceduralCarProp size={size} material={material} />}
        />
      ) : kind === "crate" ? (
        <ModelOrShape
          url={CRATE_MODEL}
          fit={size[0]}
          baseY={-half[1]}
          yaw={MODEL_YAW.crate}
          fallback={
            <RoundedBox args={size} radius={0.07} smoothness={3} material={material} castShadow receiveShadow />
          }
        />
      ) : kind === "barrel" ? (
        <mesh material={material} castShadow receiveShadow>
          <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[1], 16]} />
        </mesh>
      ) : (
        <RoundedBox
          args={size}
          radius={kind === "box" ? 0.12 : 0.07}
          smoothness={3}
          material={material}
          castShadow
          receiveShadow
        />
      )}
    </RigidBody>
  );
}

function ProceduralCarProp({
  size,
  material,
}: {
  size: [number, number, number];
  material: THREE.Material;
}) {
  return (
    <group>
      <RoundedBox
        args={[size[0], size[1] * 0.62, size[2]]}
        radius={0.14}
        smoothness={3}
        position={[0, -size[1] * 0.18, 0]}
        material={material}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[size[0] * 0.66, size[1] * 0.5, size[2] * 0.6]}
        radius={0.14}
        smoothness={3}
        position={[0, size[1] * 0.28, 0]}
        material={material}
        castShadow
      />
    </group>
  );
}
