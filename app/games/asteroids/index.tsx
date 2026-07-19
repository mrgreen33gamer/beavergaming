"use client";

import { useEffect, useRef, useState } from "react";
import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 600;
const HEIGHT = 460;

type Vec = { x: number; y: number };
type Ship = Vec & { angle: number; vx: number; vy: number; thrust: boolean };
type Roid = Vec & { vx: number; vy: number; size: number; verts: number[] };
type Bullet = Vec & { vx: number; vy: number; life: number };

function makeRoid(x: number, y: number, size: number): Roid {
  const verts: number[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) verts.push(0.7 + Math.random() * 0.5);
  const sp = (4 - size) * 0.5 + 0.3;
  const a = Math.random() * Math.PI * 2;
  return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size, verts };
}

function wrap(o: Vec) {
  if (o.x < 0) o.x += WIDTH;
  if (o.x > WIDTH) o.x -= WIDTH;
  if (o.y < 0) o.y += HEIGHT;
  if (o.y > HEIGHT) o.y -= HEIGHT;
}

const SIZE_RADIUS = [0, 14, 26, 42]; // index by size 1..3

export default function Asteroids() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const { host, highScore } = useCartridge("asteroids");
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const hostRef = useRef(host);
  useEffect(() => {
    hostRef.current = host;
  }, [host]);

  const s = useRef({
    ship: { x: WIDTH / 2, y: HEIGHT / 2, angle: -Math.PI / 2, vx: 0, vy: 0, thrust: false } as Ship,
    roids: [] as Roid[],
    bullets: [] as Bullet[],
    keys: { left: false, right: false, up: false },
    running: false,
    paused: false,
    score: 0, lives: 3, wave: 1,
    invuln: 0,
    lastShot: 0,
    lastSync: 0,
  });

  const spawnWave = (st: typeof s.current, n: number) => {
    st.roids = [];
    for (let i = 0; i < n; i++) {
      // spawn away from center
      let x = 0, y = 0;
      do { x = Math.random() * WIDTH; y = Math.random() * HEIGHT; } while (Math.hypot(x - WIDTH / 2, y - HEIGHT / 2) < 140);
      st.roids.push(makeRoid(x, y, 3));
    }
  };

  const reset = () => {
    const st = s.current;
    st.ship = { x: WIDTH / 2, y: HEIGHT / 2, angle: -Math.PI / 2, vx: 0, vy: 0, thrust: false };
    st.bullets = [];
    st.running = true;
    st.score = 0; st.lives = 3; st.wave = 1;
    st.invuln = 90;
    spawnWave(st, 4);
    setScore(0); setLives(3); setWave(1);
    setGameOver(false); setStarted(true);
  };

  useEffect(() => {
    host.onPause(() => {
      s.current.paused = true;
    });
    host.onResume(() => {
      s.current.paused = false;
    });
  }, [host]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const die = (st: typeof s.current) => {
      st.running = false;
      setScore(st.score);
      hostRef.current.reportScore(st.score);
      setGameOver(true);
    };

    const loop = () => {
      const st = s.current;
      const sh = st.ship;

      if (st.running && !st.paused) {
        // Rotate / thrust
        if (st.keys.left) sh.angle -= 0.09;
        if (st.keys.right) sh.angle += 0.09;
        sh.thrust = st.keys.up;
        if (sh.thrust) {
          sh.vx += Math.cos(sh.angle) * 0.18;
          sh.vy += Math.sin(sh.angle) * 0.18;
        }
        sh.vx *= 0.99; sh.vy *= 0.99;
        const sp = Math.hypot(sh.vx, sh.vy);
        if (sp > 7) { sh.vx = (sh.vx / sp) * 7; sh.vy = (sh.vy / sp) * 7; }
        sh.x += sh.vx; sh.y += sh.vy;
        wrap(sh);
        if (st.invuln > 0) st.invuln--;

        // Bullets
        st.bullets = st.bullets.filter((b) => {
          b.x += b.vx; b.y += b.vy; wrap(b); b.life--;
          return b.life > 0;
        });

        // Asteroids
        for (const r of st.roids) { r.x += r.vx; r.y += r.vy; wrap(r); }

        // Bullet vs asteroid
        for (const b of st.bullets) {
          for (let i = st.roids.length - 1; i >= 0; i--) {
            const r = st.roids[i];
            if (Math.hypot(b.x - r.x, b.y - r.y) < SIZE_RADIUS[r.size]) {
              b.life = 0;
              st.score += (4 - r.size) * 20;
              st.roids.splice(i, 1);
              if (r.size > 1) {
                st.roids.push(makeRoid(r.x, r.y, r.size - 1));
                st.roids.push(makeRoid(r.x, r.y, r.size - 1));
              }
              break;
            }
          }
        }
        st.bullets = st.bullets.filter((b) => b.life > 0);

        // Ship vs asteroid
        if (st.invuln <= 0) {
          for (const r of st.roids) {
            if (Math.hypot(sh.x - r.x, sh.y - r.y) < SIZE_RADIUS[r.size] + 8) {
              st.lives--;
              setLives(st.lives);
              if (st.lives <= 0) { die(st); }
              else { sh.x = WIDTH / 2; sh.y = HEIGHT / 2; sh.vx = 0; sh.vy = 0; st.invuln = 100; }
              break;
            }
          }
        }

        // Wave clear
        if (st.roids.length === 0 && st.running) {
          st.wave++;
          setWave(st.wave);
          spawnWave(st, 3 + st.wave);
          st.invuln = 60;
        }

        if (performance.now() - st.lastSync > 80) { st.lastSync = performance.now(); setScore(st.score); }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#05050a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Stars
      ctx.fillStyle = "#252550";
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % WIDTH, (i * 53) % HEIGHT, 1, 1);

      // Asteroids
      ctx.strokeStyle = "#b8a088";
      ctx.lineWidth = 1.5;
      for (const r of st.roids) {
        const rad = SIZE_RADIUS[r.size];
        ctx.beginPath();
        for (let i = 0; i <= r.verts.length; i++) {
          const idx = i % r.verts.length;
          const a = (idx / r.verts.length) * Math.PI * 2;
          const rr = rad * r.verts[idx];
          const px = r.x + Math.cos(a) * rr;
          const py = r.y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Bullets
      ctx.fillStyle = "#ffd060";
      for (const b of st.bullets) { ctx.fillRect(b.x - 2, b.y - 2, 4, 4); }

      // Ship
      if (st.running && (st.invuln <= 0 || Math.floor(performance.now() / 100) % 2 === 0)) {
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.angle);
        ctx.strokeStyle = "#7fd650";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.stroke();
        if (sh.thrust) {
          ctx.strokeStyle = "#ff6b1a";
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(-12 - Math.random() * 4, 0);
          ctx.stroke();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const shoot = (st: typeof s.current) => {
    const now = performance.now();
    if (now - st.lastShot < 220 || st.bullets.length >= 5) return;
    st.lastShot = now;
    const sh = st.ship;
    st.bullets.push({ x: sh.x + Math.cos(sh.angle) * 12, y: sh.y + Math.sin(sh.angle) * 12, vx: Math.cos(sh.angle) * 8 + sh.vx, vy: Math.sin(sh.angle) * 8 + sh.vy, life: 55 });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.keys.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.keys.right = true;
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); s.current.keys.up = true; }
      if (e.code === "Space") {
        e.preventDefault();
        if (!started || gameOver) { reset(); return; }
        shoot(s.current);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.keys.right = false;
      if (e.code === "ArrowUp" || e.code === "KeyW") s.current.keys.up = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{String(score).padStart(5, "0")}</span></span>
        <span><span className="text-[var(--muted)]">WAVE </span><span className="text-[var(--foreground)]">{wave}</span></span>
        <span><span className="text-[var(--muted)]">SHIPS </span><span className="text-[#7fd650]">{"▲ ".repeat(Math.max(0, lives))}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>
      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">{gameOver ? "GAME OVER" : "ASTEROIDS"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "TRY AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">← → rotate · ↑ thrust · SPACE shoot<br/><span className="text-xs">screen wraps around the edges</span></p>
          </div>
        )}
      </div>
      <div className="sm:hidden grid grid-cols-4 gap-2 mt-2">
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onTouchStart={() => (s.current.keys.left = true)} onTouchEnd={() => (s.current.keys.left = false)}>↺</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onTouchStart={() => (s.current.keys.up = true)} onTouchEnd={() => (s.current.keys.up = false)}>▲</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onTouchStart={() => (s.current.keys.right = true)} onTouchEnd={() => (s.current.keys.right = false)}>↻</button>
        <button className="pixel-edge p-3 bg-[var(--accent)] text-[var(--background)] rounded" onTouchStart={() => shoot(s.current)}>🔫</button>
      </div>
    </div>
  );
}
