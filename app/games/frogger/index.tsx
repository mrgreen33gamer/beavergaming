"use client";

import { useEffect, useRef, useState } from "react";

const COLS = 13;
const ROWS = 13;
const CELL = 36;
const WIDTH = COLS * CELL;   // 468
const HEIGHT = ROWS * CELL;  // 468

// Row layout (top to bottom):
//  0       : home slots (5 pockets in a hedge)
//  1..5    : river — even rows have logs, odd rows have turtles (turtles dive!)
//  6       : safe median
//  7..11   : road
//  12      : start (safe)

type LaneType = "home" | "river-log" | "river-turtle" | "safe" | "road";

type Lane = {
  row: number;
  type: LaneType;
  dir: number;          // +1 right, -1 left, 0 static
  speed: number;        // pixels per frame
  vehicleLen: number;   // in cells
  gap: number;          // in cells, between vehicles
  offset: number;       // scrolling offset in pixels (accumulator)
  color: string;        // car color (road) or accent
  turtleSubmerge?: number; // turtle cycle offset
};

function buildLanes(level: number): Lane[] {
  const lanes: Lane[] = [];

  // Row 0: home
  lanes.push({ row: 0, type: "home", dir: 0, speed: 0, vehicleLen: 0, gap: 0, offset: 0, color: "" });

  // River rows 1-5
  // Pattern: row 1 = logs, 2 = turtles, 3 = long logs, 4 = turtles, 5 = logs
  const riverPattern: { type: LaneType; len: number; gap: number }[] = [
    { type: "river-log",    len: 3, gap: 4 },
    { type: "river-turtle", len: 2, gap: 3 }, // 2-cell turtle pair
    { type: "river-log",    len: 4, gap: 5 },
    { type: "river-turtle", len: 3, gap: 3 }, // 3-cell turtle trio
    { type: "river-log",    len: 2, gap: 3 },
  ];
  for (let i = 0; i < 5; i++) {
    const cfg = riverPattern[i];
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = (0.6 + Math.random() * 0.4) + (level - 1) * 0.12;
    lanes.push({
      row: 1 + i,
      type: cfg.type,
      dir,
      speed,
      vehicleLen: cfg.len,
      gap: cfg.gap,
      offset: Math.random() * WIDTH,
      color: cfg.type === "river-log" ? "#6a4a28" : "#3d8a5a",
      turtleSubmerge: Math.random() * Math.PI * 2,
    });
  }

  // Row 6: median
  lanes.push({ row: 6, type: "safe", dir: 0, speed: 0, vehicleLen: 0, gap: 0, offset: 0, color: "" });

  // Road rows 7-11
  // Row 9 is the "truck" row (longer vehicles); others are cars
  const roadColors = ["#d63d3d", "#5fc8e0", "#ffd060", "#c45ed6", "#ff8a3d"];
  for (let i = 0; i < 5; i++) {
    const row = 7 + i;
    const isTruck = i === 2; // middle road row
    const dir = i % 2 === 0 ? -1 : 1;
    const speed = (0.8 + Math.random() * 0.5) + (level - 1) * 0.15;
    lanes.push({
      row,
      type: "road",
      dir,
      speed,
      vehicleLen: isTruck ? 2 : 1,
      gap: 3 + Math.floor(Math.random() * 3),
      offset: Math.random() * WIDTH,
      color: roadColors[i],
    });
  }

  // Row 12: start
  lanes.push({ row: 12, type: "safe", dir: 0, speed: 0, vehicleLen: 0, gap: 0, offset: 0, color: "" });

  return lanes;
}

// Generate the on-screen vehicles for a lane, in pixel coordinates.
// Uses lane.offset which monotonically increases/decreases.
function laneVehicles(lane: Lane): { x: number; w: number }[] {
  if (lane.speed === 0 || lane.vehicleLen === 0) return [];
  const period = (lane.vehicleLen + lane.gap) * CELL;
  const w = lane.vehicleLen * CELL;
  const out: { x: number; w: number }[] = [];
  // We want to cover [-w, WIDTH+w] worth of positions
  const startI = Math.floor((-w - lane.offset) / period);
  const endI = Math.ceil((WIDTH + w - lane.offset) / period);
  for (let i = startI; i <= endI; i++) {
    const x = i * period + lane.offset;
    out.push({ x, w });
  }
  return out;
}

