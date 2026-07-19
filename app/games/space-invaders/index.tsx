"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 600;
const HEIGHT = 460;
const PLAYER_W = 34;
const PLAYER_H = 16;
const PLAYER_Y = HEIGHT - 40;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const ALIEN_BULLET_SPEED = 3.5;
const ALIEN_COLS = 9;
const ALIEN_ROWS = 4;
const ALIEN_W = 28;
const ALIEN_H = 20;
const ALIEN_GAP_X = 18;
const ALIEN_GAP_Y = 16;

type Bullet = { x: number; y: number };
type Alien = { x: number; y: number; alive: boolean; row: number };

export default function SpaceInvaders() {
  // Ref'd because the death handler runs inside the canvas loop, which closes
  // over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("space-invaders");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    playerX: WIDTH / 2 - PLAYER_W / 2,
    bullets: [] as Bullet[],
    alienBullets: [] as Bullet[],
    aliens: [] as Alien[],
    dir: 1,
    alienSpeed: 0.4,
    dropPending: false,
    left: false,
    right: false,
    running: false,
    score: 0,
    wave: 1,
    lives: 3,
    lastShot: 0,
    lastSync: 0,
    stepTimer: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("invaders-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const buildAliens = (): Alien[] => {
    const aliens: Alien[] = [];
    const startX = 60;
    const startY = 50;
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        aliens.push({
          x: startX + c * (ALIEN_W + ALIEN_GAP_X),
          y: startY + r * (ALIEN_H + ALIEN_GAP_Y),
          alive: true,
          row: r,
        });
      }
    }
    return aliens;
  };

  const reset = () => {
    const st = s.current;
    st.playerX = WIDTH / 2 - PLAYER_W / 2;
    st.bullets = [];
    st.alienBullets = [];
    st.aliens = buildAliens();
    st.dir = 1;
    st.alienSpeed = 0.4;
    st.running = true;
    st.score = 0;
    st.wave = 1;
    st.lives = 3;
    setScore(0);
    setWave(1);
    setLives(3);
    setGameOver(false);
    setStarted(true);
  };

  const nextWave = () => {
    const st = s.current;
    st.wave += 1;
    st.aliens = buildAliens();
    st.alienSpeed = 0.4 + st.wave * 0.15;
    st.bullets = [];
    st.alienBullets = [];
    st.dir = 1;
    setWave(st.wave);
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
        // Move player
        if (st.left) st.playerX -= PLAYER_SPEED;
        if (st.right) st.playerX += PLAYER_SPEED;
        st.playerX = Math.max(0, Math.min(WIDTH - PLAYER_W, st.playerX));

        // Move bullets
        st.bullets = st.bullets.filter((b) => {
          b.y -= BULLET_SPEED;
          return b.y > -10;
        });
        st.alienBullets = st.alienBullets.filter((b) => {
          b.y += ALIEN_BULLET_SPEED;
          return b.y < HEIGHT + 10;
        });

        // Move aliens as a block
        const alive = st.aliens.filter((a) => a.alive);
        if (alive.length === 0) {
          nextWave();
        } else {
          let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const a of alive) {
            if (a.x < minX) minX = a.x;
            if (a.x + ALIEN_W > maxX) maxX = a.x + ALIEN_W;
            if (a.y + ALIEN_H > maxY) maxY = a.y + ALIEN_H;
          }
          let drop = false;
          if (st.dir > 0 && maxX + st.alienSpeed >= WIDTH - 10) drop = true;
          if (st.dir < 0 && minX - st.alienSpeed <= 10) drop = true;
          if (drop) {
            st.dir *= -1;
            for (const a of st.aliens) a.y += 14;
          } else {
            for (const a of st.aliens) a.x += st.alienSpeed * st.dir;
          }
          // Aliens reached player line
          if (maxY >= PLAYER_Y) {
            st.lives = 0;
            setLives(0);
            die(st);
          }
          // Alien fire
          if (frame % 45 === 0 && alive.length) {
            const shooter = alive[Math.floor(Math.random() * alive.length)];
            st.alienBullets.push({ x: shooter.x + ALIEN_W / 2, y: shooter.y + ALIEN_H });
          }
        }

        // Bullet vs alien
        for (const b of st.bullets) {
          for (const a of st.aliens) {
            if (a.alive && b.x > a.x && b.x < a.x + ALIEN_W && b.y > a.y && b.y < a.y + ALIEN_H) {
              a.alive = false;
              b.y = -100;
              st.score += (ALIEN_ROWS - a.row) * 10;
            }
          }
        }
        st.bullets = st.bullets.filter((b) => b.y > -50);

        // Alien bullet vs player
        for (const b of st.alienBullets) {
          if (b.x > st.playerX && b.x < st.playerX + PLAYER_W && b.y > PLAYER_Y && b.y < PLAYER_Y + PLAYER_H) {
            b.y = HEIGHT + 100;
            st.lives -= 1;
            setLives(st.lives);
            if (st.lives <= 0) die(st);
          }
        }
        st.alienBullets = st.alienBullets.filter((b) => b.y < HEIGHT + 50);

        if (frame - st.lastSync >= 5) {
          st.lastSync = frame;
          setScore(st.score);
        }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#0a0608";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Starfield
      ctx.fillStyle = "#2a1810";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 73 + frame * 0.3) % WIDTH;
        const sy = (i * 137) % HEIGHT;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Aliens
      for (const a of st.aliens) {
        if (!a.alive) continue;
        const colors = ["#d63d3d", "#ff6b1a", "#ffd060", "#7fd650"];
        ctx.fillStyle = colors[a.row % colors.length];
        const wob = Math.floor(frame / 20) % 2 === 0 ? 0 : 2;
        // Body
        ctx.fillRect(a.x + 4, a.y + 4, ALIEN_W - 8, ALIEN_H - 8);
        // Eyes
        ctx.fillRect(a.x + 2, a.y + 2, 4, 4);
        ctx.fillRect(a.x + ALIEN_W - 6, a.y + 2, 4, 4);
        // Legs
        ctx.fillRect(a.x + 4 + wob, a.y + ALIEN_H - 4, 4, 4);
        ctx.fillRect(a.x + ALIEN_W - 8 - wob, a.y + ALIEN_H - 4, 4, 4);
      }

      // Player
      if (st.running || st.lives > 0) {
        ctx.fillStyle = "#7fd650";
        ctx.fillRect(st.playerX + PLAYER_W / 2 - 3, PLAYER_Y - 4, 6, 6);
        ctx.fillRect(st.playerX, PLAYER_Y, PLAYER_W, PLAYER_H);
        ctx.fillStyle = "#5fb030";
        ctx.fillRect(st.playerX + 4, PLAYER_Y + 4, PLAYER_W - 8, 4);
      }

      // Bullets
      ctx.fillStyle = "#ffd060";
      for (const b of st.bullets) ctx.fillRect(b.x - 1.5, b.y, 3, 10);
      ctx.fillStyle = "#ff5050";
      for (const b of st.alienBullets) ctx.fillRect(b.x - 1.5, b.y, 3, 8);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const die = (st: typeof s.current) => {
    if (!st.running) return;
    st.running = false;
    const finalScore = st.score;
    setScore(finalScore);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem("invaders-highscore", String(finalScore));
    }
    hostRef.current.reportScore(finalScore);
    setGameOver(true);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = true;
      if (e.code === "Space") {
        e.preventDefault();
        if (!started || gameOver) { reset(); return; }
        const st = s.current;
        const now = Date.now();
        if (st.running && now - st.lastShot > 280 && st.bullets.length < 3) {
          st.lastShot = now;
          st.bullets.push({ x: st.playerX + PLAYER_W / 2, y: PLAYER_Y });
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{String(score).padStart(5, "0")}</span></span>
        <span><span className="text-[var(--muted)]">WAVE </span><span className="text-[var(--foreground)]">{wave}</span></span>
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#d63d3d]">{"▲ ".repeat(Math.max(0, lives))}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              {gameOver ? "GAME OVER" : "SPACE INVADERS"}
            </h2>
            {gameOver && (
              <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>
            )}
            {gameOver && score >= highScore && score > 0 && (
              <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>
            )}
            <button onClick={reset} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {gameOver ? "TRY AGAIN" : "START"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">
              ← → or A/D to move · SPACE to shoot
            </p>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="sm:hidden flex gap-2 mt-2">
        <button className="pixel-edge px-5 py-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)] text-xl"
          onTouchStart={() => (s.current.left = true)} onTouchEnd={() => (s.current.left = false)}>◀</button>
        <button className="pixel-edge px-6 py-3 bg-[var(--accent)] text-[var(--background)] rounded font-[family-name:var(--font-mono)]"
          onTouchStart={() => { const st = s.current; const now = Date.now(); if (st.running && now - st.lastShot > 280 && st.bullets.length < 3) { st.lastShot = now; st.bullets.push({ x: st.playerX + PLAYER_W / 2, y: PLAYER_Y }); } }}>FIRE</button>
        <button className="pixel-edge px-5 py-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)] text-xl"
          onTouchStart={() => (s.current.right = true)} onTouchEnd={() => (s.current.right = false)}>▶</button>
      </div>
    </div>
  );
}
