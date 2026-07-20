"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RigidBody,
  CuboidCollider,
  interactionGroups,
  type RapierRigidBody,
} from "@react-three/rapier";
import { ModelOrShape } from "./Model";
import { debrisBus, type DebrisSpawn } from "./debrisBus";
import { DEBRIS } from "./config";

// Debris collides with the world but never with the player car (group 1).
const DEBRIS_GROUPS = interactionGroups(2, [0]);

interface Piece extends DebrisSpawn {
  id: number;
}

/**
 * Renders every shed part as a short-lived physics body. Mounted once inside
 * the scene; a per-run remount clears everything. Capped and auto-despawned so
 * parts never accumulate.
 */
export default function DebrisManager() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const idRef = useRef(0);

  const expire = useCallback((id: number) => {
    setPieces((p) => p.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    debrisBus.spawn = (d) => {
      const id = idRef.current++;
      setPieces((p) => {
        const next = [...p, { ...d, id }];
        return next.length > DEBRIS.maxAlive ? next.slice(next.length - DEBRIS.maxAlive) : next;
      });
    };
    return () => {
      debrisBus.spawn = null;
    };
  }, []);

  return (
    <>
      {pieces.map((p) => (
        <PieceBody key={p.id} piece={p} onExpire={expire} />
      ))}
    </>
  );
}

function PieceBody({ piece, onExpire }: { piece: Piece; onExpire: (id: number) => void }) {
  const ref = useRef<RapierRigidBody>(null);
  useEffect(() => {
    const b = ref.current;
    if (b) {
      b.setLinvel({ x: piece.vel[0], y: piece.vel[1], z: piece.vel[2] }, true);
      b.setAngvel(
        { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10 },
        true,
      );
    }
    const to = setTimeout(() => onExpire(piece.id), DEBRIS.lifetimeMs);
    return () => clearTimeout(to);
  }, [piece, onExpire]);

  return (
    <RigidBody ref={ref} position={piece.pos} colliders={false} collisionGroups={DEBRIS_GROUPS} density={0.5}>
      <CuboidCollider args={[0.35, 0.2, 0.35]} collisionGroups={DEBRIS_GROUPS} />
      <ModelOrShape
        url={piece.model}
        fit={0.95}
        baseY={-0.2}
        yaw={0}
        fallback={
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color="#2a2f3a" metalness={0.3} roughness={0.5} />
          </mesh>
        }
      />
    </RigidBody>
  );
}
