"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { useQuality } from "./QualityContext";
import { buildHeightfield, heightAt, type TerrainParams } from "./terrainSampler";

/**
 * Drivable terrain: a displaced ground mesh plus a matching physical Rapier
 * heightfield, both sampled from the same pure `terrain.ts` params so what you
 * see is what you hit. Segment density scales with the quality tier. On
 * amplitude 0 this is a flat plane at y=0 (today's ground).
 */
export function Terrain({
  params,
  width,
  length,
  color = "#26331f",
}: {
  params: TerrainParams;
  width: number;
  length: number;
  color?: string;
}) {
  const { settings } = useQuality();
  const segments = settings.terrainSegments;

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, length, segments, segments);
    g.rotateX(-Math.PI / 2); // XZ ground plane
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(params, x, z));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [params, width, length, segments]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const hf = useMemo(
    () => buildHeightfield(params, width, length, segments),
    [params, width, length, segments],
  );

  // @react-three/rapier compares `args` by reference to decide whether to
  // rebuild the collider. `hf.heights` is a Float32Array, but the collider
  // needs a plain number[]; memoize that conversion on `hf` so it's stable
  // across re-renders and doesn't churn the physical heightfield on every
  // Terrain render (e.g. from HUD/quality updates in a re-rendering parent).
  const heightsArray = useMemo(() => Array.from(hf.heights), [hf]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <HeightfieldCollider
          args={[hf.nrows - 1, hf.ncols - 1, heightsArray, hf.scale]}
        />
      </RigidBody>
    </group>
  );
}
