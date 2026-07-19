"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const COLS = 60;
const ROWS = 44;
const CELL = 10;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

type Dir = { x: number; y: number };
const UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 }, LEFT = { x: -1, y: 0 }, RIGHT = { x: 1, y: 0 };

type Bike = { x: number; y: number; dir: Dir; trail: { x: number; y: number }[]; alive: boolean; color: string; trailColor: string };

export default function Tron() {
  // Ref'd because the round-end handler runs inside the canvas loop, which
  // closes over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("tron");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<"player" | "ai" | "tie" | null>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const s = useRef({
    player: null as Bike | null,
    ai: null as Bike | null,
    running: false,
    tickMs: 65,
    lastTick: 0,
    next: null as Dir | null,
  });

  useEffect(() => {
    const w = localStorage.getItem("tron-wins"); const l = localStorage.getItem("tron-losses");
    if (w) setWins(parseInt(w, 10));
    if (l) setLosses(parseInt(l, 10));
  }, []);

  const newRound = () => {
    const st = s.current;
    st.player = { x: 10, y: ROWS / 2 | 0, dir: RIGHT, trail: [], alive: true, color: "#5fc8e0", trailColor: "#3aa0c0" };
    st.ai = { x: COLS - 11, y: ROWS / 2 | 0, dir: LEFT, trail: [], alive: true, color: "#ff8a3d", trailColor: "#c46020" };
    st.running = true;
    st.next = null;
    st.lastTick = Date.now();
    st.tickMs = Math.max(40, 65 - round * 1.5);
    setWinner(null); setStarted(true); setPaused(false);
  };

  const occupied = (st: typeof s.current, x: number, y: number): boolean => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    for (const p of st.player?.trail ?? []) if (p.x === x && p.y === y) return true;
    for (const p of st.ai?.trail ?? []) if (p.x === x && p.y === y) return true;
    return false;
  };

  const aiThink = (st: typeof s.current) => {
    const ai = st.ai!; const p = st.player!;
    const opts: Dir[] = [];
    for (const d of [UP, DOWN, LEFT, RIGHT]) {
      // Don't reverse
      if (d.x === -ai.dir.x && d.y === -ai.dir.y) continue;
      const nx = ai.x + d.x, ny = ai.y + d.y;
      if (!occupied(st, nx, ny)) opts.push(d);
    }
    if (!opts.length) return; // dead anyway
    // Flood fill estimate of free space for each option
    let best = opts[0], bestSpace = -1;
    for (const d of opts) {
      const nx = ai.x + d.x, ny = ai.y + d.y;
      const space = floodEstimate(st, nx, ny, 80);
      // also slightly prefer moving toward player to be aggressive
      const dist = Math.abs(nx - p.x) + Math.abs(ny - p.y);
      const score = space - dist * 0.05;
      if (score > bestSpace) { bestSpace = score; best = d; }
    }
    if (Math.random() < 0.08 && opts.length > 1) best = opts[Math.floor(Math.random() * opts.length)]; // mild randomness
    ai.dir = best;
  };

  // Quick BFS-bounded flood fill to estimate maneuvering room from a cell.
  const floodEstimate = (st: typeof s.current, sx: number, sy: number, cap: number): number => {
    const seen = new Set<string>();
    const q: [number, number][] = [[sx, sy]];
    let count = 0;
    while (q.length && count < cap) {
      const [x, y] = q.shift()!;
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      if (occupied(st, x, y)) continue;
      seen.add(k); count++;
      q.push([x + 1, y]); q.push([x - 1, y]); q.push([x, y + 1]); q.push([x, y - 1]);
    }
    return count;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const tick = () => {
      const st = s.current;
      if (!st.running) return;
      const p = st.player!, ai = st.ai!;
      if (st.next && !(st.next.x === -p.dir.x && st.next.y === -p.dir.y)) p.dir = st.next;
      st.next = null;
      aiThink(st);
      // Lay trail at current pos
      p.trail.push({ x: p.x, y: p.y });
      ai.trail.push({ x: ai.x, y: ai.y });
      // Move
      const pnx = p.x + p.dir.x, pny = p.y + p.dir.y;
      const anx = ai.x + ai.dir.x, any = ai.y + ai.dir.y;
      const pDead = occupied(st, pnx, pny);
      const aDead = occupied(st, anx, any) || (pnx === anx && pny === any);
      if (!pDead) { p.x = pnx; p.y = pny; }
      if (!aDead) { ai.x = anx; ai.y = any; }
      if (pDead || aDead) {
        st.running = false;
        if (pDead && aDead) { setWinner("tie"); }
        else if (pDead) { setWinner("ai"); const l = losses + 1; setLosses(l); localStorage.setItem("tron-losses", String(l)); }
        else { setWinner("player"); const w = wins + 1; setWins(w); localStorage.setItem("tron-wins", String(w)); setRound((r) => r + 1); hostRef.current.reportEvent("match_won"); }
      }
    };

    const loop = () => {
      const now = Date.now();
      const st = s.current;
      if (st.running && !paused && now - st.lastTick >= st.tickMs) { st.lastTick = now; tick(); }

      // ===== DRAW =====
      ctx.fillStyle = "#04060c"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // grid
      ctx.strokeStyle = "rgba(60,90,140,0.18)"; ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, HEIGHT); ctx.stroke(); }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(WIDTH, y * CELL); ctx.stroke(); }

      // trails
      if (st.player) drawBike(ctx, st.player);
      if (st.ai) drawBike(ctx, st.ai);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wins, losses, paused, round]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || winner) {
        if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); newRound(); }
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); s.current.next = UP; }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); s.current.next = DOWN; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); s.current.next = LEFT; }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); s.current.next = RIGHT; }
      if (e.code === "KeyP" || e.code === "Escape") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, winner]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[#5fc8e0]">YOU </span><span className="text-[var(--crt-green)]">{wins}W</span></span>
        <span><span className="text-[var(--muted)]">ROUND </span><span className="text-[var(--foreground)]">{round + 1}</span></span>
        <span><span className="text-[#ff8a3d]">AI </span><span className="text-[var(--accent)]">{losses}L</span></span>
      </div>

      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || winner) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-lg mb-2"
              style={{ color: winner === "player" ? "#7fd650" : winner === "ai" ? "#ff8a3d" : winner === "tie" ? "#b8a088" : "#5fc8e0" }}>
              {!started ? "TRON" : winner === "player" ? "YOU WIN" : winner === "ai" ? "AI WINS" : "TIE"}
            </h2>
            <button onClick={newRound} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {winner ? "REMATCH" : "RIDE"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">Arrow keys / WASD · P to pause<br />Don&apos;t crash into trails or walls</p>
          </div>
        )}
        {paused && started && !winner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
            <span className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)]">PAUSED</span>
          </div>
        )}
      </div>

      <div className="sm:hidden grid grid-cols-3 gap-2">
        <div /><button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => (s.current.next = UP)}>▲</button><div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => (s.current.next = LEFT)}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => (s.current.next = DOWN)}>▼</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => (s.current.next = RIGHT)}>▶</button>
      </div>
    </div>
  );
}

function drawBike(ctx: CanvasRenderingContext2D, b: Bike) {
  // Trail (with glow underneath)
  ctx.fillStyle = b.trailColor + "33";
  for (const t of b.trail) ctx.fillRect(t.x * CELL - 2, t.y * CELL - 2, CELL + 4, CELL + 4);
  ctx.fillStyle = b.trailColor;
  for (const t of b.trail) ctx.fillRect(t.x * CELL, t.y * CELL, CELL, CELL);
  // Head bike (brighter)
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x * CELL, b.y * CELL, CELL, CELL);
  ctx.fillStyle = "#fff";
  ctx.fillRect(b.x * CELL + 3, b.y * CELL + 3, CELL - 6, CELL - 6);
}
