"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import Car from "./Car";
import Destructible from "./Destructible";
import DebrisManager from "./DebrisManager";
import { buildFinale, buildTrackStructures } from "./structures";
import { TRACK } from "./config";
import type { PropKind } from "./scoring";
import type { Phase, RunHud } from "./index";

/** A right-triangular-prism ramp: the low front edge meets the ground on a
 *  line, rising to the back — a real wedge, not a floating tilted box. */
function wedgeGeometry(w: number, h: number, len: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const hw = w / 2, hl = len / 2;
  const v = new Float32Array([
    -hw, 0, hl, hw, 0, hl, hw, 0, -hl, -hw, 0, -hl, hw, h, -hl, -hw, h, -hl,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.setIndex([0, 3, 2, 0, 2, 1, 0, 1, 4, 0, 4, 5, 3, 5, 4, 3, 4, 2, 0, 5, 3, 1, 2, 4]);
  g.computeVertexNormals();
  return g;
}

function Ramp({ x, z, w, h, len }: { x: number; z: number; w: number; h: number; len: number }) {
  const geo = useMemo(() => wedgeGeometry(w, h, len), [w, h, len]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <RigidBody type="fixed" colliders="hull" position={[x, 0, z]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#e0672a" roughness={0.7} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  );
}

function Building({ x, z, w, h, d, color }: { x: number; z: number; w: number; h: number; d: number; color: string }) {
  const rows = Math.max(2, Math.floor(h / 3));
  const face = x > 0 ? -w / 2 - 0.08 : w / 2 + 0.08;
  const winY: number[] = [];
  for (let r = 1; r <= rows; r++) winY.push((r / (rows + 1)) * h - h / 2);
  return (
    <group position={[x, h / 2 - 0.5, z]}>
      <mesh receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
      {winY.map((y, i) => (
        <mesh key={i} position={[face, y, 0]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[w * 0.7, 0.55]} />
          <meshStandardMaterial color="#ffe6a0" emissive="#ffcf6a" emissiveIntensity={1.0} toneMapped={false} depthWrite={false} />
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
  const props = useMemo(() => [...buildFinale(TRACK.pileZ), ...buildTrackStructures()], [runKey]);
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
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd8ff", "#3a2e22", 0.8]} />
      <directionalLight
        castShadow
        color="#fff2e0"
        position={[26, 36, 20]}
        intensity={1.8}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-far={150}
        shadow-bias={-0.0005}
      />
      <directionalLight color="#7aa0ff" position={[-20, 16, -12]} intensity={0.5} />
      <pointLight position={[0, 10, TRACK.pileZ + 4]} intensity={45} distance={70} decay={2} color="#ffb060" />

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
        <mesh key={z} position={[0, 0.12, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 2.6]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcf5a" emissiveIntensity={1.3} toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}

      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders="cuboid" position={[s * halfW, TRACK.wallHeight / 2, groundCenterZ]}>
          <mesh receiveShadow>
            <boxGeometry args={[0.6, TRACK.wallHeight, groundLen]} />
            <meshStandardMaterial color="#5a4570" roughness={0.7} metalness={0.2} />
          </mesh>
        </RigidBody>
      ))}

      <Ramp x={0} z={-12} w={10} h={2.2} len={9} />
      <Ramp x={-9} z={-34} w={8} h={2} len={8} />
      <Ramp x={9} z={-52} w={8} h={2.4} len={9} />

      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}

      <RigidBody type="fixed" colliders="cuboid" position={[0, 6, groundCenterZ - groundLen / 2 + 1]}>
        <mesh>
          <boxGeometry args={[TRACK.width, 13, 1]} />
          <meshStandardMaterial color="#5a4570" roughness={0.8} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 0.14, TRACK.pileZ + 16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK.width, 1.8]} />
        <meshStandardMaterial color="#ffd24a" emissive="#ffd24a" emissiveIntensity={1.0} toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>

      <Car phase={phase} hud={hud} onEnterCrash={onEnterCrash} armedAt={armedAt} />
      <DebrisManager />

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
