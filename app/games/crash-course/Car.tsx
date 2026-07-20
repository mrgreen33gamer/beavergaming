"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { CAR, NITROUS, IMPACT, TRACK } from "./config";
import {
  initialNitrous,
  spendNitrous,
  nitrousActive,
  initialDamage,
  applyDamage,
  squashScale,
  type DamagePanel,
} from "./scoring";
import type { Phase, RunHud } from "./index";

// Reused scratch objects so the frame loop allocates nothing.
const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _cam = new THREE.Vector3();

/** Panels that can shed, with their body-local placement and look. */
const PANEL_LAYOUT: Record<
  DamagePanel,
  { offset: [number, number, number]; size: [number, number, number]; color: string }
> = {
  roof: { offset: [0, 0.7, -0.1], size: [1.5, 0.4, 1.7], color: "#3f6fc4" },
  bumper: { offset: [0, -0.15, -1.95], size: [1.8, 0.5, 0.4], color: "#2a2f3a" },
  wheel: { offset: [0.95, -0.45, 1.25], size: [0.5, 0.5, 0.5], color: "#1a1a1a" },
};

interface DebrisPiece {
  id: number;
  panel: DamagePanel;
  pos: [number, number, number];
  vel: [number, number, number];
}

export interface CarProps {
  phase: Phase;
  /** Written every frame for the HUD to sample; never triggers React renders. */
  hud: RunHud;
  /** Called once when the car reaches / enters the destruction zone. */
  onEnterCrash: () => void;
}

