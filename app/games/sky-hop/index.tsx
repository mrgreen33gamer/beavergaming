"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 360;
const HEIGHT = 540;
const PLAYER_W = 28;
const PLAYER_H = 28;
const GRAVITY = 0.32;
const JUMP_V = -11;
const MOVE_ACCEL = 0.7;
const MAX_VX = 6;
const FRICTION = 0.86;

type PlatKind = "normal" | "moving" | "break" | "spring";
type Plat = { x: number; y: number; w: number; kind: PlatKind; vx: number; broken: boolean };

const PLAT_W = 60;
const PLAT_H = 10;

export default function SkyHop() {
  // Ref'd because die() is called from the canvas loop, which closes over its
  // first render — reading `host` directly there would go stale.
  const { host } = useCartridge("sky-hop");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    px: WIDTH / 2, py: HEIGHT - 100,
    vx: 0, vy: 0,
    left: false, right: false,
    cameraY: 0,        // world y at top of view
    plats: [] as Plat[],
    running: false,
    score: 0,
    highestY: HEIGHT - 100,
    lastPlatY: HEIGHT - 80,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }[],
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("skyhop-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const reset = () => {
    const st = s.current;
    st.px = WIDTH / 2 - PLAYER_W / 2; st.py = HEIGHT - 100;
    st.vx = 0; st.vy = 0;
    st.cameraY = 0;
    st.plats = [];
    st.particles = [];
    st.running = true;
    st.score = 0;
    st.highestY = HEIGHT - 100;
    // Build initial platforms below the player so they have something to land on
    st.lastPlatY = HEIGHT - 40;
    st.plats.push({ x: WIDTH / 2 - PLAT_W / 2, y: HEIGHT - 30, w: PLAT_W, kind: "normal", vx: 0, broken: false });
    for (let i = 0; i < 18; i++) generateNextPlatform(st);
    setScore(0); setGameOver(false); setStarted(true);
  };

  const generateNextPlatform = (st: typeof s.current) => {
    const gap = 50 + Math.random() * 38;
    st.lastPlatY -= gap;
    const x = 10 + Math.random() * (WIDTH - PLAT_W - 20);
    const yWorld = st.lastPlatY;
    const heightSurvived = HEIGHT - 100 - st.highestY;
    const r = Math.random();
    let kind: PlatKind = "normal";
    if (heightSurvived > 400 && r < 0.18) kind = "moving";
    else if (heightSurvived > 800 && r < 0.30) kind = "break";
    else if (r < 0.06) kind = "spring";
    const vx = kind === "moving" ? (Math.random() < 0.5 ? -1.4 : 1.4) : 0;
    st.plats.push({ x, y: yWorld, w: PLAT_W, kind, vx, broken: false });
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
        // Horizontal control
        if (st.left) st.vx -= MOVE_ACCEL;
        if (st.right) st.vx += MOVE_ACCEL;
        if (!st.left && !st.right) st.vx *= FRICTION;
        st.vx = Math.max(-MAX_VX, Math.min(MAX_VX, st.vx));
        st.px += st.vx;
        // Wrap horizontally
        if (st.px < -PLAYER_W) st.px = WIDTH;
        if (st.px > WIDTH) st.px = -PLAYER_W;
        // Gravity
        st.vy += GRAVITY;
        st.py += st.vy;

        // Platform collision: only when falling
        if (st.vy > 0) {
          for (const p of st.plats) {
            if (p.broken) continue;
            const py = p.y - st.cameraY; // screen y
            const playerBottom = st.py + PLAYER_H;
            const prevBottom = playerBottom - st.vy;
            if (prevBottom <= py && playerBottom >= py &&
                st.px + PLAYER_W - 4 > p.x && st.px + 4 < p.x + p.w) {
              if (p.kind === "spring") { st.vy = JUMP_V * 1.55; spawnParts(st, p.x + p.w / 2, py, "#5fc8e0"); }
              else { st.vy = JUMP_V; }
              if (p.kind === "break") { p.broken = true; spawnParts(st, p.x + p.w / 2, py, "#d63d3d"); }
              break;
            }
          }
        }

        // Move moving platforms
        for (const p of st.plats) {
          if (p.kind === "moving") {
            p.x += p.vx;
            if (p.x < 4) { p.x = 4; p.vx = -p.vx; }
            if (p.x + p.w > WIDTH - 4) { p.x = WIDTH - 4 - p.w; p.vx = -p.vx; }
          }
        }

        // Camera follow when player is above the upper third
        const screenY = st.py - st.cameraY;
        if (screenY < HEIGHT / 3) {
          const dy = HEIGHT / 3 - screenY;
          st.cameraY -= dy;
          if (st.py < st.highestY) {
            const climbed = st.highestY - st.py;
            st.score += climbed * 0.1;
            st.highestY = st.py;
          }
        }

        // Remove platforms below view
        st.plats = st.plats.filter((p) => p.y - st.cameraY < HEIGHT + 40);
        // Spawn new platforms above
        while (st.lastPlatY > st.cameraY - 80) generateNextPlatform(st);

        // Falling off bottom
        if (st.py > st.cameraY + HEIGHT + 20) {
          die(st);
        }

        if (performance.now() - st.lastSync > 80) {
          st.lastSync = performance.now();
          setScore(Math.floor(st.score));
        }
      }

      // Particles
      let w = 0;
      for (let i = 0; i < st.particles.length; i++) { const p = st.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--; if (p.life > 0) { if (w !== i) st.particles[w] = p; w++; } }
      st.particles.length = w;

      // ===== DRAW =====
      // Sky gradient changes color as you climb
      const climb = Math.max(0, -st.cameraY);
      const tier = Math.min(1, climb / 3000);
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, lerpColor("#86c5ee", "#0a1030", tier));
      g.addColorStop(1, lerpColor("#dcedf8", "#1a2050", tier));
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Stars at high altitudes
      if (tier > 0.4) {
        for (let i = 0; i < 30; i++) {
          const sx = (i * 73 + climb * 0.05) % WIDTH;
          const sy = ((i * 41) % HEIGHT);
          ctx.fillStyle = `rgba(255,255,255,${0.3 + (tier - 0.4) * 0.5})`;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }

      // Cloud strips parallax
      ctx.fillStyle = `rgba(255,255,255,${0.5 - tier * 0.5})`;
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 90 - climb * 0.08) % (WIDTH + 80)) - 40;
        const cy = 60 + i * 90 + (climb * 0.2) % HEIGHT;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.arc(cx + 16, cy + 4, 22, 0, Math.PI * 2);
        ctx.arc(cx + 34, cy, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // Platforms
      for (const p of st.plats) {
        if (p.broken) continue;
        const py = p.y - st.cameraY;
        if (py < -PLAT_H || py > HEIGHT) continue;
        let col = "#7a5230";
        if (p.kind === "moving") col = "#5fc8e0";
        if (p.kind === "break") col = "#d63d3d";
        if (p.kind === "spring") col = "#ffd060";
        ctx.fillStyle = col;
        ctx.fillRect(p.x, py, p.w, PLAT_H);
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(p.x, py, p.w, 2);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(p.x, py + PLAT_H - 2, p.w, 2);
        if (p.kind === "spring") { ctx.fillStyle = "#1a0e0a"; ctx.fillRect(p.x + p.w / 2 - 3, py - 5, 6, 5); }
      }

      // Particles
      for (const p of st.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;

      // Player (cute fuzzy hopper)
      const psy = st.py - st.cameraY;
      // body
      ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.arc(st.px + PLAYER_W / 2, psy + PLAYER_H / 2, PLAYER_W / 2 - 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffb070"; ctx.beginPath(); ctx.arc(st.px + PLAYER_W / 2, psy + PLAYER_H / 2 - 3, PLAYER_W / 2 - 6, 0, Math.PI * 2); ctx.fill();
      // ears
      ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.ellipse(st.px + 8, psy + 3, 3, 6, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(st.px + PLAYER_W - 8, psy + 3, 3, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      // eyes
      ctx.fillStyle = "#1a0e0a";
      ctx.beginPath(); ctx.arc(st.px + 10, psy + 12, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(st.px + PLAYER_W - 10, psy + 12, 2, 0, Math.PI * 2); ctx.fill();
      // mouth
      ctx.fillStyle = "#1a0e0a"; ctx.fillRect(st.px + PLAYER_W / 2 - 2, psy + 18, 4, 1.5);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const die = (st: typeof s.current) => {
    if (!st.running) return;
    st.running = false;
    const final = Math.floor(st.score);
    setScore(final);
    if (final > highScore) { setHighScore(final); localStorage.setItem("skyhop-highscore", String(final)); }
    hostRef.current.reportScore(final);
    setGameOver(true);
  };

  const spawnParts = (st: typeof s.current, x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI - Math.PI; const sp = 1 + Math.random() * 3; st.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 22, maxLife: 22, color }); }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = true;
      if (e.code === "Space" || e.code === "Enter") { if (!started || gameOver) { e.preventDefault(); reset(); } }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[380px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">HEIGHT </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>
      <div className="relative w-full max-w-[380px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">{gameOver ? "FALLEN" : "SKY HOP"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">HEIGHT: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "HOP AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)] text-center">← → to drift · auto-bounce on platforms<br />🟡 spring · 🔵 moving · 🔴 breaks</p>
          </div>
        )}
      </div>
      <div className="sm:hidden flex gap-3">
        <button className="pixel-edge px-8 py-4 bg-[var(--surface-2)] rounded text-2xl" onTouchStart={() => (s.current.left = true)} onTouchEnd={() => (s.current.left = false)}>◀</button>
        <button className="pixel-edge px-8 py-4 bg-[var(--surface-2)] rounded text-2xl" onTouchStart={() => (s.current.right = true)} onTouchEnd={() => (s.current.right = false)}>▶</button>
      </div>
    </div>
  );
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
  const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
