"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 600;
const HEIGHT = 460;
const PLAYER_W = 30;
const PLAYER_H = 18;
const PLAYER_Y = HEIGHT - 40;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 8;
const COLS = 8;
const ROWS = 3;
const ENEMY_W = 26;
const ENEMY_H = 22;

type Bullet = { x: number; y: number };
type Enemy = {
  // formation home position
  homeX: number; homeY: number;
  x: number; y: number;
  alive: boolean;
  row: number;
  // diving
  diving: boolean;
  diveT: number;
  diveStartX: number; diveStartY: number;
  diveTargetX: number;
};

export default function Galaga() {
  // Ref'd because die() is called from the canvas loop, which closes over its
  // first render — reading `host` directly there would go stale.
  const { host } = useCartridge("galaga");
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
    enemyBullets: [] as Bullet[],
    enemies: [] as Enemy[],
    swayPhase: 0,
    left: false,
    right: false,
    running: false,
    score: 0,
    wave: 1,
    lives: 3,
    lastShot: 0,
    lastSync: 0,
    lastDive: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("galaga-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const buildEnemies = (): Enemy[] => {
    const out: Enemy[] = [];
    const startX = 90;
    const startY = 55;
    const gx = 50, gy = 40;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const hx = startX + c * gx;
        const hy = startY + r * gy;
        out.push({
          homeX: hx, homeY: hy, x: hx, y: hy,
          alive: true, row: r,
          diving: false, diveT: 0,
          diveStartX: hx, diveStartY: hy, diveTargetX: hx,
        });
      }
    }
    return out;
  };

  const reset = () => {
    const st = s.current;
    st.playerX = WIDTH / 2 - PLAYER_W / 2;
    st.bullets = [];
    st.enemyBullets = [];
    st.enemies = buildEnemies();
    st.swayPhase = 0;
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
        if (st.left) st.playerX -= PLAYER_SPEED;
        if (st.right) st.playerX += PLAYER_SPEED;
        st.playerX = Math.max(0, Math.min(WIDTH - PLAYER_W, st.playerX));

        st.swayPhase += 0.02;
        const sway = Math.sin(st.swayPhase) * 18;

        // Bullets
        st.bullets = st.bullets.filter((b) => { b.y -= BULLET_SPEED; return b.y > -10; });
        st.enemyBullets = st.enemyBullets.filter((b) => { b.y += 4; return b.y < HEIGHT + 10; });

        const alive = st.enemies.filter((e) => e.alive);
        if (alive.length === 0) {
          st.wave += 1;
          st.enemies = buildEnemies();
          setWave(st.wave);
        }

        // Update enemy positions
        for (const e of st.enemies) {
          if (!e.alive) continue;
          if (e.diving) {
            e.diveT += 0.012;
            // Arc dive: lerp X toward target with sine bob, Y goes down then loops to top
            const t = e.diveT;
            e.y = e.diveStartY + t * (HEIGHT + 100);
            e.x = e.diveStartX + (e.diveTargetX - e.diveStartX) * t + Math.sin(t * Math.PI * 3) * 40;
            // Drop a bullet mid-dive
            if (Math.random() < 0.02) {
              st.enemyBullets.push({ x: e.x + ENEMY_W / 2, y: e.y + ENEMY_H });
            }
            if (e.y > HEIGHT + 50) {
              // Return to formation from top
              e.diving = false;
              e.diveT = 0;
              e.y = e.homeY;
              e.x = e.homeX;
            }
          } else {
            e.x = e.homeX + sway;
            e.y = e.homeY;
          }
        }

        // Trigger dives
        if (frame - st.lastDive > 70 && alive.length) {
          st.lastDive = frame;
          const notDiving = alive.filter((e) => !e.diving);
          if (notDiving.length && Math.random() < 0.8) {
            const e = notDiving[Math.floor(Math.random() * notDiving.length)];
            e.diving = true;
            e.diveT = 0;
            e.diveStartX = e.x;
            e.diveStartY = e.y;
            e.diveTargetX = st.playerX;
          }
        }

        // Bullet vs enemy
        for (const b of st.bullets) {
          for (const e of st.enemies) {
            if (e.alive && b.x > e.x && b.x < e.x + ENEMY_W && b.y > e.y && b.y < e.y + ENEMY_H) {
              e.alive = false;
              b.y = -100;
              st.score += e.diving ? (ROWS - e.row) * 30 : (ROWS - e.row) * 15;
            }
          }
        }
        st.bullets = st.bullets.filter((b) => b.y > -50);

        // Enemy collision with player (dive) + enemy bullets
        for (const e of st.enemies) {
          if (e.alive && e.diving &&
              e.x < st.playerX + PLAYER_W && e.x + ENEMY_W > st.playerX &&
              e.y < PLAYER_Y + PLAYER_H && e.y + ENEMY_H > PLAYER_Y) {
            e.alive = false;
            st.lives -= 1;
            setLives(st.lives);
            if (st.lives <= 0) die(st);
          }
        }
        for (const b of st.enemyBullets) {
          if (b.x > st.playerX && b.x < st.playerX + PLAYER_W && b.y > PLAYER_Y && b.y < PLAYER_Y + PLAYER_H) {
            b.y = HEIGHT + 100;
            st.lives -= 1;
            setLives(st.lives);
            if (st.lives <= 0) die(st);
          }
        }
        st.enemyBullets = st.enemyBullets.filter((b) => b.y < HEIGHT + 50);

        if (frame - st.lastSync >= 5) { st.lastSync = frame; setScore(st.score); }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#05050f";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#252550";
      for (let i = 0; i < 50; i++) {
        const sx = (i * 89) % WIDTH;
        const sy = (i * 53 + frame * 1.2) % HEIGHT;
        ctx.fillRect(sx, sy, 1, 2);
      }

      for (const e of st.enemies) {
        if (!e.alive) continue;
        const palette = ["#ff5050", "#ffd060", "#5fc8e0"];
        const col = palette[e.row % palette.length];
        ctx.fillStyle = col;
        // Wings
        ctx.fillRect(e.x, e.y + 6, 5, 10);
        ctx.fillRect(e.x + ENEMY_W - 5, e.y + 6, 5, 10);
        // Body
        ctx.fillRect(e.x + 6, e.y + 2, ENEMY_W - 12, ENEMY_H - 6);
        ctx.fillStyle = "#fff";
        ctx.fillRect(e.x + 9, e.y + 6, 3, 3);
        ctx.fillRect(e.x + ENEMY_W - 12, e.y + 6, 3, 3);
      }

      if (st.running || st.lives > 0) {
        ctx.fillStyle = "#5fc8e0";
        ctx.fillRect(st.playerX + PLAYER_W / 2 - 2, PLAYER_Y - 6, 4, 8);
        ctx.fillRect(st.playerX + 6, PLAYER_Y, PLAYER_W - 12, PLAYER_H);
        ctx.fillRect(st.playerX, PLAYER_Y + PLAYER_H - 6, PLAYER_W, 6);
        ctx.fillStyle = "#a0e8ff";
        ctx.fillRect(st.playerX + PLAYER_W / 2 - 3, PLAYER_Y + 3, 6, 6);
      }

      ctx.fillStyle = "#7fd650";
      for (const b of st.bullets) ctx.fillRect(b.x - 1.5, b.y, 3, 12);
      ctx.fillStyle = "#ff5050";
      for (const b of st.enemyBullets) ctx.fillRect(b.x - 1.5, b.y, 3, 8);

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
      localStorage.setItem("galaga-highscore", String(finalScore));
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
        if (st.running && now - st.lastShot > 250 && st.bullets.length < 2) {
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
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#5fc8e0]">{"▲ ".repeat(Math.max(0, lives))}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              {gameOver ? "GAME OVER" : "GALAGA"}
            </h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {gameOver ? "TRY AGAIN" : "START"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">← → or A/D to move · SPACE to shoot<br/><span className="text-xs">Diving enemies are worth double!</span></p>
          </div>
        )}
      </div>

      <div className="sm:hidden flex gap-2 mt-2">
        <button className="pixel-edge px-5 py-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)] text-xl"
          onTouchStart={() => (s.current.left = true)} onTouchEnd={() => (s.current.left = false)}>◀</button>
        <button className="pixel-edge px-6 py-3 bg-[var(--accent)] text-[var(--background)] rounded font-[family-name:var(--font-mono)]"
          onTouchStart={() => { const st = s.current; const now = Date.now(); if (st.running && now - st.lastShot > 250 && st.bullets.length < 2) { st.lastShot = now; st.bullets.push({ x: st.playerX + PLAYER_W / 2, y: PLAYER_Y }); } }}>FIRE</button>
        <button className="pixel-edge px-5 py-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)] text-xl"
          onTouchStart={() => (s.current.right = true)} onTouchEnd={() => (s.current.right = false)}>▶</button>
      </div>
    </div>
  );
}
