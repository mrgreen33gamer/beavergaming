"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import { CAR, NITROUS, IMPACT, TRACK } from "./config";
import { fxBus } from "./fxBus";
import { ModelOrShape } from "./Model";
import { CAR_MODEL, DEBRIS_MODELS, MODEL_YAW } from "./models";
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

const SPAWN = { x: CAR.spawn[0], y: CAR.spawn[1], z: CAR.spawn[2] };

/** Which Kenney debris part flies off for each shed panel. */
const PANEL_DEBRIS: Record<DamagePanel, string> = {
  roof: DEBRIS_MODELS[1], // door
  bumper: DEBRIS_MODELS[0], // bumper
  wheel: DEBRIS_MODELS[2], // tire
};

interface DebrisPiece {
  id: number;
  model: string;
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

    _cam.set(t.x - _fwd.x * 11, t.y + 5.5, t.z - _fwd.z * 11);
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

  const onContactForce = (mag: number) => {
    const b = body.current;
    if (!b) return;
    if (mag > IMPACT.destroyForce) {
      const t = b.translation();
      fxBus.triggerImpact(t.x, t.y + 0.4, t.z, Math.min(1, mag / (IMPACT.carDamageForce * 1.4)));
    }
    if (mag < IMPACT.carDamageForce) return;
    const res = applyDamage(damageRef.current, performance.now(), IMPACT.carDamageCooldownMs);
    if (!res.applied) return;
    damageRef.current = res.state;
    setDmg(res.state);
    if (res.detached) {
      const t = b.translation();
      const r = b.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      _v.set(0, 0.5, 0).applyQuaternion(_q).add(_v2.set(t.x, t.y, t.z));
      const lv = b.linvel();
      const id = debrisId.current++;
      const model = PANEL_DEBRIS[res.detached];
      setDebris((d) => [
        ...d,
        { id, model, pos: [_v.x, _v.y, _v.z], vel: [lv.x, lv.y + 3, lv.z] },
      ]);
    }
  };

  const squash = squashScale(dmg.hits);

  return (
    <>
      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={[SPAWN.x, SPAWN.y, SPAWN.z]}
        density={CAR.density}
        linearDamping={CAR.linearDamping}
        angularDamping={CAR.angularDamping}
        onContactForce={(p) => onContactForce(p.totalForceMagnitude)}
      >
        <CuboidCollider args={[0.9, 0.35, 1.8]} />
        <group scale={[1, squash, 1]}>
          <ModelOrShape
            url={CAR_MODEL}
            fit={3.6}
            baseY={-0.35}
            yaw={MODEL_YAW.car}
            fallback={<ProceduralCar />}
          />
        </group>
      </RigidBody>

      {debris.map((d) => (
        <Debris key={d.id} piece={d} />
      ))}
    </>
  );
}

/** Fallback car (procedural) shown while the model loads or if it fails. */
function ProceduralCar() {
  return (
    <group>
      <RoundedBox args={[1.8, 0.6, 3.6]} radius={0.12} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#e0463f" metalness={0.15} roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[1.55, 0.55, 1.7]} radius={0.14} smoothness={3} position={[0, 0.5, 0.15]} castShadow>
        <meshStandardMaterial color="#c23a34" metalness={0.15} roughness={0.45} />
      </RoundedBox>
      {[
        [-0.95, -0.42, 1.25],
        [0.95, -0.42, 1.25],
        [-0.95, -0.42, -1.25],
        [0.95, -0.42, -1.25],
      ].map(([x, y, z], idx) => (
        <mesh key={idx} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.3, 18]} />
          <meshStandardMaterial color="#141414" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** A shed car part, tumbling as its own rigid body. */
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
  return (
    <RigidBody ref={ref} position={piece.pos} colliders={false} density={0.5}>
      <CuboidCollider args={[0.35, 0.2, 0.35]} />
      <ModelOrShape
        url={piece.model}
        fit={0.9}
        baseY={-0.2}
        yaw={0}
        fallback={
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color="#2a2f3a" metalness={0.3} roughness={0.5} />
          </mesh>
        }
      />
    </RigidBody>
  );
}