export default function Car({ phase, hud, onEnterCrash }: CarProps) {
  const body = useRef<RapierRigidBody>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const input = useRef({ throttle: false, reverse: false, left: false, right: false });
  const speed = useRef(0); // signed scalar cruise speed, arcade-eased
  const nitrous = useRef(initialNitrous(NITROUS.charges));
  const crashed = useRef(false);

  const damageRef = useRef(initialDamage());
  const [dmg, setDmg] = useState(initialDamage());
  const [debris, setDebris] = useState<DebrisPiece[]>([]);
  const debrisId = useRef(0);

  // Lock pitch/roll while driving so the car stays upright and steerable.
  useEffect(() => {
    body.current?.setEnabledRotations(false, true, false, true);
  }, []);

  // Keyboard. Space spends a nitrous charge (only while driving).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const i = input.current;
      switch (e.code) {
        case "KeyW": case "ArrowUp": i.throttle = true; break;
        case "KeyS": case "ArrowDown": i.reverse = true; break;
        case "KeyA": case "ArrowLeft": i.left = true; break;
        case "KeyD": case "ArrowRight": i.right = true; break;
        case "Space":
          e.preventDefault();
          if (phaseRef.current === "driving") {
            nitrous.current = spendNitrous(nitrous.current, performance.now(), NITROUS.durationMs);
          }
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      const i = input.current;
      switch (e.code) {
        case "KeyW": case "ArrowUp": i.throttle = false; break;
        case "KeyS": case "ArrowDown": i.reverse = false; break;
        case "KeyA": case "ArrowLeft": i.left = false; break;
        case "KeyD": case "ArrowRight": i.right = false; break;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((state, delta) => {
    const b = body.current;
    if (!b) return;
    const dt = Math.min(delta, 1 / 30); // clamp so a stutter can't launch the car
    const now = performance.now();

    const rot = b.rotation();
    _q.set(rot.x, rot.y, rot.z, rot.w);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    const boost = nitrousActive(nitrous.current, now);

    if (phaseRef.current === "driving") {
      const top = CAR.topSpeed * (boost ? NITROUS.speedMult : 1);
      const accel = CAR.accel * (boost ? NITROUS.accelMult : 1);
      const target = input.current.throttle ? top : input.current.reverse ? -CAR.reverseSpeed : 0;
      const ds = target - speed.current;
      speed.current += Math.sign(ds) * Math.min(Math.abs(ds), accel * dt);

      const lv = b.linvel();
      b.setLinvel({ x: _fwd.x * speed.current, y: lv.y, z: _fwd.z * speed.current }, true);

      const steer = (input.current.left ? 1 : 0) - (input.current.right ? 1 : 0);
      const speedFactor = Math.min(1, Math.abs(speed.current) / CAR.steerSpeedRef);
      const dir = speed.current >= 0 ? 1 : -1;
      b.setAngvel({ x: 0, y: steer * CAR.steerRate * speedFactor * dir, z: 0 }, true);
    }

    // Reaching the pile zone hands control to physics for the finale. Armed a
    // little ahead of the pile so props (and the slow movers) are already
    // "live" by the time the car ploughs into them.
    const t = b.translation();
    if (!crashed.current && t.z < TRACK.pileZ + 18) {
      crashed.current = true;
      b.setEnabledRotations(true, true, true, true);
      onEnterCrash();
    }

    // HUD sampling (mutations only — no React churn per frame).
    const lv = b.linvel();
    hud.speed = Math.hypot(lv.x, lv.z);
    hud.nitrousCharges = nitrous.current.charges;
    hud.nitrousActive = boost;

    // Chase camera trails behind and above, looking just ahead of the car.
    _cam.set(t.x - _fwd.x * 11, t.y + 5.5, t.z - _fwd.z * 11);
    const k = 1 - Math.pow(0.0015, dt);
    state.camera.position.lerp(_cam, k);
    state.camera.lookAt(t.x + _fwd.x * 3, t.y + 1, t.z + _fwd.z * 3);
  });

  const onContactForce = (mag: number) => {
    if (mag < IMPACT.carDamageForce) return;
    const res = applyDamage(damageRef.current, performance.now(), IMPACT.carDamageCooldownMs);
    if (!res.applied) return;
    damageRef.current = res.state;
    setDmg(res.state);
    const b = body.current;
    if (res.detached && b) {
      const t = b.translation();
      const r = b.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      const off = PANEL_LAYOUT[res.detached].offset;
      _v.set(off[0], off[1], off[2]).applyQuaternion(_q).add(_v2.set(t.x, t.y, t.z));
      const lv = b.linvel();
      const id = debrisId.current++;
      const panel = res.detached;
      setDebris((d) => [
        ...d,
        { id, panel, pos: [_v.x, _v.y, _v.z], vel: [lv.x, lv.y + 3, lv.z] },
      ]);
    }
  };

  const squash = squashScale(dmg.hits);

  return (
    <>
      <RigidBody
        ref={body}
        type="dynamic"
        colliders="cuboid"
        position={[CAR.spawn[0], CAR.spawn[1], CAR.spawn[2]]}
        density={CAR.density}
        linearDamping={CAR.linearDamping}
        angularDamping={CAR.angularDamping}
        onContactForce={(p) => onContactForce(p.totalForceMagnitude)}
      >
        <group scale={[1, squash, 1]}>
          {/* chassis */}
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 0.6, 3.6]} />
            <meshStandardMaterial color="#d64545" metalness={0.3} roughness={0.5} />
          </mesh>
          {/* cabin */}
          <mesh castShadow position={[0, 0.5, 0.15]}>
            <boxGeometry args={[1.55, 0.55, 1.7]} />
            <meshStandardMaterial color="#b83636" metalness={0.3} roughness={0.5} />
          </mesh>
          {/* shed-able panels */}
          {dmg.attached.includes("roof") && (
            <mesh castShadow position={PANEL_LAYOUT.roof.offset}>
              <boxGeometry args={PANEL_LAYOUT.roof.size} />
              <meshStandardMaterial color={PANEL_LAYOUT.roof.color} />
            </mesh>
          )}
          {dmg.attached.includes("bumper") && (
            <mesh castShadow position={PANEL_LAYOUT.bumper.offset}>
              <boxGeometry args={PANEL_LAYOUT.bumper.size} />
              <meshStandardMaterial color={PANEL_LAYOUT.bumper.color} />
            </mesh>
          )}
          {/* wheels — the front-right one is a shed-able panel */}
          {[
            [-0.95, -0.45, 1.25],
            [0.95, -0.45, 1.25],
            [-0.95, -0.45, -1.25],
            [0.95, -0.45, -1.25],
          ].map(([x, y, z], i) => {
            const isShedWheel = i === 1;
            if (isShedWheel && !dmg.attached.includes("wheel")) return null;
            return (
              <mesh key={i} castShadow position={[x, y, z]}>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
              </mesh>
            );
          })}
        </group>
      </RigidBody>

      {debris.map((d) => (
        <Debris key={d.id} piece={d} />
      ))}
    </>
  );
}

/** A shed panel living as its own tumbling rigid body. */
function Debris({ piece }: { piece: DebrisPiece }) {
  const ref = useRef<RapierRigidBody>(null);
  useEffect(() => {
    const b = ref.current;
    if (!b) return;
    b.setLinvel({ x: piece.vel[0], y: piece.vel[1], z: piece.vel[2] }, true);
    b.setAngvel(
      { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 },
      true,
    );
  }, [piece.vel]);
  const p = PANEL_LAYOUT[piece.panel];
  return (
    <RigidBody ref={ref} position={piece.pos} colliders="cuboid" density={0.5}>
      <mesh castShadow>
        <boxGeometry args={p.size} />
        <meshStandardMaterial color={p.color} />
      </mesh>
    </RigidBody>
  );
}
