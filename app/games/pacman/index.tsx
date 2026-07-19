"use client";

import { useEffect, useRef, useState } from "react";

// Maze: # wall, . pellet, o power pellet, space empty, G ghost spawn, P player spawn
const MAZE = [
  "###################",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.### # ###.####",
  "   #.#   G   #.#   ",
  "####.# ##=## #.####",
  "    .  #GGG#  .    ",
  "####.# ##### #.####",
  "   #.#       #.#   ",
  "####.# ##### #.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################",
];

const COLS = MAZE[0].length; // 19
const ROWS = MAZE.length;    // 21
const TILE = 22;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;

type Cell = { wall: boolean; pellet: boolean; power: boolean };
type Ghost = { x: number; y: number; dx: number; dy: number; color: string; scared: boolean; homeX: number; homeY: number };

export default function Pacman() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    grid: [] as Cell[][],
    px: 0, py: 0,          // player tile-float position
    dir: { x: 0, y: 0 },
    nextDir: { x: 0, y: 0 },
    ghosts: [] as Ghost[],
    pelletsLeft: 0,
    scaredUntil: 0,
    running: false,
    score: 0,
    lives: 3,
    moveTimer: 0,
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("pacman-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const buildLevel = () => {
    const st = s.current;
    const grid: Cell[][] = [];
    let pellets = 0;
    let px = 9, py = 15;
    const ghosts: Ghost[] = [];
    const ghostColors = ["#ff5050", "#ffb8de", "#5fc8e0", "#ff8a3d"];
    let gi = 0;
    for (let y = 0; y < ROWS; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < COLS; x++) {
        const ch = MAZE[y][x];
        const cell: Cell = { wall: ch === "#" || ch === "=", pellet: ch === ".", power: ch === "o" };
        if (ch === ".") pellets++;
        if (ch === "o") pellets++;
        if (ch === "P") { px = x; py = y; }
        if (ch === "G") {
          ghosts.push({
            x, y, dx: 0, dy: -1,
            color: ghostColors[gi % ghostColors.length],
            scared: false, homeX: x, homeY: y,
          });
          gi++;
        }
        row.push(cell);
      }
      grid.push(row);
    }
    st.grid = grid;
    st.px = px; st.py = py;
    st.ghosts = ghosts;
    st.pelletsLeft = pellets;
  };

  const reset = () => {
    const st = s.current;
    buildLevel();
    st.dir = { x: 0, y: 0 };
    st.nextDir = { x: 0, y: 0 };
    st.scaredUntil = 0;
    st.running = true;
    st.score = 0;
    st.lives = 3;
    setScore(0);
    setLives(3);
    setGameOver(false);
    setWon(false);
    setStarted(true);
  };

  const respawn = () => {
    const st = s.current;
    // Reset positions but keep pellets/score
    let px = 9, py = 15;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAZE[y][x] === "P") { px = x; py = y; }
    st.px = px; st.py = py;
    st.dir = { x: 0, y: 0 };
    st.nextDir = { x: 0, y: 0 };
    let gi = 0;
    for (const g of st.ghosts) { g.x = g.homeX; g.y = g.homeY; g.dx = 0; g.dy = -1; g.scared = false; gi++; }
    st.scaredUntil = 0;
  };

  const isWall = (x: number, y: number) => {
    if (y < 0 || y >= ROWS) return true;
    // Horizontal tunnel wrap
    if (x < 0 || x >= COLS) return false;
    return s.current.grid[y][x].wall;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;

    const loop = () => {
      frame++;
      const st = s.current;
      const now = Date.now();

      if (st.running) {
        st.moveTimer++;
        // Player moves every 8 frames (tile-step)
        if (st.moveTimer % 8 === 0) {
          // Try to apply nextDir
          const ntx = Math.round(st.px) + st.nextDir.x;
          const nty = Math.round(st.py) + st.nextDir.y;
          if ((st.nextDir.x !== 0 || st.nextDir.y !== 0) && !isWall(ntx, nty)) {
            st.dir = { ...st.nextDir };
          }
          let nx = Math.round(st.px) + st.dir.x;
          const ny = Math.round(st.py) + st.dir.y;
          // tunnel wrap
          if (nx < 0) nx = COLS - 1;
          if (nx >= COLS) nx = 0;
          if (!isWall(nx, ny)) {
            st.px = nx; st.py = ny;
            // Eat pellet
            const cell = st.grid[ny]?.[nx];
            if (cell) {
              if (cell.pellet) { cell.pellet = false; st.score += 10; st.pelletsLeft--; }
              if (cell.power) {
                cell.power = false; st.score += 50; st.pelletsLeft--;
                st.scaredUntil = now + 6000;
                for (const g of st.ghosts) g.scared = true;
              }
            }
          }
          // Win check
          if (st.pelletsLeft <= 0) {
            st.running = false;
            winGame(st);
          }
        }

        // Ghost movement (every 9 frames - slightly slower)
        if (st.moveTimer % 9 === 0) {
          const scared = st.scaredUntil > now;
          if (!scared) for (const g of st.ghosts) g.scared = false;
          for (const g of st.ghosts) {
            // At a tile center, pick a direction
            const options: { x: number; y: number }[] = [];
            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
            for (const d of dirs) {
              // Don't reverse unless necessary
              if (d.x === -g.dx && d.y === -g.dy) continue;
              let tx = g.x + d.x;
              const ty = g.y + d.y;
              if (tx < 0) tx = COLS - 1;
              if (tx >= COLS) tx = 0;
              if (!isWall(tx, ty)) options.push(d);
            }
            let choice;
            if (options.length === 0) {
              choice = { x: -g.dx, y: -g.dy }; // reverse
            } else {
              // Chase player (or flee if scared) — greedy
              let best = options[0];
              let bestScore = g.scared ? -Infinity : Infinity;
              for (const o of options) {
                const tx = g.x + o.x, ty = g.y + o.y;
                const dist = Math.abs(tx - st.px) + Math.abs(ty - st.py);
                if (g.scared) {
                  if (dist > bestScore) { bestScore = dist; best = o; }
                } else {
                  if (dist < bestScore) { bestScore = dist; best = o; }
                }
              }
              // Add some randomness
              choice = Math.random() < 0.2 ? options[Math.floor(Math.random() * options.length)] : best;
            }
            g.dx = choice.x; g.dy = choice.y;
            let nx = g.x + g.dx;
            const ny = g.y + g.dy;
            if (nx < 0) nx = COLS - 1;
            if (nx >= COLS) nx = 0;
            if (!isWall(nx, ny)) { g.x = nx; g.y = ny; }
          }
        }

        // Ghost collision
        for (const g of st.ghosts) {
          if (Math.abs(g.x - st.px) < 0.6 && Math.abs(g.y - st.py) < 0.6) {
            if (g.scared) {
              st.score += 200;
              g.x = g.homeX; g.y = g.homeY; g.scared = false;
            } else {
              st.lives -= 1;
              setLives(st.lives);
              if (st.lives <= 0) { die(st); }
              else respawn();
              break;
            }
          }
        }

        if (frame - st.lastSync >= 5) { st.lastSync = frame; setScore(st.score); }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#05050a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const cell = st.grid[y]?.[x];
          if (!cell) continue;
          const cx = x * TILE, cy = y * TILE;
          if (cell.wall) {
            ctx.fillStyle = "#1a2a6a";
            ctx.fillRect(cx + 2, cy + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = "#3a4ab0";
            ctx.fillRect(cx + 4, cy + 4, TILE - 8, TILE - 8);
          } else if (cell.pellet) {
            ctx.fillStyle = "#ffd060";
            ctx.fillRect(cx + TILE / 2 - 1.5, cy + TILE / 2 - 1.5, 3, 3);
          } else if (cell.power) {
            const pulse = Math.sin(frame * 0.15) * 1.5 + 4;
            ctx.fillStyle = "#ff8a3d";
            ctx.beginPath();
            ctx.arc(cx + TILE / 2, cy + TILE / 2, pulse, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Player (pacman)
      const scared = st.scaredUntil > now;
      const pcx = st.px * TILE + TILE / 2;
      const pcy = st.py * TILE + TILE / 2;
      const mouthOpen = (Math.sin(frame * 0.3) * 0.5 + 0.5) * 0.35;
      let ang = 0;
      if (st.dir.x === 1) ang = 0;
      else if (st.dir.x === -1) ang = Math.PI;
      else if (st.dir.y === 1) ang = Math.PI / 2;
      else if (st.dir.y === -1) ang = -Math.PI / 2;
      ctx.fillStyle = "#ffd83d";
      ctx.beginPath();
      ctx.moveTo(pcx, pcy);
      ctx.arc(pcx, pcy, TILE / 2 - 2, ang + mouthOpen * Math.PI, ang + (2 - mouthOpen) * Math.PI);
      ctx.closePath();
      ctx.fill();

      // Ghosts
      for (const g of st.ghosts) {
        const gx = g.x * TILE + TILE / 2;
        const gy = g.y * TILE + TILE / 2;
        const r = TILE / 2 - 2;
        ctx.fillStyle = (scared && g.scared) ? (Math.floor(frame / 10) % 2 === 0 ? "#3a4ab0" : "#fff") : g.color;
        ctx.beginPath();
        ctx.arc(gx, gy - 1, r, Math.PI, 0);
        ctx.lineTo(gx + r, gy + r);
        ctx.lineTo(gx + r * 0.5, gy + r * 0.6);
        ctx.lineTo(gx, gy + r);
        ctx.lineTo(gx - r * 0.5, gy + r * 0.6);
        ctx.lineTo(gx - r, gy + r);
        ctx.closePath();
        ctx.fill();
        // Eyes
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 2, 2.5, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0a2a";
        ctx.beginPath();
        ctx.arc(gx - 3 + g.dx * 1.2, gy - 2 + g.dy * 1.2, 1.2, 0, Math.PI * 2);
        ctx.arc(gx + 3 + g.dx * 1.2, gy - 2 + g.dy * 1.2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalize = (st: typeof s.current) => {
    const finalScore = st.score;
    setScore(finalScore);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem("pacman-highscore", String(finalScore));
    }
  };
  const die = (st: typeof s.current) => { st.running = false; finalize(st); setGameOver(true); };
  const winGame = (st: typeof s.current) => { finalize(st); setWon(true); setGameOver(true); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, { x: number; y: number }> = {
        arrowup: { x: 0, y: -1 }, arrowdown: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 }, arrowright: { x: 1, y: 0 },
        w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      };
      if (k in map) {
        e.preventDefault();
        s.current.nextDir = map[k];
      } else if (k === " " || k === "enter") {
        if (!started || gameOver) reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  const setDir = (x: number, y: number) => { s.current.nextDir = { x, y }; };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[420px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{String(score).padStart(4, "0")}</span></span>
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#ffd83d]">{"● ".repeat(Math.max(0, lives))}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[420px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-3 text-center">
              {gameOver ? (won ? "YOU WIN!" : "GAME OVER") : "PAC-MAN"}
            </h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-2 px-5 py-2 rounded bg-[#ffd83d] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {gameOver ? "PLAY AGAIN" : "START"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">Arrow keys or WASD<br/><span className="text-xs">Eat power pellets to hunt ghosts!</span></p>
          </div>
        )}
      </div>

      <div className="sm:hidden grid grid-cols-3 gap-2 mt-2">
        <div /><button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => setDir(0, -1)}>▲</button><div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => setDir(-1, 0)}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => setDir(0, 1)}>▼</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => setDir(1, 0)}>▶</button>
      </div>
    </div>
  );
}
