"use client";

import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import Car from "./Car";
import Destructible from "./Destructible";
import { TRACK } from "./config";
import type { PropKind } from "./scoring";
import type { Phase, RunHud } from "./index";

interface PileItem {
  kind: PropKind;
  position: [number, number, number];
  drift?: [number, number];
}

/**
 * Hand-built end-of-track pile: a shrinking stack of mixed props on a grid
 * (so nothing starts interpenetrating and explodes on frame one), a few heavy
 * parked cars nestled in, and a couple of dead-simple slow movers drifting
 * across the run-in.
 */
function buildPile(): PileItem[] {
  const items: PileItem[] = [];
  const z0 = TRACK.pileZ;

  for (let layer = 0; layer < 3; layer++) {
    const halfX = 3 - layer;
    const rows = 5 - layer;
    // Generous spacing + a small lift so nothing interpenetrates at spawn and
    // the stack settles gently instead of erupting when physics un-pauses.
    const y = 0.75 + layer * 1.35;
    for (let gx = -halfX; gx <= halfX; gx++) {
      for (let gz = 0; gz < rows; gz++) {
        const jitter = () => (Math.random() - 0.5) * 0.08;
        const x = gx * 1.5 + jitter();
        const z = z0 - gz * 1.5 + jitter();
        let kind: PropKind = "crate";
        if ((Math.abs(gx) + gz) % 7 === 0) kind = "gold";
        else if (gz % 3 === 0) kind = "barrel";
        else if (gx % 2 === 0) kind = "box";
        items.push({ kind, position: [x, y, z] });
      }
    }
  }

  // Heavy parked cars tucked into the pile.
  items.push({ kind: "car", position: [-3.2, 0.9, z0 - 1] });
  items.push({ kind: "car", position: [3.2, 0.9, z0 - 3] });
  items.push({ kind: "car", position: [0, 0.9, z0 - 5.5] });

  // Slow movers crossing the run-in just before the pile.
  items.push({ kind: "car", position: [-8, 0.9, z0 + 9], drift: [2.2, 0] });
  items.push({ kind: "car", position: [8, 0.9, z0 + 13], drift: [-2.0, 0] });

  return items;
}

export interface SceneProps {
  phase: Phase;
  hud: RunHud;
  onDestroyed: (kind: PropKind) => void;
  onEnterCrash: () => void;
  /** Stable per-run so a Replay rebuilds a fresh pile. */
  runKey: number;
  /** True only once the finale is live — props ignore impacts before then. */
  active: boolean;
}

export default function Scene({ phase, hud, onDestroyed, onEnterCrash, runKey, active }: SceneProps) {
  // Rebuild the pile only when a new run starts, not on every HUD re-render.
  // buildPile() reads Math.random, so runKey is a deliberate rebuild trigger
  // even though it isn't referenced inside — ESLint can't see that.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pile = useMemo(() => buildPile(), [runKey]);
  const groundLen = 102;
  const groundCenterZ = 12 - groundLen / 2;

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd4ff", "#4a3a2a", 0.5]} />
      <directionalLight
        castShadow
        position={[18, 32, 20]}
        intensity={1.4}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={120}
      />

      {/* Track surface */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, groundCenterZ]}>
        <mesh receiveShadow>
          <boxGeometry args={[TRACK.width, 1, groundLen]} />
          <meshStandardMaterial color="#3a3f4b" roughness={0.95} />
        </mesh>
      </RigidBody>

      {/* Side walls */}
      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders="cuboid" position={[s * (TRACK.width / 2), TRACK.wallHeight / 2, groundCenterZ]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[0.6, TRACK.wallHeight, groundLen]} />
            <meshStandardMaterial color="#5a3f6a" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}

      {/* Back stop behind the pile so debris stays on screen */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 2, groundCenterZ - groundLen / 2 + 1]}>
        <mesh>
          <boxGeometry args={[TRACK.width, 5, 1]} />
          <meshStandardMaterial color="#5a3f6a" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Finish-line marker just before the pile */}
      <mesh position={[0, 0.02, TRACK.pileZ + 16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK.width, 1.5]} />
        <meshStandardMaterial color="#ffd24a" emissive="#ffd24a" emissiveIntensity={0.4} />
      </mesh>

      <Car phase={phase} hud={hud} onEnterCrash={onEnterCrash} />

      {pile.map((item, i) => (
        <Destructible
          key={`${runKey}-${i}`}
          kind={item.kind}
          position={item.position}
          drift={item.drift}
          onDestroyed={onDestroyed}
          active={active}
        />
      ))}
    </>
  );
}
