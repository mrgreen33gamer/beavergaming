"use client";

import { useEffect, useRef, useState } from "react";

const COLS = 13;
const ROWS = 13;
const CELL = 36;
const WIDTH = COLS * CELL;   // 468
const HEIGHT = ROWS * CELL;  // 468

// Row layout (top to bottom). 0=home, 1-5=river, 6=safe median, 7-11=road, 12=start
type Lane = { type: "home" | "river" | "road" | "safe"; dir: number; speed: number; gap: number; len: number; offset: number };

function buildLanes(level: number): Lane[] {
  const lanes: Lane[] = [];
  lanes.push({ type: "home", dir: 0, speed: 0, gap: 0, len: 0, offset: 0 }); // row 0
  // River rows 1-5 (logs float)
  for (let i = 0; i < 5; i++) {
    lanes.push({
      type: "river",
      dir: i % 2 === 0 ? 1 : -1,
      speed: 0.6 + Math.random() * 0.6 + level * 0.1,
      gap: 3 + Math.floor(Math.random() * 2),
      len: 2 + Math.floor(Math.random() * 2),
      offset: Math.random() * 5,
    });
  }
  lanes.push({ type: "safe", dir: 0, speed: 0, gap: 0, len: 0, offset: 0 }); // row 6 median
  // Road rows 7-11 (cars)
  for (let i = 0; i < 5; i++) {
    lanes.push({
      type: "road",
      dir: i % 2 === 0 ? -1 : 1,
      speed: 0.8 + Math.random() * 0.8 + level * 0.12,
      gap: 3 + Math.floor(Math.random() * 2),
      len: 1,
      offset: Math.random() * 5,
    });
  }
  lanes.push({ type: "safe", dir: 0, speed: 0, gap: 0, len: 0, offset: 0 }); // row 12 start
  return lanes;
}

