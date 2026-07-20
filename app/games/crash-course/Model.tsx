"use client";

import { Component, Suspense, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ALL_MODELS } from "./models";

// Warm the cache so models are ready by the time a run starts.
ALL_MODELS.forEach((u) => useGLTF.preload(u));

interface AutoModelProps {
  url: string;
  /** Target size of the model's longest axis, in metres. */
  fit: number;
  /** World-local Y at which the model's bottom should sit. */
  baseY: number;
  /** Yaw correction so the model faces the game's forward (-Z). */
  yaw: number;
}

/**
 * Loads a GLB and normalises it: scaled so its longest axis is `fit`, centred
 * on X/Z, base-aligned to `baseY`, and yawed to face forward. Auto-fitting
 * means we never have to know a model's native scale or origin by hand.
 */
function AutoModel({ url, fit, baseY, yaw }: AutoModelProps) {
  const { scene } = useGLTF(url);

  const { object, scale, pos } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = fit / Math.max(size.x, size.y, size.z || 1);
    return {
      object: clone,
      scale: s,
      pos: [-center.x * s, baseY - box.min.y * s, -center.z * s] as [number, number, number],
    };
  }, [scene, fit, baseY]);

  return (
    <group rotation={[0, yaw, 0]}>
      <group scale={scale} position={pos}>
        <primitive object={object} />
      </group>
    </group>
  );
}

/** Renders the procedural fallback if a model errors out at load. */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * A model with a guaranteed shape: the `fallback` renders while the GLB loads
 * and permanently if it fails, so the game never blanks on a missing asset.
 */
export function ModelOrShape({
  fallback,
  ...props
}: AutoModelProps & { fallback: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <AutoModel {...props} />
      </Suspense>
    </ModelBoundary>
  );
}
