"use client";

import { useEffect, useMemo, type MutableRefObject } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { DEBRIS_MODELS } from "./models";

const DENT_RADIUS = 0.9;

export interface VehicleApi {
  /** Deform the body mesh at a world-space impact point. */
  dent: (worldPoint: THREE.Vector3, worldDir: THREE.Vector3, strength: number) => void;
  /** Roll the wheels by `delta` radians (drive by distance travelled). */
  spinWheels: (delta: number) => void;
  /** Detach the next available part; returns its debris model + world pos. */
  detachNext: () => { model: string; pos: [number, number, number] } | null;
}

interface VehicleProps {
  url: string;
  fit: number;
  baseY: number;
  yaw: number;
  apiRef: MutableRefObject<VehicleApi | null>;
}

/**
 * A Kenney vehicle whose named nodes are addressable: the wheels spin, the
 * body deforms per-vertex where it's struck, and wheels/spoiler detach one at
 * a time on heavy hits. Body geometry is cloned per instance; wheels/spoiler
 * are shared (they only ever move or hide, never deform).
 */
export function VehicleModel({ url, fit, baseY, yaw, apiRef }: VehicleProps) {
  const { scene } = useGLTF(url);

  const state = useMemo(() => {
    const clone = scene.clone(true);
    const wheels: THREE.Object3D[] = [];
    const bodyMeshes: THREE.Mesh[] = [];
    const detachables: { node: THREE.Object3D; part: "wheel" | "spoiler" }[] = [];

    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      const name = (o.name || "").toLowerCase();
      if (name.includes("wheel")) {
        wheels.push(o);
        detachables.push({ node: o, part: "wheel" });
      } else if (name.includes("spoiler")) {
        detachables.push({ node: o, part: "spoiler" });
      } else if (m.isMesh && name.includes("body")) {
        m.geometry = m.geometry.clone();
        bodyMeshes.push(m);
      }
    });
    // Fallback: if no node is literally named "body", dent every non-wheel mesh.
    if (bodyMeshes.length === 0) {
      clone.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(o.name || "").toLowerCase().includes("wheel")) {
          m.geometry = m.geometry.clone();
          bodyMeshes.push(m);
        }
      });
    }

    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = fit / Math.max(size.x, size.y, size.z || 1);
    return {
      clone,
      wheels,
      bodyMeshes,
      detachables,
      scale: s,
      pos: [-center.x * s, baseY - box.min.y * s, -center.z * s] as [number, number, number],
    };
  }, [scene, fit, baseY]);

  useEffect(() => {
    const inv = new THREE.Matrix4();
    const wv = new THREE.Vector3();
    const lp = new THREE.Vector3();
    let detachIdx = 0;

    apiRef.current = {
      dent: (worldPoint, worldDir, strength) => {
        const push = Math.min(0.75, strength);
        for (const m of state.bodyMeshes) {
          m.updateWorldMatrix(true, false);
          inv.copy(m.matrixWorld).invert();
          const attr = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          let touched = false;
          for (let i = 0; i < attr.count; i++) {
            wv.fromBufferAttribute(attr, i).applyMatrix4(m.matrixWorld);
            const d = wv.distanceTo(worldPoint);
            if (d < DENT_RADIUS) {
              const f = 1 - d / DENT_RADIUS;
              wv.addScaledVector(worldDir, push * f * f);
              lp.copy(wv).applyMatrix4(inv);
              attr.setXYZ(i, lp.x, lp.y, lp.z);
              touched = true;
            }
          }
          if (touched) {
            attr.needsUpdate = true;
            m.geometry.computeVertexNormals();
          }
        }
      },
      spinWheels: (delta) => {
        for (const w of state.wheels) w.rotation.x += delta;
      },
      detachNext: () => {
        while (detachIdx < state.detachables.length) {
          const d = state.detachables[detachIdx++];
          if (d.node.visible) {
            d.node.visible = false;
            d.node.updateWorldMatrix(true, false);
            const p = new THREE.Vector3().setFromMatrixPosition(d.node.matrixWorld);
            const model =
              d.part === "wheel" ? DEBRIS_MODELS[2] : DEBRIS_MODELS[3]; // tire / spoiler
            return { model, pos: [p.x, p.y, p.z] };
          }
        }
        return null;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, state]);

  return (
    <group rotation={[0, yaw, 0]}>
      <group scale={state.scale} position={state.pos}>
        <primitive object={state.clone} />
      </group>
    </group>
  );
}
