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

/** The end-of-track destruction pile: big, light props that shove easily. */
function buildPile(): PileItem[] {
  const items: PileItem[] = [];
  const z0 = TRACK.pileZ;

  for (let layer = 0; layer < 3; layer++) {
    const halfX = 3 - layer;
    const rows = 5 - layer;
    const y = 1.1 + layer * 1.9;
    for (let gx = -halfX; gx <= halfX; gx++) {
      for (let gz = 0; gz < rows; gz++) {
        const jitter = () => (Math.random() - 0.5) * 0.1;
        const x = gx * 2.4 + jitter();
        const z = z0 - gz * 2.4 + jitter();
        let kind: PropKind = "crate";
        if ((Math.abs(gx) + gz) % 7 === 0) kind = "gold";
        else if (gz % 3 === 0) kind = "barrel";
        else if (gx % 2 === 0) kind = "box";
        items.push({ kind, position: [x, y, z] });
      }
    }
  }

  items.push({ kind: "car", position: [-5, 1.0, z0 - 2] });
  items.push({ kind: "car", position: [5, 1.0, z0 - 6] });
  items.push({ kind: "car", position: [0, 1.0, z0 - 11] });
  items.push({ kind: "car", position: [-11, 1.0, z0 + 10], drift: [2.5, 0] });
  items.push({ kind: "car", position: [11, 1.0, z0 + 15], drift: [-2.3, 0] });
  return items;
}

/** Smashables down the whole track so the drive is full of things to hit. */
function buildTrackClusters(): PileItem[] {
  const items: PileItem[] = [];
  const zs = [-8, -20, -32, -44, -54];
  zs.forEach((z, i) => {
    const bx = (i % 2 === 0 ? 1 : -1) * 8;
    items.push({ kind: "crate", position: [bx - 1.0, 0.8, z] });
    items.push({ kind: "barrel", position: [bx + 1.0, 0.95, z] });
    items.push({ kind: "crate", position: [bx, 0.8, z - 1.8] });
    items.push({ kind: i % 2 ? "gold" : "box", position: [bx, 2.4, z - 0.6] });
    items.push({ kind: "crate", position: [bx + 0.6, 0.8, z + 1.7] });
  });
  items.push({ kind: "car", position: [-6, 1.0, -26] });
  items.push({ kind: "car", position: [6, 1.0, -46] });
  return items;
}

/** A fixed launch ramp. Driving toward -z climbs the low (+z) edge. */
function Ramp({ x, z, w, len, angle }: { x: number; z: number; w: number; len: number; angle: number }) {
  const cy = (len / 2) * Math.sin(angle);
  return (
    <RigidBody type="fixed" colliders="cuboid" position={[x, cy, z]} rotation={[angle, 0, 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[w, 0.5, len]} />
        <meshStandardMaterial color="#e0672a" roughness={0.7} metalness={0.1} />
      </mesh>
    </RigidBody>
  );
}

function Building({ x, z, w, h, d, color }: { x: number; z: number; w: number; h: number; d: number; color: string }) {
  const rows = Math.max(2, Math.floor(h / 3));
  const face = x > 0 ? -w / 2 - 0.02 : w / 2 + 0.02;
  const winY: number[] = [];
  for (let r = 1; r <= rows; r++) winY.push((r / (rows + 1)) * h - h / 2);
  return (
    <group position={[x, h / 2 - 0.5, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
      {winY.map((y, i) => (
        <mesh key={i} position={[face, y, 0]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[w * 0.7, 0.55]} />
          <meshStandardMaterial color="#ffe6a0" emissive="#ffcf6a" emissiveIntensity={1.1} toneMapped={false} />
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
  armedAt: number;
}

export default function Scene({ phase, hud, onDestroyed, onEnterCrash, runKey, armedAt }: SceneProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const props = useMemo(() => [...buildPile(), ...buildTrackClusters()], [runKey]);
  const halfW = TRACK.width / 2;
  const groundLen = 102;
  const groundCenterZ = 12 - groundLen / 2;

  const laneMarks: number[] = [];
  for (let z = 6; z > TRACK.pileZ + 16; z -= 6) laneMarks.push(z);

  const palette = ["#3a5cc4", "#c44a86", "#2aa5a0", "#e0892a", "#7a4ad6", "#c43a3a"];
  const buildings: { x: number; z: number; w: number; h: number; d: number; color: string }[] = [];
  for (let z = 4; z > TRACK.pileZ - 6; z -= 9) {
    const idx = buildings.length;
    buildings.push({ x: halfW + 7, z, w: 6, h: 8 + ((z * 5) % 14), d: 6, color: palette[idx % palette.length] });
    buildings.push({ x: -(halfW + 7), z: z - 4, w: 6, h: 6 + ((z * 7) % 16), d: 6, color: palette[(idx + 1) % palette.length] });
  }

  return (
    <>
      <Environment resolution={128}>
        <Lightformer intensity={2.2} position={[0, 9, -14]} scale={[16, 8, 1]} color="#fff2dd" />
        <Lightformer intensity={1.4} position={[-12, 6, 6]} rotation={[0, Math.PI / 2, 0]} scale={[14, 8, 1]} color="#8fb2ff" />
        <Lightformer intensity={1.4} position={[12, 6, 6]} rotation={[0, -Math.PI / 2, 0]} scale={[14, 8, 1]} color="#ffab63" />
      </Environment>

      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#bcd8ff", "#3a2e22", 0.7]} />
      <directionalLight
        castShadow
        color="#fff2e0"
        position={[26, 36, 20]}
        intensity={1.7}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={180}
      />
      <directionalLight color="#7aa0ff" position={[-20, 16, -12]} intensity={0.5} />
      <pointLight position={[0, 8, TRACK.pileZ]} intensity={90} distance={60} decay={2} color="#ffb060" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, groundCenterZ]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#26331f" roughness={1} />
      </mesh>

      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, groundCenterZ]}>
        <mesh receiveShadow>
          <boxGeometry args={[TRACK.width, 1, groundLen]} />
          <meshStandardMaterial color="#3a3f4b" roughness={0.9} />
        </mesh>
      </RigidBody>

      {laneMarks.map((z) => (
        <mesh key={z} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 2.6]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcf5a" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}

      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders="cuboid" position={[s * halfW, TRACK.wallHeight / 2, groundCenterZ]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[0.6, TRACK.wallHeight, groundLen]} />
            <meshStandardMaterial color="#5a4570" roughness={0.7} metalness={0.2} />
          </mesh>
        </RigidBody>
      ))}

      {/* Launch ramps */}
      <Ramp x={0} z={-12} w={10} len={9} angle={0.26} />
      <Ramp x={-9} z={-34} w={8} len={8} angle={0.24} />
      <Ramp x={9} z={-52} w={8} len={9} angle={0.28} />

      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}

      <RigidBody type="fixed" colliders="cuboid" position={[0, 2.5, groundCenterZ - groundLen / 2 + 1]}>
        <mesh>
          <boxGeometry args={[TRACK.width, 6, 1]} />
          <meshStandardMaterial color="#5a4570" roughness={0.8} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 0.03, TRACK.pileZ + 16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK.width, 1.8]} />
        <meshStandardMaterial color="#ffd24a" emissive="#ffd24a" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>

      <Car phase={phase} hud={hud} onEnterCrash={onEnterCrash} armedAt={armedAt} />

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
