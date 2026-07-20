"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Physics } from "@react-three/rapier";
import { useCartridge } from "@/lib/platform/useCartridge";
import { NITROUS, ARM_GRACE_MS } from "./config";
import {
  initialScore,
  registerDestruction,
  type ScoreState,
  type PropKind,
} from "./scoring";
import Scene from "./Scene";
import Effects from "./Effects";
import { fxBus } from "./fxBus";
import { QualityProvider } from "./engine/QualityContext";
import { Viewport } from "./engine/Viewport";
import { useSettle } from "./engine/useSettle";
import { getMap, DEFAULT_MAP_ID, mapChoices } from "./content/maps";

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
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [count, setCount] = useState(3);
  const [runKey, setRunKey] = useState(0);
  const [selectedMapId, setSelectedMapId] = useState<string>(DEFAULT_MAP_ID);
  const map = getMap(selectedMapId);
  const speedRef = useRef(0);
  /** performance.now() when driving began — props arm ARM_GRACE_MS later. */
  const [driveStartMs, setDriveStartMs] = useState<number | null>(null);
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
          setDriveStartMs(performance.now());
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

  // Keep a plain speed ref in sync for the settle watcher.
  useEffect(() => {
    speedRef.current = hud.current.speed;
  });

  const finishRun = useCallback(() => setPhase("results"), []);
  useSettle(phase === "crashing", speedRef, finishRun);

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
    setDriveStartMs(null);
    reported.current = false;
    fxBus.reset();
    // Bumping runKey remounts the whole scene (car, damage, debris, pile), so
    // every run starts from a guaranteed-clean physics world.
    setRunKey((k) => k + 1);
    setPhase("ready");
  };

  // Both callbacks are stable (empty deps) so a score update never changes the
  // props handed to <Scene>/<Effects>. Combined with memoising those two, a
  // crash that fires dozens of setScore calls per second no longer re-renders
  // the whole 3D tree or rebuilds the post-processing composer each time — that
  // reconciliation storm was what stalled frames and flashed the screen black.
  //
  // The finale is triggered ONLY by the car reaching the pile — never by a
  // destruction event. Otherwise the pile settling on physics-unpause counts
  // as "destruction" and ends the run before the player can drive.
  const enterCrash = useCallback(
    () => setPhase((p) => (p === "driving" ? "crashing" : p)),
    [],
  );

  // Score only accrues while the run is live. Once the settle watcher flips us
  // to "results", the number is frozen — props still nudging each other as the
  // pile settles must never keep ticking the final score up.
  const onDestroyed = useCallback((kind: PropKind) => {
    if (phaseRef.current !== "driving" && phaseRef.current !== "crashing") return;
    setScore((prev) => registerDestruction(prev, kind, performance.now()));
  }, []);

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
        {/* "percentage" = PCFShadowMap. Plain `shadows` selects the now-
            deprecated PCFSoftShadowMap, which Three re-warns about every single
            frame it renders shadows — that flood was the console spam. Viewport
            (engine spine) owns the Canvas, dpr/shadow tier, background colour,
            error boundary, and context-loss recovery. */}
        <QualityProvider>
          <Viewport background={map.theme.background} fov={55}>
            <fog attach="fog" args={[map.theme.background, map.theme.fogNear, map.theme.fogFar]} />
            <Physics gravity={[0, -19, 0]} paused={phase === "intro" || phase === "ready"}>
              <Scene
                key={runKey}
                phase={phase}
                hud={hud.current}
                onDestroyed={onDestroyed}
                onEnterCrash={enterCrash}
                runKey={runKey}
                armedAt={driveStartMs === null ? Infinity : driveStartMs + ARM_GRACE_MS}
                map={map}
              />
            </Physics>
            <Effects />
          </Viewport>
        </QualityProvider>

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
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              {mapChoices().map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => setSelectedMapId(choice.id)}
                  className={`pixel-edge px-3 py-1 rounded font-[family-name:var(--font-mono)] text-xs ${
                    choice.id === selectedMapId
                      ? "bg-[var(--accent)] text-[var(--background)]"
                      : "bg-transparent border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {choice.name}
                </button>
              ))}
            </div>
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