export default function Frogger() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [homes, setHomes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    fx: 6, fy: 12,           // frog grid position
    fOffset: 0,              // horizontal pixel offset when riding a log
    lanes: [] as Lane[],
    filledHomes: [] as boolean[],
    running: false,
    score: 0, lives: 3, level: 1,
    t: 0,
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("frogger-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const reset = () => {
    const st = s.current;
    st.fx = 6; st.fy = 12; st.fOffset = 0;
    st.lanes = buildLanes(1);
    st.filledHomes = [false, false, false];
    st.running = true;
    st.score = 0; st.lives = 3; st.level = 1;
    st.t = 0;
    setScore(0); setLives(3); setLevel(1); setHomes(0);
    setGameOver(false); setStarted(true);
  };

  const respawn = (st: typeof s.current) => {
    st.fx = 6; st.fy = 12; st.fOffset = 0;
  };

  // Get obstacle positions for a lane at time t (returns array of {x, w})
  const laneObjects = (lane: Lane, t: number): { x: number; w: number }[] => {
    if (lane.type !== "river" && lane.type !== "road") return [];
    const objs: { x: number; w: number }[] = [];
    const period = lane.len + lane.gap;
    const shift = (t * lane.speed * lane.dir) / CELL + lane.offset;
    for (let i = -1; i < Math.ceil(COLS / period) + 2; i++) {
      let x = (i * period + (shift % period));
      // normalize into visible-ish range handled by drawing
      objs.push({ x, w: lane.len });
    }
    return objs;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;

      if (st.running) {
        st.t += 1;
        const lane = st.lanes[st.fy];

        // River: must be on a log, else drown. Move with the log.
        if (lane && lane.type === "river") {
          const objs = laneObjects(lane, st.t);
          let onLog = false;
          const frogX = st.fx + st.fOffset / CELL;
          for (const o of objs) {
            const ox = ((o.x % COLS) + COLS) % COLS;
            // check wrap-around coverage
            for (const base of [ox - COLS, ox, ox + COLS]) {
              if (frogX + 0.5 > base && frogX + 0.5 < base + o.w) { onLog = true; break; }
            }
            if (onLog) break;
          }
          if (onLog) {
            st.fOffset += lane.speed * lane.dir;
            // Push off screen = drown
            const px = st.fx * CELL + st.fOffset;
            if (px < -CELL / 2 || px > WIDTH - CELL / 2) loseLife(st);
          } else {
            loseLife(st);
          }
        }

        // Road: cars hit you
        if (lane && lane.type === "road") {
          const objs = laneObjects(lane, st.t);
          const frogX = st.fx;
          for (const o of objs) {
            const ox = ((o.x % COLS) + COLS) % COLS;
            for (const base of [ox - COLS, ox, ox + COLS]) {
              if (frogX + 0.5 > base - 0.3 && frogX + 0.5 < base + o.w + 0.3) { loseLife(st); break; }
            }
          }
        }

        if (st.t - st.lastSync > 5) { st.lastSync = st.t; }
      }

      // ===== DRAW =====
      // Background lanes
      for (let r = 0; r < ROWS; r++) {
        const lane = st.lanes[r];
        let col = "#1a0e0a";
        if (lane) {
          if (lane.type === "home") col = "#0a2a0a";
          else if (lane.type === "river") col = "#0a2848";
          else if (lane.type === "road") col = "#1a1a1a";
          else if (lane.type === "safe") col = "#3a2a18";
        }
        ctx.fillStyle = col;
        ctx.fillRect(0, r * CELL, WIDTH, CELL);
      }

      // Home slots (row 0)
      for (let i = 0; i < 3; i++) {
        const hx = (3 + i * 3.5) * CELL;
        ctx.fillStyle = st.filledHomes[i] ? "#7fd650" : "#0f3a0f";
        ctx.fillRect(hx, 2, CELL, CELL - 4);
        if (st.filledHomes[i]) { ctx.font = "22px serif"; ctx.textAlign = "center"; ctx.fillText("🐸", hx + CELL / 2, CELL - 8); ctx.textAlign = "start"; }
      }

      // Logs & cars
      for (let r = 0; r < ROWS; r++) {
        const lane = st.lanes[r];
        if (!lane || (lane.type !== "river" && lane.type !== "road")) continue;
        const objs = laneObjects(lane, st.t);
        for (const o of objs) {
          const ox = (((o.x % COLS) + COLS) % COLS);
          for (const base of [ox - COLS, ox, ox + COLS]) {
            const px = base * CELL;
            if (px > WIDTH || px + o.w * CELL < 0) continue;
            if (lane.type === "river") {
              ctx.fillStyle = "#6a4a28";
              ctx.fillRect(px + 2, r * CELL + 6, o.w * CELL - 4, CELL - 12);
              ctx.fillStyle = "#7a5a34";
              ctx.fillRect(px + 2, r * CELL + 6, o.w * CELL - 4, 4);
            } else {
              ctx.fillStyle = lane.dir > 0 ? "#d63d3d" : "#5fc8e0";
              ctx.fillRect(px + 4, r * CELL + 6, o.w * CELL - 8, CELL - 12);
              ctx.fillStyle = "#1a0e0a";
              ctx.fillRect(px + 6, r * CELL + 9, 4, 4);
              ctx.fillRect(px + o.w * CELL - 12, r * CELL + 9, 4, 4);
            }
          }
        }
      }

      // Frog
      if (st.running) {
        const fpx = st.fx * CELL + st.fOffset;
        const fpy = st.fy * CELL;
        ctx.font = "26px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🐸", fpx + CELL / 2, fpy + CELL / 2);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loseLife = (st: typeof s.current) => {
    st.lives -= 1;
    setLives(st.lives);
    if (st.lives <= 0) {
      st.running = false;
      setScore(st.score);
      if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("frogger-highscore", String(st.score)); }
      setGameOver(true);
    } else {
      respawn(st);
    }
  };

  const reachHome = (st: typeof s.current) => {
    // Find nearest empty home slot
    const slot = Math.round((st.fx - 3) / 3.5);
    if (slot >= 0 && slot < 3 && !st.filledHomes[slot]) {
      st.filledHomes[slot] = true;
      st.score += 100;
      setScore(st.score);
      setHomes(st.filledHomes.filter(Boolean).length);
      if (st.filledHomes.every(Boolean)) {
        // Next level
        st.level += 1;
        setLevel(st.level);
        st.filledHomes = [false, false, false];
        setHomes(0);
        st.lanes = buildLanes(st.level);
        st.score += 500;
        setScore(st.score);
      }
      respawn(st);
    } else {
      loseLife(st);
    }
  };

  const moveFrog = (dx: number, dy: number) => {
    const st = s.current;
    if (!st.running) return;
    // Snap offset into grid when leaving a log
    if (st.fOffset !== 0) { st.fx = Math.round(st.fx + st.fOffset / CELL); st.fOffset = 0; }
    const nx = st.fx + dx;
    const ny = st.fy + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
    st.fx = nx; st.fy = ny;
    if (dy < 0) { st.score += 10; setScore(st.score); }
    // Reached top row
    if (st.fy === 0) reachHome(st);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || gameOver) {
        if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); reset(); }
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); moveFrog(0, -1); }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); moveFrog(0, 1); }
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); moveFrog(-1, 0); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); moveFrog(1, 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[468px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--foreground)]">{level}</span></span>
        <span><span className="text-[var(--muted)]">🏠 </span><span className="text-[#7fd650]">{homes}/3</span></span>
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#7fd650]">{"🐸".repeat(Math.max(0, lives))}</span></span>
      </div>
      <div className="relative w-full max-w-[468px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">{gameOver ? "GAME OVER" : "FROGGER"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "TRY AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">Arrow keys / WASD to hop<br/><span className="text-xs">Cross the road & river, ride the logs, fill all 3 homes</span></p>
          </div>
        )}
      </div>
      <div className="sm:hidden grid grid-cols-3 gap-2 mt-2">
        <div /><button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => moveFrog(0, -1)}>▲</button><div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => moveFrog(-1, 0)}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => moveFrog(0, 1)}>▼</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => moveFrog(1, 0)}>▶</button>
      </div>
    </div>
  );
}
