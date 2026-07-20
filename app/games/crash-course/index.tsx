"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useCartridge } from "@/lib/platform/useCartridge";
import { NITROUS, SETTLE } from "./config";
import {
  initialScore,
  registerDestruction,
  type ScoreState,
  type PropKind,
} from "./scoring";
import Scene from "./Scene";

export type Phase = "intro" | "ready" | "driving" | "crashing" | "results";

/** Mutable HUD snapshot written by the car each frame, sampled on a timer. */
export interface RunHud {
  speed: number;
  nitrousCharges: number;
  nitrousActive: boolean;
}

function freshHud(): RunHud {
  return { speed: 0, nitrousCharges: NITROUS.charges, nitrousActive: false };
}

export default function CrashCourse() {
  const { host, highScore } = useCartridge("crash-course");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(3);
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState<ScoreState>(initialScore());
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const hud = useRef<RunHud>(freshHud());
  const [hudView, setHudView] = useState<RunHud>(freshHud());
  const reported = useRef(false);

  // --- countdown: ready -> driving ---
  useEffect(() => {
    if (phase !== "ready") return;
    setCount(3);
    const iv = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(iv);
          setPhase("driving");
          return 0;
        }
        return c - 1;
      });
    }, 800);
    return () => clearInterval(iv);
  }, [phase]);

  // --- HUD sampling while the sim runs ---
  useEffect(() => {
    if (phase !== "driving" && phase !== "crashing") return;
    const iv = setInterval(() => setHudView({ ...hud.current }), 90);
    return () => clearInterval(iv);
  }, [phase]);

  // --- settle watcher: crashing -> results ---
  useEffect(() => {
    if (phase !== "crashing") return;
    const started = performance.now();
    let restSince: number | null = null;
    const iv = setInterval(() => {
      const now = performance.now();
      if (hud.current.speed < SETTLE.restSpeed) {
        restSince ??= now;
        if (now - restSince >= SETTLE.restHoldMs) finish();
      } else {
        restSince = null;
      }
      if (now - started >= SETTLE.maxCrashMs) finish();
    }, 150);
    const finish = () => {
      clearInterval(iv);
      setPhase("results");
    };
    return () => clearInterval(iv);
  }, [phase]);

  // --- report the score once, on entering results ---
  useEffect(() => {
    if (phase !== "results" || reported.current) return;
    reported.current = true;
    hostRef.current.reportScore(scoreRef.current.total);
  }, [phase]);

  const start = () => {
    hud.current = freshHud();
    setHudView(freshHud());
    setScore(initialScore());
    reported.current = false;
    setRunKey((k) => k + 1);
    setPhase("ready");
  };

  // The finale is triggered ONLY by the car reaching the pile — never by a
  // destruction event. Otherwise the pile settling on physics-unpause counts
  // as "destruction" and ends the run before the player can drive.
  const enterCrash = () => setPhase((p) => (p === "driving" ? "crashing" : p));

  const onDestroyed = (kind: PropKind) => {
    setScore((prev) => registerDestruction(prev, kind, performance.now()));
  };

  const running = phase === "driving" || phase === "crashing";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full max-w-[900px] font-[family-name:var(--font-mono)] text-lg">
        <span>
          <span className="text-[var(--muted)]">SCORE </span>
          <span className="text-[var(--crt-green)]">{score.total.toLocaleString()}</span>
        </span>
        {score.multiplier > 1 && running && (
          <span className="px-2 py-0.5 rounded bg-[var(--accent-hot)]/30 text-[var(--accent-hot)] flicker">
            COMBO ×{score.multiplier}
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">NITRO </span>
          {Array.from({ length: NITROUS.charges }).map((_, i) => (
            <span
              key={i}
              className="inline-block w-3 h-3 rounded-sm"
              style={{
                background: i < hudView.nitrousCharges ? "#5fc8e0" : "#333",
                boxShadow: hudView.nitrousActive && i < hudView.nitrousCharges ? "0 0 6px #5fc8e0" : "none",
              }}
            />
          ))}
        </span>
        <span>
          <span className="text-[var(--muted)]">BEST </span>
          <span className="text-[var(--accent)]">{highScore.toLocaleString()}</span>
        </span>
      </div>

      {/* 3D viewport */}
      <div
        className="relative w-full max-w-[900px] rounded border-2 border-[var(--border)] overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        <Canvas shadows camera={{ position: [0, 6, 18], fov: 55 }}>
          <color attach="background" args={["#10131c"]} />
          <fog attach="fog" args={["#10131c", 45, 140]} />
          <Physics gravity={[0, -19, 0]} paused={phase === "intro" || phase === "ready"}>
            <Scene
              phase={phase}
              hud={hud.current}
              onDestroyed={onDestroyed}
              onEnterCrash={enterCrash}
              runKey={runKey}
              active={phase === "crashing"}
            />
          </Physics>
        </Canvas>

        {/* Countdown */}
        {phase === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-[family-name:var(--font-display)] text-6xl text-[var(--accent)] drop-shadow-lg">
              {count > 0 ? count : "GO!"}
            </span>
          </div>
        )}

        {/* Speed readout */}
        {running && (
          <div className="absolute bottom-2 right-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">
            {Math.round(hudView.speed * 3.6)} km/h
            {hudView.nitrousActive && <span className="ml-2 text-[#5fc8e0] flicker">NITRO</span>}
          </div>
        )}

        {/* Intro */}
        {phase === "intro" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--accent)] mb-2">
              CRASH COURSE
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] max-w-md mb-3">
              Drive the track, bank your 3 nitro charges, and plow into the pile at the end.
              Chain your smashes for a combo multiplier. Wreck everything.
            </p>
            <button
              onClick={start}
              className="pixel-edge px-6 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-sm"
            >
              START
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">
              WASD / arrows to drive · SPACE for nitro
            </p>
          </div>
        )}

        {/* Results */}
        {phase === "results" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--accent)] mb-2">
              WRECKAGE
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-3xl text-[var(--foreground)] mb-1">
              {score.total.toLocaleString()}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-1">
              {score.destroyed} objects wrecked · best combo ×{score.bestMultiplier}
            </p>
            {score.total >= highScore && score.total > 0 && (
              <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">
                ★ NEW RECORD ★
              </p>
            )}
            <button
              onClick={start}
              className="pixel-edge mt-2 px-6 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-sm"
            >
              CRASH AGAIN
            </button>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-2xl">
        A 3D demolition run. The drive is the wind-up — the pile at the end is the point.
        Time your nitro, aim for the gold crates and cars, and chain the destruction for the
        biggest combo you can.
      </p>
    </div>
  );
}