const HOME_SLOTS = 5; // classic Frogger has 5

// Five hedge pockets across the top row, evenly spaced.
function homeSlotCenterX(idx: number): number {
  // Pockets centered in 5 evenly spaced groups
  return ((idx + 0.5) * WIDTH) / HOME_SLOTS;
}

export default function Frogger() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [homes, setHomes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(40);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    fx: WIDTH / 2,            // frog pixel center x
    fy: 12,                   // grid row 0..12
    fHopTimer: 0,             // animates the hop (0..6 frames)
    fDir: 0 as 0 | 1 | 2 | 3, // 0=up,1=right,2=down,3=left
    lanes: [] as Lane[],
    filledHomes: [] as boolean[],
    running: false,
    score: 0,
    lives: 3,
    level: 1,
    t: 0,
    timer: 40 * 60, // seconds * 60fps
    invincible: 0,
    splash: [] as { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }[],
  });

  useEffect(() => {
    const saved = localStorage.getItem("frogger-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const startGame = () => {
    const st = s.current;
    st.fx = WIDTH / 2; st.fy = 12; st.fDir = 0; st.fHopTimer = 0;
    st.lanes = buildLanes(1);
    st.filledHomes = new Array(HOME_SLOTS).fill(false);
    st.running = true;
    st.score = 0; st.lives = 3; st.level = 1;
    st.t = 0; st.timer = 40 * 60;
    st.invincible = 0;
    st.splash.length = 0;
    setScore(0); setLives(3); setLevel(1); setHomes(0); setTimeLeft(40);
    setGameOver(false); setStarted(true);
  };

  const respawn = (st: typeof s.current) => {
    st.fx = WIDTH / 2; st.fy = 12; st.fDir = 0; st.fHopTimer = 0;
    st.timer = 40 * 60; setTimeLeft(40);
    st.invincible = 45; // ~0.75s
  };

  const loseLife = (st: typeof s.current, color: string) => {
    if (st.invincible > 0) return;
    st.lives -= 1;
    setLives(st.lives);
    // splash particles
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      st.splash.push({ x: st.fx, y: st.fy * CELL + CELL / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 28, max: 28, color });
    }
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
    // Find nearest home slot center to frog x
    let bestIdx = -1, bestD = Infinity;
    for (let i = 0; i < HOME_SLOTS; i++) {
      const cx = homeSlotCenterX(i);
      const d = Math.abs(cx - st.fx);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    // Slot must be within half a cell width, and not already filled
    if (bestIdx >= 0 && bestD < CELL * 0.7 && !st.filledHomes[bestIdx]) {
      st.filledHomes[bestIdx] = true;
      const timeBonus = Math.floor(st.timer / 60) * 10;
      st.score += 100 + timeBonus;
      setScore(st.score);
      setHomes(st.filledHomes.filter(Boolean).length);
      if (st.filledHomes.every(Boolean)) {
        // Next level
        st.level += 1;
        setLevel(st.level);
        st.filledHomes = new Array(HOME_SLOTS).fill(false);
        setHomes(0);
        st.lanes = buildLanes(st.level);
        st.score += 1000;
        setScore(st.score);
      }
      respawn(st);
    } else {
      // Missed slot or already filled — drown
      loseLife(st, "#5fc8e0");
    }
  };

  const moveFrog = (dx: number, dy: number) => {
    const st = s.current;
    if (!st.running) return;
    if (st.fHopTimer > 0) return; // mid-hop, ignore
    const newFy = st.fy + dy;
    if (newFy < 0 || newFy >= ROWS) return;
    // Round current x to nearest cell before moving (snap off log)
    const col = Math.round((st.fx - CELL / 2) / CELL);
    let newCol = col + dx;
    if (newCol < 0 || newCol >= COLS) {
      // sideways out of bounds — block
      if (dy === 0) return;
      newCol = Math.max(0, Math.min(COLS - 1, newCol));
    }
    st.fx = newCol * CELL + CELL / 2;
    st.fy = newFy;
    st.fHopTimer = 6;
    st.fDir = dy < 0 ? 0 : dy > 0 ? 2 : dx > 0 ? 1 : 3;
    if (dy < 0) { st.score += 10; setScore(st.score); }
    if (st.fy === 0) reachHome(st);
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

        // Tick game timer
        st.timer -= 1;
        if (st.timer % 60 === 0) setTimeLeft(Math.max(0, Math.floor(st.timer / 60)));
        if (st.timer <= 0) {
          loseLife(st, "#ffd060");
        }

        if (st.invincible > 0) st.invincible -= 1;

        // Move lanes
        for (const lane of st.lanes) {
          if (lane.speed === 0) continue;
          lane.offset += lane.speed * lane.dir;
        }

        // Animate hop
        if (st.fHopTimer > 0) st.fHopTimer -= 1;

        // Lane interactions (only when not invincible)
        const lane = st.lanes[st.fy];
        if (lane && (lane.type === "river-log" || lane.type === "river-turtle")) {
          const vehicles = laneVehicles(lane);
          let onSurface = false;
          for (const v of vehicles) {
            if (st.fx > v.x && st.fx < v.x + v.w) {
              // For turtles, check if currently submerged
              if (lane.type === "river-turtle") {
                // Submerge cycle matches drawing
                const phase = Math.sin(st.t * 0.03 + (lane.turtleSubmerge ?? 0) + v.x * 0.005);
                if (phase < -0.55) {
                  // submerged — frog drowns
                  break;
                }
              }
              onSurface = true;
              // Carry the frog
              st.fx += lane.speed * lane.dir;
              break;
            }
          }
          if (!onSurface) {
            loseLife(st, "#5fc8e0");
          } else if (st.fx < 0 || st.fx > WIDTH) {
            // Pushed off screen
            loseLife(st, "#5fc8e0");
          }
        } else if (lane && lane.type === "road") {
          const vehicles = laneVehicles(lane);
          const frogHalf = CELL * 0.35;
          for (const v of vehicles) {
            if (st.fx + frogHalf > v.x + 4 && st.fx - frogHalf < v.x + v.w - 4) {
              loseLife(st, "#d63d3d");
              break;
            }
          }
        }
      }

      // ===== DRAW =====
      // Background lanes
      for (let r = 0; r < ROWS; r++) {
        const lane = st.lanes[r];
        let col = "#1a0e0a";
        if (lane) {
          if (lane.type === "home") col = "#0a3a0a";
          else if (lane.type === "river-log" || lane.type === "river-turtle") col = "#0a2848";
          else if (lane.type === "road") col = "#1a1a1a";
          else if (lane.type === "safe") col = "#3a2a18";
        }
        ctx.fillStyle = col;
        ctx.fillRect(0, r * CELL, WIDTH, CELL);
      }

      // Road lane dividers
      for (let r = 7; r <= 10; r++) {
        ctx.fillStyle = "#3a2a18";
        for (let x = 0; x < WIDTH; x += 16) {
          ctx.fillRect(x, (r + 1) * CELL - 1, 10, 2);
        }
      }

      // Home hedge across the top + slots
      const homeY = 0;
      ctx.fillStyle = "#0a4a10";
      ctx.fillRect(0, homeY, WIDTH, CELL);
      for (let i = 0; i < HOME_SLOTS; i++) {
        const cx = homeSlotCenterX(i);
        // Slot pocket
        if (st.filledHomes[i]) {
          ctx.fillStyle = "#0a2a0a";
          ctx.fillRect(cx - CELL / 2 + 2, homeY + 2, CELL - 4, CELL - 4);
          ctx.font = "26px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🐸", cx, homeY + CELL / 2);
          ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        } else {
          // empty pocket (a darker rectangle in the hedge)
          ctx.fillStyle = "#062406";
          ctx.fillRect(cx - CELL / 2 + 4, homeY + 4, CELL - 8, CELL - 8);
          // little arrow lure
          ctx.fillStyle = "#7fd650";
          ctx.fillRect(cx - 2, homeY + CELL - 10, 4, 6);
        }
      }
      // Hedge top trim
      ctx.fillStyle = "#0f6b18";
      for (let x = 0; x < WIDTH; x += 4) {
        if (Math.floor(x / 4) % 2 === 0) ctx.fillRect(x, homeY, 4, 3);
      }

      // Logs & turtles & cars
      for (const lane of st.lanes) {
        if (lane.speed === 0) continue;
        const y = lane.row * CELL;
        const vehicles = laneVehicles(lane);
        for (const v of vehicles) {
          if (lane.type === "river-log") {
            // Log body
            ctx.fillStyle = "#3a2515";
            ctx.fillRect(v.x, y + 6, v.w, CELL - 12);
            ctx.fillStyle = "#5a3a20";
            ctx.fillRect(v.x, y + 6, v.w, 5);
            ctx.fillStyle = "#7a5a34";
            ctx.fillRect(v.x, y + 6, v.w, 2);
            // End caps
            ctx.fillStyle = "#2a1810";
            ctx.fillRect(v.x, y + 6, 3, CELL - 12);
            ctx.fillRect(v.x + v.w - 3, y + 6, 3, CELL - 12);
            // bark lines
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            for (let bx = 8; bx < v.w - 4; bx += 10) {
              ctx.fillRect(v.x + bx, y + 10, 2, CELL - 20);
            }
          } else if (lane.type === "river-turtle") {
            // Draw `vehicleLen` turtles spanning the vehicle width. One submerge phase per vehicle.
            const phase = Math.sin(st.t * 0.03 + (lane.turtleSubmerge ?? 0) + v.x * 0.005);
            const count = lane.vehicleLen;
            for (let t = 0; t < count; t++) {
              const tx = v.x + (t + 0.5) * CELL;
              if (phase < -0.55) {
                // submerged — just ripples
                ctx.strokeStyle = "rgba(255,255,255,0.25)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(tx, y + CELL / 2, 8, 0, Math.PI * 2);
                ctx.stroke();
              } else if (phase < -0.2) {
                ctx.fillStyle = "#2a5a3d";
                ctx.beginPath();
                ctx.arc(tx, y + CELL / 2 + 2, 10, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.fillStyle = "#4a8a5a";
                ctx.beginPath();
                ctx.arc(tx, y + CELL / 2, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#3d6b48";
                for (let p = 0; p < 6; p++) {
                  const a = (p / 6) * Math.PI * 2;
                  ctx.beginPath();
                  ctx.arc(tx + Math.cos(a) * 6, y + CELL / 2 + Math.sin(a) * 6, 3, 0, Math.PI * 2);
                  ctx.fill();
                }
                ctx.fillStyle = "#4a8a5a";
                const hd = lane.dir > 0 ? 1 : -1;
                ctx.beginPath();
                ctx.arc(tx + hd * 11, y + CELL / 2, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          } else if (lane.type === "road") {
            // Car body
            const isTruck = lane.vehicleLen > 1;
            const inset = 5;
            ctx.fillStyle = lane.color;
            ctx.fillRect(v.x + 3, y + inset, v.w - 6, CELL - inset * 2);
            // Windshield/window
            ctx.fillStyle = "#1a0e0a";
            if (isTruck) {
              // truck: cab at front (in direction of travel)
              if (lane.dir > 0) {
                ctx.fillRect(v.x + v.w - 22, y + inset + 3, 14, CELL - inset * 2 - 6);
                ctx.fillStyle = "#5fc8e0"; ctx.fillRect(v.x + v.w - 19, y + inset + 6, 8, 4);
              } else {
                ctx.fillRect(v.x + 8, y + inset + 3, 14, CELL - inset * 2 - 6);
                ctx.fillStyle = "#5fc8e0"; ctx.fillRect(v.x + 11, y + inset + 6, 8, 4);
              }
            } else {
              ctx.fillRect(v.x + 8, y + inset + 4, v.w - 16, CELL - inset * 2 - 8);
              ctx.fillStyle = "#5fc8e0";
              ctx.fillRect(v.x + 10, y + inset + 6, v.w - 20, 4);
            }
            // Wheels
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(v.x + 5, y + inset - 2, 6, 3);
            ctx.fillRect(v.x + v.w - 11, y + inset - 2, 6, 3);
            ctx.fillRect(v.x + 5, y + CELL - inset - 1, 6, 3);
            ctx.fillRect(v.x + v.w - 11, y + CELL - inset - 1, 6, 3);
          }
        }
      }

      // Splash particles
      let w = 0;
      for (let i = 0; i < st.splash.length; i++) {
        const p = st.splash[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
        if (p.life > 0) { if (w !== i) st.splash[w] = p; w++; }
      }
      st.splash.length = w;
      for (const p of st.splash) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 3, 3);
      }
      ctx.globalAlpha = 1;

      // Frog
      if (st.running) {
        const blink = st.invincible > 0 && Math.floor(st.invincible / 4) % 2 === 0;
        if (!blink) {
          // Hop bounce (vertical squish)
          const hop = st.fHopTimer > 0 ? Math.sin((6 - st.fHopTimer) / 6 * Math.PI) * 6 : 0;
          const fpy = st.fy * CELL + CELL / 2 - hop;
          drawFrog(ctx, st.fx, fpy, st.fDir);
        }
      }

      // Timer bar at bottom of playfield
      const tFrac = Math.max(0, st.timer / (40 * 60));
      ctx.fillStyle = "#1a0e0a"; ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);
      ctx.fillStyle = tFrac > 0.3 ? "#7fd650" : "#d63d3d";
      ctx.fillRect(0, HEIGHT - 4, WIDTH * tFrac, 4);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || gameOver) {
        if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); startGame(); }
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); moveFrog(0, -1); }
      else if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); moveFrog(0, 1); }
      else if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); moveFrog(-1, 0); }
      else if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); moveFrog(1, 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[468px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--foreground)]">{level}</span></span>
        <span><span className="text-[var(--muted)]">🏠 </span><span className="text-[#7fd650]">{homes}/{HOME_SLOTS}</span></span>
        <span><span className="text-[var(--muted)]">⏱ </span><span className={timeLeft < 12 ? "text-[#d63d3d]" : "text-[var(--foreground)]"}>{timeLeft}</span></span>
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#7fd650]">{"🐸".repeat(Math.max(0, lives))}</span></span>
      </div>
      <div className="relative w-full max-w-[468px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">{gameOver ? "GAME OVER" : "FROGGER"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={startGame} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "TRY AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">Arrow keys / WASD to hop<br/><span className="text-sm">Cross the road, ride logs &amp; turtles, fill all {HOME_SLOTS} home pockets</span><br/><span className="text-sm text-[#ff8a3d]">Watch out: turtles dive!</span></p>
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

function drawFrog(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: 0 | 1 | 2 | 3) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir * Math.PI) / 2);
  // body
  ctx.fillStyle = "#3d8a3d";
  ctx.fillRect(-9, -8, 18, 14);
  ctx.fillStyle = "#5fb050";
  ctx.fillRect(-9, -8, 18, 4);
  // legs (sides)
  ctx.fillStyle = "#2d6a2d";
  ctx.fillRect(-12, -4, 4, 8);
  ctx.fillRect(8, -4, 4, 8);
  // back legs (rear corners)
  ctx.fillRect(-11, 4, 6, 4);
  ctx.fillRect(5, 4, 6, 4);
  // eyes (look forward = up after rotate)
  ctx.fillStyle = "#fff";
  ctx.fillRect(-6, -10, 4, 4);
  ctx.fillRect(2, -10, 4, 4);
  ctx.fillStyle = "#000";
  ctx.fillRect(-5, -9, 2, 2);
  ctx.fillRect(3, -9, 2, 2);
  ctx.restore();
}
