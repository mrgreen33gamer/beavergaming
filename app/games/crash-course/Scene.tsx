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

  // Glowing dashed centre line — reads as speed and pops under bloom.
  const laneMarks: number[] = [];
  for (let z = 6; z > TRACK.pileZ + 16; z -= 6) laneMarks.push(z);

  // Roadside blocks for depth/parallax outside the walls.
  const roadside: { x: number; z: number; h: number }[] = [];
  for (let z = 6; z > TRACK.pileZ; z -= 11) {
    const h = 4 + ((z * 7) % 5);
    roadside.push({ x: TRACK.width / 2 + 4, z, h });
    roadside.push({ x: -(TRACK.width / 2 + 4), z: z - 5, h: h + 2 });
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={["#aecbff", "#2a2016", 0.55]} />
      {/* Warm key light casts the shadows. */}
      <directionalLight
        castShadow
        color="#fff0dd"
        position={[22, 34, 18]}
        intensity={1.6}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={140}
      />
      {/* Cool fill from the opposite side to shape the forms. */}
      <directionalLight color="#6a8cff" position={[-18, 14, -12]} intensity={0.4} />
      {/* Warm glow hanging over the carnage. */}
      <pointLight position={[0, 7, TRACK.pileZ]} intensity={60} distance={46} decay={2} color="#ffb060" />

      {/* Surrounding ground beyond the track */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, groundCenterZ]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#232b1f" roughness={1} />
      </mesh>

      {/* Track surface */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, groundCenterZ]}>
        <mesh receiveShadow>
          <boxGeometry args={[TRACK.width, 1, groundLen]} />
          <meshStandardMaterial color="#31353f" roughness={0.95} />
        </mesh>
      </RigidBody>

      {/* Glowing centre-line dashes */}
      {laneMarks.map((z) => (
        <mesh key={z} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.4, 2.4]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcf5a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}

      {/* Side walls */}
      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders="cuboid" position={[s * (TRACK.width / 2), TRACK.wallHeight / 2, groundCenterZ]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[0.6, TRACK.wallHeight, groundLen]} />
            <meshStandardMaterial color="#4a3560" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}

      {/* Roadside blocks for depth (non-colliding decoration) */}
      {roadside.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 - 0.5, b.z]} castShadow receiveShadow>
          <boxGeometry args={[5, b.h, 5]} />
          <meshStandardMaterial color={i % 2 ? "#2c2740" : "#332b46"} roughness={0.9} />
        </mesh>
      ))}

      {/* Back stop behind the pile so debris stays on screen */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 2, groundCenterZ - groundLen / 2 + 1]}>
        <mesh>
          <boxGeometry args={[TRACK.width, 5, 1]} />
          <meshStandardMaterial color="#4a3560" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Finish-line stripe just before the pile */}
      <mesh position={[0, 0.03, TRACK.pileZ + 16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK.width, 1.6]} />
        <meshStandardMaterial color="#ffd24a" emissive="#ffd24a" emissiveIntensity={1.1} toneMapped={false} />
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
