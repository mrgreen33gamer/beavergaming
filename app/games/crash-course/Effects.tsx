"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { fxBus } from "./fxBus";

const MAX_PARTICLES = 220;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
}

/**
 * Screen post-processing (bloom + vignette) plus a cheap, non-physical spark
 * pool driven by the fxBus. Bloom is what makes the gold props, the nitro, and
 * the impact sparks actually glow rather than sit flat.
 */
export default function Effects() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pool = useRef<Particle[]>([]);

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffd24a",
        emissive: new THREE.Color("#ff8a3d"),
        emissiveIntensity: 2.4,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  // Start with nothing drawn (uninitialised instance matrices would flash).
  useLayoutEffect(() => {
    if (mesh.current) mesh.current.count = 0;
  }, []);

  useEffect(() => {
    fxBus.spawn = (x, y, z, strength) => {
      const count = Math.min(12, 4 + Math.floor(strength * 10));
      for (let i = 0; i < count; i++) {
        if (pool.current.length >= MAX_PARTICLES) break;
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 5 * (0.5 + strength);
        pool.current.push({
          x, y, z,
          vx: Math.cos(a) * sp,
          vy: 1 + Math.random() * 4,
          vz: Math.sin(a) * sp,
          life: 0,
          max: 0.35 + Math.random() * 0.45,
          size: 0.1 + Math.random() * 0.14,
        });
      }
    };
    return () => { fxBus.spawn = null; };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const arr = pool.current;
    const im = mesh.current;
    if (!im) return;
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.life += dt;
      if (p.life >= p.max) continue; // expired — dropped from the pool
      p.vy -= 11 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.06) { p.y = 0.06; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      const t = 1 - p.life / p.max;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.size * (0.4 + t * 0.9));
      dummy.rotation.set(p.life * 8, p.life * 6, 0);
      dummy.updateMatrix();
      im.setMatrixAt(n, dummy.matrix);
      arr[n] = p;
      n++;
    }
    arr.length = n;
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[geo, mat, MAX_PARTICLES]}
        frustumCulled={false}
      />
      <EffectComposer multisampling={2}>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </>
  );
}
