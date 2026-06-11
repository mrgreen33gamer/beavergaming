"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 240;
const GROUND_Y = 200;
const DINO_X = 60;
const DINO_W = 26;
const DINO_H = 30;
const GRAVITY = 0.7;
const JUMP_V = -11.5;

type Obstacle = { x: number; w: number; h: number; bird: boolean; y: number };

export default function DinoRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    dy: GROUND_Y - DINO_H,
    vy: 0,
    ducking: false,
    onGround: true,
    obstacles: [] as Obstacle[],
    speed: 6,
    running: false,
    score: 0,
    spawnTimer: 0,
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("dino-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const reset = () => {
    const st = s.current;
    st.dy = GROUND_Y - DINO_H;
    st.vy = 0;
    st.ducking = false;
    st.onGround = true;
    st.obstacles = [];
    st.speed = 6;
    st.running = true;
    st.score = 0;
    st.spawnTimer = 40;
    setScore(0);
    setGameOver(false);
    setStarted(true);
  };

  const jump = () => {
    const st = s.current;
    if (!st.running) { if (!started || gameOver) reset(); return; }
    if (st.onGround) { st.vy = JUMP_V; st.onGround = false; }
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

      if (st.running) {
        st.speed += 0.0025;
        st.score += st.speed * 0.05;

        // Dino physics
        const h = st.ducking && st.onGround ? DINO_H / 2 : DINO_H;
        st.vy += GRAVITY;
        st.dy += st.vy;
        const floor = GROUND_Y - h;
        if (st.dy >= floor) { st.dy = floor; st.vy = 0; st.onGround = true; }

        // Spawn obstacles
        st.spawnTimer--;
        if (st.spawnTimer <= 0) {
          st.spawnTimer = Math.max(40, 90 - Math.floor(st.speed * 3)) + Math.floor(Math.random() * 40);
          const bird = st.score > 200 && Math.random() < 0.3;
          if (bird) {
            st.obstacles.push({ x: WIDTH + 20, w: 28, h: 20, bird: true, y: GROUND_Y - 50 - (Math.random() < 0.5 ? 0 : 30) });
          } else {
            const big = Math.random() < 0.4;
            st.obstacles.push({ x: WIDTH + 20, w: big ? 26 : 16, h: big ? 38 : 28, bird: false, y: 0 });
          }
        }

        // Move obstacles
        for (const o of st.obstacles) o.x -= st.speed;
        st.obstacles = st.obstacles.filter((o) => o.x + o.w > -10);

        // Collisions
        const dinoTop = st.dy;
        const dinoBot = st.dy + h;
        for (const o of st.obstacles) {
          const oy = o.bird ? o.y : GROUND_Y - o.h;
          const oBot = o.bird ? o.y + o.h : GROUND_Y;
          if (DINO_X + DINO_W - 4 > o.x && DINO_X + 4 < o.x + o.w && dinoBot > oy + 2 && dinoTop < oBot - 2) {
            die(st);
          }
        }

        if (frame - st.lastSync >= 5) { st.lastSync = frame; setScore(Math.floor(st.score)); }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#1a0e0a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Ground line
      ctx.strokeStyle = "#5a3a25";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(WIDTH, GROUND_Y);
      ctx.stroke();
      // Ground texture dashes scrolling
      ctx.fillStyle = "#3a2218";
      for (let i = 0; i < 20; i++) {
        const gx = (i * 60 - (frame * (s.current.speed)) % 60);
        ctx.fillRect(gx, GROUND_Y + 6, 16, 2);
      }

      // Obstacles
      for (const o of st.obstacles) {
        if (o.bird) {
          ctx.fillStyle = "#c45ed6";
          const flap = Math.floor(frame / 8) % 2 === 0 ? -4 : 4;
          ctx.fillRect(o.x, o.y + 6, o.w, 6);
          ctx.beginPath();
          ctx.moveTo(o.x + 6, o.y + 8);
          ctx.lineTo(o.x + 14, o.y + 8 + flap);
          ctx.lineTo(o.x + 22, o.y + 8);
          ctx.fill();
        } else {
          ctx.fillStyle = "#7fd650";
          ctx.fillRect(o.x, GROUND_Y - o.h, o.w, o.h);
          ctx.fillRect(o.x - 4, GROUND_Y - o.h + 8, 4, 10);
          ctx.fillRect(o.x + o.w, GROUND_Y - o.h + 6, 4, 10);
        }
      }

      // Dino
      const h = st.ducking && st.onGround ? DINO_H / 2 : DINO_H;
      ctx.fillStyle = st.running ? "#ff6b1a" : "#b8a088";
      ctx.fillRect(DINO_X, st.dy, DINO_W, h);
      // Head
      ctx.fillRect(DINO_X + DINO_W - 6, st.dy - 2, 10, 12);
      // Eye
      ctx.fillStyle = "#1a0e0a";
      ctx.fillRect(DINO_X + DINO_W, st.dy + 1, 2, 2);
      // Legs (running animation)
      if (st.onGround && st.running) {
        ctx.fillStyle = "#ff6b1a";
        const step = Math.floor(frame / 6) % 2 === 0;
        ctx.fillRect(DINO_X + 4, st.dy + h, 5, step ? 6 : 3);
        ctx.fillRect(DINO_X + DINO_W - 9, st.dy + h, 5, step ? 3 : 6);
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const die = (st: typeof s.current) => {
    if (!st.running) return;
    st.running = false;
    const sc = Math.floor(st.score);
    setScore(sc);
    if (sc > highScore) { setHighScore(sc); localStorage.setItem("dino-highscore", String(sc)); }
    setGameOver(true);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); jump(); }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); s.current.ducking = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown" || e.code === "KeyS") s.current.ducking = false;
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
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{String(highScore).padStart(5, "0")}</span></span>
      </div>
      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onMouseDown={jump} onTouchStart={(e) => { e.preventDefault(); jump(); }}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-pointer" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">{gameOver ? "GAME OVER" : "DINO RUN"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "RUN AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">SPACE / ↑ / tap to jump · ↓ to duck</p>
          </div>
        )}
      </div>
    </div>
  );
}
