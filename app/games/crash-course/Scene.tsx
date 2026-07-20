"use client";

import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import { Environment, Lightformer } from "@react-three/drei";
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

/** The end-of-track destruction pile: a shrinking stack of mixed props, heavy
 *  parked cars, and a couple of slow movers. */
function buildPile(): PileItem[] {
  const items: PileItem[] = [];
  const z0 = TRACK.pileZ;

  for (let layer = 0; layer < 3; layer++) {
    const halfX = 3 - layer;
    const rows = 5 - layer;
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

  items.push({ kind: "car", position: [-3.2, 0.9, z0 - 1] });
  items.push({ kind: "car", position: [3.2, 0.9, z0 - 3] });
  items.push({ kind: "car", position: [0, 0.9, z0 - 5.5] });
  items.push({ kind: "car", position: [-8, 0.9, z0 + 9], drift: [2.2, 0] });
  items.push({ kind: "car", position: [8, 0.9, z0 + 13], drift: [-2.0, 0] });
  return items;
}

/** Smashables scattered down the whole track so the drive is full of things to
 *  plough through, not just the finale. Low, stable stacks that settle well
 *  before the arm grace elapses. */
function buildTrackClusters(): PileItem[] {
  const items: PileItem[] = [];
  const zs = [-6, -16, -26, -36, -48];
  zs.forEach((z, i) => {
    const bx = (i % 2 === 0 ? 1 : -1) * 5;
    items.push({ kind: "crate", position: [bx - 0.7, 0.6, z] });
    items.push({ kind: "barrel", position: [bx + 0.7, 0.75, z] });
    items.push({ kind: "crate", position: [bx, 0.6, z - 1.2] });
    items.push({ kind: i % 2 ? "gold" : "box", position: [bx, 1.75, z - 0.4] });
    items.push({ kind: "crate", position: [bx + 0.3, 0.6, z + 1.1] });
  });
  items.push({ kind: "car", position: [-4, 0.9, -22] });
  items.push({ kind: "car", position: [4, 0.9, -40] });
  return items;
}

/** A simple skyline building with glowing window rows. */
function Building({ x, z, w, h, d, color }: { x: number; z: number; w: number; h: number; d: number; color: string }) {
  const rows = Math.max(2, Math.floor(h / 3));
  const face = x > 0 ? -w / 2 - 0.02 : w / 2 + 0.02;
  const winY: number[] = [];
  for (let r = 1; r <= rows; r++) winY.push((r / (rows + 1)) * h - h / 2);
  return (
    <group position={[x, h / 2 - 0.5, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />
      </mesh>
      {winY.map((y, i) => (
        <mesh key={i} position={[face, y, 0]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[w * 0.7, 0.5]} />
          <meshStandardMaterial color="#ffd98a" emissive="#ffcf6a" emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export interface SceneProps {
  phase: Phase;
  hud: RunHud;
  onDestroyed: (kind: PropKind) => void;
  onEnterCrash: () => void;
  runKey: number;
  /** performance.now() timestamp after which props become smashable. */
  armedAt: number;
}

export default function Scene({ phase, hud, onDestroyed, onEnterCrash, runKey, armedAt }: SceneProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const props = useMemo(() => [...buildPile(), ...buildTrackClusters()], [runKey]);
  const groundLen = 102;
  const groundCenterZ = 12 - groundLen / 2;

  const laneMarks: number[] = [];
  for (let z = 6; z > TRACK.pileZ + 16; z -= 6) laneMarks.push(z);

  // Skyline both sides, receding down the track.
  const buildings: { x: number; z: number; w: number; h: number; d: number; color: string }[] = [];
  const palette = ["#2c2740", "#332b46", "#26304a", "#3a2c44"];
  for (let z = 4; z > TRACK.pileZ - 6; z -= 9) {
    const idx = buildings.length;
    buildings.push({ x: TRACK.width / 2 + 6, z, w: 6, h: 8 + ((z * 5) % 12), d: 6, color: palette[idx % palette.length] });
    buildings.push({ x: -(TRACK.width / 2 + 6), z: z - 4, w: 6, h: 6 + ((z * 7) % 14), d: 6, color: palette[(idx + 1) % palette.length] });
  }

  return (
    <>
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 9, -14]} scale={[14, 8, 1]} color="#fff2dd" />
        <Lightformer intensity={1.3} position={[-10, 6, 6]} rotation={[0, Math.PI / 2, 0]} scale={[12, 8, 1]} color="#8fb2ff" />
        <Lightformer intensity={1.3} position={[10, 6, 6]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 8, 1]} color="#ffab63" />
      </Environment>

      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#aecbff", "#2a2016", 0.5]} />
      <directionalLight
        castShadow
        color="#fff0dd"
        position={[22, 34, 18]}
        intensity={1.5}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={160}
      />
      <directionalLight color="#6a8cff" position={[-18, 14, -12]} intensity={0.4} />
      <pointLight position={[0, 7, TRACK.pileZ]} intensity={70} distance={50} decay={2} color="#ffb060" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, groundCenterZ]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#1f261b" roughness={1} />
      </mesh>

      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, groundCenterZ]}>
        <mesh receiveShadow>
          <boxGeometry args={[TRACK.width, 1, groundLen]} />
          <meshStandardMaterial color="#31353f" roughness={0.95} />
        </mesh>
      </RigidBody>

      {laneMarks.map((z) => (
        <mesh key={z} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.4, 2.4]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcf5a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}

      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders="cuboid" position={[s * (TRACK.width / 2), TRACK.wallHeight / 2, groundCenterZ]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[0.6, TRACK.wallHeight, groundLen]} />
            <meshStandardMaterial color="#4a3560" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}

      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}

      <RigidBody type="fixed" colliders="cuboid" position={[0, 2, groundCenterZ - groundLen / 2 + 1]}>
        <mesh>
          <boxGeometry args={[TRACK.width, 5, 1]} />
          <meshStandardMaterial color="#4a3560" roughness={0.8} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 0.03, TRACK.pileZ + 16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK.width, 1.6]} />
        <meshStandardMaterial color="#ffd24a" emissive="#ffd24a" emissiveIntensity={1.1} toneMapped={false} />
      </mesh>

      <Car phase={phase} hud={hud} onEnterCrash={onEnterCrash} />

      {props.map((item, i) => (
        <Destructible
          key={`${runKey}-${i}`}
          kind={item.kind}
          position={item.position}
          drift={item.drift}
          onDestroyed={onDestroyed}
          armedAt={armedAt}
        />
      ))}
    </>
  );
}
