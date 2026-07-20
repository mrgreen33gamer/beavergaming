"use client";

import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  RigidBody,
  CuboidCollider,
  interactionGroups,
  type RapierRigidBody,
  type ContactForcePayload,
} from "@react-three/rapier";
import { CAR, NITROUS, IMPACT, TRACK, CAR_FX_COOLDOWN_MS } from "./config";
import { fxBus } from "./fxBus";
import { debrisBus } from "./debrisBus";
import { ModelBoundary } from "./Model";
import { VehicleModel, type VehicleApi } from "./Vehicle";
import { CAR_MODEL, MODEL_YAW } from "./models";
import { initialNitrous, spendNitrous, nitrousActive, initialDamage, applyDamage } from "./scoring";
import type { Phase, RunHud } from "./index";

const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _cam = new THREE.Vector3();

const SPAWN = { x: CAR.spawn[0], y: CAR.spawn[1], z: CAR.spawn[2] };
const CAR_GROUPS = interactionGroups(1, [0]);
const WHEEL_RADIUS = 0.4;

export interface CarProps {
  phase: Phase;
  hud: RunHud;
  onEnterCrash: () => void;
  armedAt: number;
}

export default function Car({ phase, hud, onEnterCrash, armedAt }: CarProps) {
  const body = useRef<RapierRigidBody>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const input = useRef({ throttle: false, reverse: false, left: false, right: false });
  const speed = useRef(0);
  const nitrous = useRef(initialNitrous(NITROUS.charges));
  const crashed = useRef(false);
  const lastFx = useRef(0);
  const vehicle = useRef<VehicleApi | null>(null);
  const damageRef = useRef(initialDamage());

  useEffect(() => {
    body.current?.setEnabledRotations(false, true, false, true);
  }, []);

  useEffect(() => {
    const i = input.current;
    const down = (e: KeyboardEvent) => {
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
      i.throttle = i.reverse = i.left = i.right = false;
    };
  }, []);

  useFrame((state, delta) => {
    const b = body.current;
    if (!b) return;
    const dt = Math.min(delta, 1 / 30);
    const now = performance.now();
    const t = b.translation();

    if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) {
      b.setTranslation(SPAWN, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      speed.current = 0;
      return;
    }

    if (t.y < -25 && !crashed.current) {
      crashed.current = true;
      b.setEnabledRotations(true, true, true, true);
      onEnterCrash();
    }

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

    if (!crashed.current && t.z < TRACK.pileZ + 18) {
      crashed.current = true;
      b.setEnabledRotations(true, true, true, true);
      onEnterCrash();
    }

    const lv = b.linvel();
    hud.speed = Math.hypot(lv.x, lv.z);
    hud.nitrousCharges = nitrous.current.charges;
    hud.nitrousActive = boost;

    // Roll the wheels by the distance actually travelled along the car's facing.
    const forwardSpeed = lv.x * _fwd.x + lv.z * _fwd.z;
    vehicle.current?.spinWheels((forwardSpeed * dt) / WHEEL_RADIUS);

    _cam.set(t.x - _fwd.x * 12, t.y + 6, t.z - _fwd.z * 12);
    const k = 1 - Math.pow(0.0015, dt);
    state.camera.position.lerp(_cam, k);
    state.camera.lookAt(t.x + _fwd.x * 3, t.y + 1, t.z + _fwd.z * 3);

    if (fxBus.shake > 0.001) {
      const s = fxBus.shake;
      state.camera.position.x += (Math.random() - 0.5) * s * 0.9;
      state.camera.position.y += (Math.random() - 0.5) * s * 0.6;
      fxBus.shake = Math.max(0, s - dt * 2.4);
    }
  });

  const onCarContact = (p: ContactForcePayload) => {
    const b = body.current;
    if (!b) return;
    if (!p.other.rigidBodyObject?.userData?.smashable) return;

    const mag = p.totalForceMagnitude;
    const now = performance.now();
    const t = b.translation();

    if (mag > IMPACT.destroyForce && now - lastFx.current > CAR_FX_COOLDOWN_MS) {
      lastFx.current = now;
      fxBus.triggerImpact(t.x, t.y + 0.4, t.z, Math.min(1, mag / (IMPACT.carDamageForce * 1.4)));
    }
    if (mag < IMPACT.carDamageForce || now < armedAt) return;

    const res = applyDamage(damageRef.current, now, IMPACT.carDamageCooldownMs);
    if (!res.applied) return;
    damageRef.current = res.state;

    // Impact point + inward direction, from the other body's position.
    const o = p.other.rigidBody?.translation();
    let px = t.x, py = t.y + 0.2, pz = t.z;
    let dx = _fwd.x, dy = -0.2, dz = _fwd.z;
    if (o) {
      const vx = o.x - t.x, vy = o.y - t.y, vz = o.z - t.z;
      const dist = Math.hypot(vx, vy, vz) || 1;
      const nx = vx / dist, ny = vy / dist, nz = vz / dist;
      const reach = Math.min(dist, 2.2);
      px = t.x + nx * reach; py = t.y + ny * reach; pz = t.z + nz * reach;
      dx = -nx; dy = -Math.abs(ny) * 0.5 - 0.1; dz = -nz;
    }
    vehicle.current?.dent(
      new THREE.Vector3(px, py, pz),
      new THREE.Vector3(dx, dy, dz).normalize(),
      Math.min(0.7, 0.25 + mag / 8000),
    );

    // Shed a real part (wheel/spoiler) from the car at the impact.
    const part = vehicle.current?.detachNext();
    if (part) {
      const lv = b.linvel();
      debrisBus.emit(part.model, part.pos, [
        lv.x + (Math.random() - 0.5) * 6,
        lv.y + 4 + Math.random() * 3,
        lv.z + (Math.random() - 0.5) * 6,
      ]);
    }
  };

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      collisionGroups={CAR_GROUPS}
      position={[SPAWN.x, SPAWN.y, SPAWN.z]}
      density={CAR.density}
      linearDamping={CAR.linearDamping}
      angularDamping={CAR.angularDamping}
      onContactForce={onCarContact}
    >
      <CuboidCollider args={[1.1, 0.5, 2.3]} collisionGroups={CAR_GROUPS} />
      <ModelBoundary fallback={<ProceduralCar />}>
        <Suspense fallback={<ProceduralCar />}>
          <VehicleModel url={CAR_MODEL} fit={4.6} baseY={-0.5} yaw={MODEL_YAW.car} apiRef={vehicle} />
        </Suspense>
      </ModelBoundary>
    </RigidBody>
  );
}

function ProceduralCar() {
  return (
    <group>
      <RoundedBox args={[2.1, 0.7, 4.4]} radius={0.14} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#e0463f" metalness={0.2} roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[1.9, 0.65, 2.1]} radius={0.16} smoothness={3} position={[0, 0.6, 0.2]} castShadow>
        <meshStandardMaterial color="#c23a34" metalness={0.2} roughness={0.45} />
      </RoundedBox>
      {[
        [-1.1, -0.48, 1.5],
        [1.1, -0.48, 1.5],
        [-1.1, -0.48, -1.5],
        [1.1, -0.48, -1.5],
      ].map(([x, y, z], idx) => (
        <mesh key={idx} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.35, 18]} />
          <meshStandardMaterial color="#141414" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
