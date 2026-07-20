"use client";

import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import Car from "./Car";
import Destructible from "./Destructible";
import DebrisManager from "./DebrisManager";
import { Terrain } from "./engine/Terrain";
import { buildFinale, buildTrackStructures, anchorToTerrain } from "./structures";
import { heightAt } from "./engine/terrainSampler";
import { TRACK } from "./config";
import type { PropKind } from "./scoring";
import type { Phase, RunHud } from "./index";
import type { MapDef } from "./content/maps";
import type { CarDef } from "./content/cars";

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

function Ramp({ x, z, w, h, len, y = 0 }: { x: number; z: number; w: number; h: number; len: number; y?: number }) {
  const geo = useMemo(() => wedgeGeometry(w, h, len), [w, h, len]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <RigidBody type="fixed" colliders="hull" position={[x, y, z]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#e0672a" roughness={0.7} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  );
}

function Building({ x, z, w, h, d, color, y }: { x: number; z: number; w: number; h: number; d: number; color: string; y: number }) {
  const rows = Math.max(2, Math.floor(h / 3));
  const face = x > 0 ? -w / 2 - 0.08 : w / 2 + 0.08;
  const winY: number[] = [];
  for (let r = 1; r <= rows; r++) winY.push((r / (rows + 1)) * h - h / 2);
  return (
    <group position={[x, h / 2 - 0.5 + y, z]}>
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
  map: MapDef;
  car: CarDef;
}

function Scene({ phase, hud, onDestroyed, onEnterCrash, runKey, armedAt, map, car }: SceneProps) {
  const props = useMemo(
    () => anchorToTerrain([...buildFinale(map.pileZ), ...buildTrackStructures()], map.terrain),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runKey, map],
  );
  const halfW = map.trackWidth / 2;
  const groundLen = 102;
  const groundCenterZ = 12 - groundLen / 2;

  const laneMarks: number[] = [];
  for (let z = 6; z > map.pileZ + 16; z -= 6) laneMarks.push(z);

  const palette = ["#3a5cc4", "#c44a86", "#2aa5a0", "#e0892a", "#7a4ad6", "#c43a3a"];
  const buildings: { x: number; z: number; w: number; h: number; d: number; color: string; y: number }[] = [];
  for (let z = 4; z > map.pileZ - 6; z -= 9) {
    const idx = buildings.length;
    const xr = halfW + 7;
    const xl = -(halfW + 7);
    buildings.push({ x: xr, z, w: 6, h: 8 + ((z * 5) % 14), d: 6, color: palette[idx % palette.length], y: heightAt(map.terrain, xr, z) });
    buildings.push({ x: xl, z: z - 4, w: 6, h: 6 + ((z * 7) % 16), d: 6, color: palette[(idx + 1) % palette.length], y: heightAt(map.terrain, xl, z - 4) });
  }

  return (
    <>
      <ambientLight intensity={map.theme.ambientIntensity} />
      <hemisphereLight args={[map.theme.hemiSky, map.theme.hemiGround, map.theme.hemiIntensity]} />
      <directionalLight
        castShadow
        color={map.theme.sunColor}
        position={[26, 36, 20]}
        intensity={map.theme.sunIntensity}
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
      <pointLight position={[0, 10, map.pileZ + 4]} intensity={45} distance={70} decay={2} color="#ffb060" />

      <Terrain params={map.terrain} width={200} length={200} color={map.theme.groundColor} />

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

      <Ramp x={0} z={-12} w={10} h={2.2} len={9} y={heightAt(map.terrain, 0, -12)} />
      <Ramp x={-9} z={-34} w={8} h={2} len={8} y={heightAt(map.terrain, -9, -34)} />
      <Ramp x={9} z={-52} w={8} h={2.4} len={9} y={heightAt(map.terrain, 9, -52)} />

      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}

      <RigidBody type="fixed" colliders="cuboid" position={[0, 6, groundCenterZ - groundLen / 2 + 1]}>
        <mesh>
          <boxGeometry args={[map.trackWidth, 13, 1]} />
          <meshStandardMaterial color="#5a4570" roughness={0.8} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 0.14, map.pileZ + 16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[map.trackWidth, 1.8]} />
        <meshStandardMaterial color="#ffd24a" emissive="#ffd24a" emissiveIntensity={1.0} toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>

      <Car phase={phase} hud={hud} onEnterCrash={onEnterCrash} armedAt={armedAt} terrain={map.terrain} car={car} />
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

// Memoised: its props (phase, the stable hud ref, the stable callbacks, runKey,
// armedAt) don't change on a score update, so score-driven parent re-renders no
// longer reconcile the entire destructible tree mid-crash.
export default memo(Scene);
