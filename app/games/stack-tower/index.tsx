"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 380;
const HEIGHT = 560;
const BLOCK_H = 26;
const START_W = 220;
const PERFECT_TOL = 3;     // px tolerance for "perfect" overlap

type Block = { x: number; w: number; y: number; color: string };

const COLORS = ["#ff6b1a", "#ff8a3d", "#ffd060", "#7fd650", "#5fc8e0", "#c45ed6", "#ff5050", "#ffa030"];

export default function StackTower() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [perfectStreak, setPerfectStreak] = useState(0);

  const s = useRef({
    stack: [] as Block[],
    moving: null as null | { x: number; w: number; y: number; vx: number; color: string },
    falling: [] as { x: number; y: number; w: number; vy: number; color: string }[],
    perfectFx: 0,
    cameraY: 0,
    score: 0,
    perfectStreak: 0,
    pulse: 0,
    running: false,
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("stacktower-high");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const start = () => {
    const st = s.current;
    const base: Block = { x: (WIDTH - START_W) / 2, w: START_W, y: HEIGHT - BLOCK_H - 30, color: "#5a3a22" };
    st.stack = [base];
    spawnNew(st);
    st.falling = []; st.cameraY = 0; st.score = 0; st.perfectStreak = 0; st.running = true;
    setScore(0); setPerfectStreak(0); setGameOver(false); setStarted(true);
  };

  const spawnNew = (st: typeof s.current) => {
    const top = st.stack[st.stack.length - 1];
    const fromLeft = Math.random() < 0.5;
    const speed = 2 + Math.min(6, st.stack.length * 0.18);
    st.moving = {
      x: fromLeft ? -top.w : WIDTH,
      w: top.w,
      y: top.y - BLOCK_H - 2,
      vx: fromLeft ? speed : -speed,
      color: COLORS[st.stack.length % COLORS.length],
    };
  };

  const drop = () => {
    const st = s.current;
    if (!st.running || !st.moving) return;
    const top = st.stack[st.stack.length - 1];
    const m = st.moving;
    const overlapLeft = Math.max(top.x, m.x);
    const overlapRight = Math.min(top.x + top.w, m.x + m.w);
    const overlap = Math.max(0, overlapRight - overlapLeft);

    if (overlap <= 0) {
      // Total miss — block falls forever
      st.falling.push({ x: m.x, y: m.y, w: m.w, vy: 0, color: m.color });
      st.moving = null;
      st.running = false;
      st.score = st.stack.length - 1;
      const final = st.score;
      setScore(final);
      if (final > highScore) { setHighScore(final); localStorage.setItem("stacktower-high", String(final)); }
      setTimeout(() => setGameOver(true), 600);
      return;
    }

    const perfect = Math.abs(m.x - top.x) <= PERFECT_TOL && Math.abs(m.w - top.w) <= PERFECT_TOL;
    let newW = overlap;
    let newX = overlapLeft;
    if (perfect) {
      // Perfect: keep full width, grow streak and bonus score
      newW = top.w; newX = top.x;
      st.perfectStreak++;
      st.perfectFx = 1;
      st.pulse = 1;
    } else {
      // Trim overhang — falling piece for the leftover
      st.perfectStreak = 0;
      if (m.x < top.x) {
        // overhang on the left
        const w = top.x - m.x;
        st.falling.push({ x: m.x, y: m.y, w, vy: 0, color: m.color });
      } else if (m.x + m.w > top.x + top.w) {
        // overhang on the right
        const w = (m.x + m.w) - (top.x + top.w);
        st.falling.push({ x: top.x + top.w, y: m.y, w, vy: 0, color: m.color });
      }
    }

    st.stack.push({ x: newX, w: newW, y: m.y, color: m.color });
    st.score = st.stack.length - 1 + Math.min(50, st.perfectStreak * 2); // small streak bonus baked in
    setScore(st.stack.length - 1);
    setPerfectStreak(st.perfectStreak);
    st.moving = null;

    // Camera pans up so the tower stays in view
    if (st.stack.length > 6) {
      st.cameraY += BLOCK_H + 2;
    }

    spawnNew(st);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;
      if (st.running && st.moving) {
        st.moving.x += st.moving.vx;
        // Bounce off "walls" of view (with some leeway)
        const reach = WIDTH * 0.05;
        if (st.moving.x + st.moving.w < -reach) st.moving.vx = Math.abs(st.moving.vx);
        if (st.moving.x > WIDTH + reach) st.moving.vx = -Math.abs(st.moving.vx);
      }
      // Falling debris
      let w = 0;
      for (let i = 0; i < st.falling.length; i++) {
        const f = st.falling[i]; f.vy += 0.5; f.y += f.vy;
        if (f.y < HEIGHT + 200) { if (w !== i) st.falling[w] = f; w++; }
      }
      st.falling.length = w;

      if (st.perfectFx > 0) st.perfectFx = Math.max(0, st.perfectFx - 0.03);
      if (st.pulse > 0) st.pulse = Math.max(0, st.pulse - 0.04);

      // ===== DRAW =====
      // Sky changes with height
      const tier = Math.min(1, st.stack.length / 50);
      const skyTop = lerpColor("#86c5ee", "#06081c", tier);
      const skyBot = lerpColor("#dcedf8", "#1a2050", tier);
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, skyTop); g.addColorStop(1, skyBot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Stars at altitude
      if (tier > 0.3) {
        for (let i = 0; i < 30; i++) {
          const sx = (i * 73) % WIDTH;
          const sy = (i * 41) % (HEIGHT - 100);
          ctx.fillStyle = `rgba(220,225,255,${0.3 + (tier - 0.3) * 0.6})`;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }

      // Center guide line
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(WIDTH / 2, 0); ctx.lineTo(WIDTH / 2, HEIGHT); ctx.stroke(); ctx.setLineDash([]);

      ctx.save();
      ctx.translate(0, st.cameraY);

      // Stack
      for (let i = 0; i < st.stack.length; i++) {
        const b = st.stack[i];
        drawBlock(ctx, b.x, b.y, b.w, BLOCK_H, b.color);
      }
      // Moving block
      if (st.moving) drawBlock(ctx, st.moving.x, st.moving.y, st.moving.w, BLOCK_H, st.moving.color, st.pulse);
      // Falling
      for (const f of st.falling) drawBlock(ctx, f.x, f.y, f.w, BLOCK_H, f.color);

      // Perfect FX ring on the top block
      if (st.perfectFx > 0 && st.stack.length) {
        const top = st.stack[st.stack.length - 1];
        ctx.strokeStyle = `rgba(255,255,255,${st.perfectFx})`;
        ctx.lineWidth = 2;
        const grow = (1 - st.perfectFx) * 18;
        ctx.strokeRect(top.x - grow, top.y - grow, top.w + grow * 2, BLOCK_H + grow * 2);
      }

      ctx.restore();

      // HUD overlay shadow for top
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, 0, WIDTH, 40);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
   
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!started || gameOver) start();
        else drop();
      }
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[400px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">FLOOR </span><span className="text-[var(--crt-green)]">{score}</span></span>
        {perfectStreak > 1 && <span className="px-2 py-0.5 rounded bg-[var(--accent-hot)]/30 text-[var(--accent-hot)] flicker">PERFECT × {perfectStreak}</span>}
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[400px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas
          ref={canvasRef} width={WIDTH} height={HEIGHT}
          onClick={() => { if (!started || gameOver) start(); else drop(); }}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-pointer"
        />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">{gameOver ? "TOWER FELL" : "STACK TOWER"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">FLOOR <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={start} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "STACK AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">Click / tap / SPACE to drop a block<br />Perfect aligns keep your block width!</p>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Time your taps to stack each block perfectly on the one below. Misaligned pieces get trimmed — and when the block becomes too thin to hit, the tower falls.
      </p>
    </div>
  );
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, glow = 0) {
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,255,255,${glow * 0.3})`;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  }
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(x, y + h - 4, w, 4);
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
  const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
