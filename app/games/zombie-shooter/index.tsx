"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 460;
const PLAYER_R = 12;
const PLAYER_SPEED = 2.6;
const BULLET_SPEED = 7;
const ZOMBIE_R = 11;

type Vec = { x: number; y: number };
type Bullet = Vec & { vx: number; vy: number; life: number };
type Zombie = Vec & { hp: number; speed: number; hurt: number };
type Particle = Vec & { vx: number; vy: number; life: number; maxLife: number; color: string };

export default function ZombieShooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    px: WIDTH / 2, py: HEIGHT / 2,
    mouseX: WIDTH / 2, mouseY: 0,
    keys: { up: false, down: false, left: false, right: false },
    bullets: [] as Bullet[],
    zombies: [] as Zombie[],
    particles: [] as Particle[],
    hp: 100,
    score: 0,
    wave: 1,
    zombiesToSpawn: 0,
    spawnTimer: 0,
    running: false,
    lastShot: 0,
    firing: false,
    lastSync: 0,
    hitFlash: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("zombie-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const startWave = (w: number) => {
    const st = s.current;
    st.wave = w;
    st.zombiesToSpawn = 4 + w * 3;
    setWave(w);
  };

  const reset = () => {
    const st = s.current;
    st.px = WIDTH / 2; st.py = HEIGHT / 2;
    st.bullets = []; st.zombies = []; st.particles = [];
    st.hp = 100; st.score = 0;
    st.running = true;
    startWave(1);
    setHp(100); setScore(0);
    setGameOver(false); setStarted(true);
  };

  const spawnZombie = (st: typeof s.current) => {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = Math.random() * WIDTH; y = -20; }
    else if (side === 1) { x = WIDTH + 20; y = Math.random() * HEIGHT; }
    else if (side === 2) { x = Math.random() * WIDTH; y = HEIGHT + 20; }
    else { x = -20; y = Math.random() * HEIGHT; }
    const hp = 1 + Math.floor(st.wave / 4);
    st.zombies.push({ x, y, hp, speed: 0.7 + Math.random() * 0.5 + st.wave * 0.05, hurt: 0 });
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
        // Move player
        let mvx = 0, mvy = 0;
        if (st.keys.up) mvy -= 1;
        if (st.keys.down) mvy += 1;
        if (st.keys.left) mvx -= 1;
        if (st.keys.right) mvx += 1;
        const len = Math.hypot(mvx, mvy) || 1;
        st.px += (mvx / len) * PLAYER_SPEED;
        st.py += (mvy / len) * PLAYER_SPEED;
        st.px = Math.max(PLAYER_R, Math.min(WIDTH - PLAYER_R, st.px));
        st.py = Math.max(PLAYER_R, Math.min(HEIGHT - PLAYER_R, st.py));

        // Auto-fire while held
        if (st.firing && now - st.lastShot > 180) {
          st.lastShot = now;
          const a = Math.atan2(st.mouseY - st.py, st.mouseX - st.px);
          st.bullets.push({ x: st.px, y: st.py, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: 70 });
        }

        // Bullets
        st.bullets = st.bullets.filter((b) => {
          b.x += b.vx; b.y += b.vy; b.life--;
          return b.life > 0 && b.x > -10 && b.x < WIDTH + 10 && b.y > -10 && b.y < HEIGHT + 10;
        });

        // Spawn zombies
        if (st.zombiesToSpawn > 0) {
          st.spawnTimer++;
          if (st.spawnTimer >= Math.max(20, 50 - st.wave * 2)) {
            st.spawnTimer = 0;
            spawnZombie(st);
            st.zombiesToSpawn--;
          }
        } else if (st.zombies.length === 0) {
          startWave(st.wave + 1);
        }

        // Move zombies
        for (const z of st.zombies) {
          const a = Math.atan2(st.py - z.y, st.px - z.x);
          z.x += Math.cos(a) * z.speed;
          z.y += Math.sin(a) * z.speed;
          if (z.hurt > 0) z.hurt--;
          // Hit player
          if (Math.hypot(z.x - st.px, z.y - st.py) < PLAYER_R + ZOMBIE_R) {
            st.hp -= 0.4;
            st.hitFlash = 6;
            if (st.hp <= 0) { st.hp = 0; setHp(0); die(st); }
          }
        }

        // Bullet vs zombie
        for (const b of st.bullets) {
          for (const z of st.zombies) {
            if (z.hp > 0 && Math.hypot(b.x - z.x, b.y - z.y) < ZOMBIE_R + 3) {
              z.hp--; z.hurt = 5; b.life = 0;
              if (z.hp <= 0) {
                st.score += 10;
                for (let i = 0; i < 8; i++) {
                  const pa = Math.random() * Math.PI * 2;
                  const sp = 1 + Math.random() * 3;
                  st.particles.push({ x: z.x, y: z.y, vx: Math.cos(pa) * sp, vy: Math.sin(pa) * sp, life: 24, maxLife: 24, color: "#5fb030" });
                }
              }
              break;
            }
          }
        }
        st.bullets = st.bullets.filter((b) => b.life > 0);
        st.zombies = st.zombies.filter((z) => z.hp > 0);

        if (st.hitFlash > 0) st.hitFlash--;
        if (frame - st.lastSync >= 4) {
          st.lastSync = frame;
          setScore(st.score);
          setHp(Math.ceil(st.hp));
        }
      }

      // Particles
      st.particles = st.particles.filter((p) => {
        p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--;
        return p.life > 0;
      });

      // ===== DRAW =====
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Ground grid
      ctx.strokeStyle = "#2a2018";
      ctx.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
      for (let y = 0; y <= HEIGHT; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }

      // Particles
      for (const p of st.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      // Zombies
      for (const z of st.zombies) {
        ctx.fillStyle = z.hurt > 0 ? "#ffffff" : "#5fb030";
        ctx.beginPath();
        ctx.arc(z.x, z.y, ZOMBIE_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = z.hurt > 0 ? "#aaa" : "#3a7820";
        ctx.fillRect(z.x - 5, z.y - 4, 3, 3);
        ctx.fillRect(z.x + 2, z.y - 4, 3, 3);
      }

      // Player
      if (st.running) {
        const a = Math.atan2(st.mouseY - st.py, st.mouseX - st.px);
        // Body
        ctx.fillStyle = "#5fc8e0";
        ctx.beginPath();
        ctx.arc(st.px, st.py, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        // Gun
        ctx.strokeStyle = "#f5e8d0";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(st.px, st.py);
        ctx.lineTo(st.px + Math.cos(a) * 20, st.py + Math.sin(a) * 20);
        ctx.stroke();
      }

      // Bullets
      ctx.fillStyle = "#ffd060";
      for (const b of st.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hit flash
      if (st.hitFlash > 0) {
        ctx.fillStyle = `rgba(214, 61, 61, ${st.hitFlash / 6 * 0.3})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      // HP bar
      ctx.fillStyle = "#3a2218";
      ctx.fillRect(10, HEIGHT - 18, 150, 8);
      ctx.fillStyle = st.hp > 30 ? "#7fd650" : "#d63d3d";
      ctx.fillRect(10, HEIGHT - 18, 150 * Math.max(0, st.hp) / 100, 8);

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
      localStorage.setItem("zombie-highscore", String(finalScore));
    }
    setGameOver(true);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.code;
      if (k === "KeyW" || k === "ArrowUp") s.current.keys.up = true;
      if (k === "KeyS" || k === "ArrowDown") s.current.keys.down = true;
      if (k === "KeyA" || k === "ArrowLeft") s.current.keys.left = true;
      if (k === "KeyD" || k === "ArrowRight") s.current.keys.right = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.code;
      if (k === "KeyW" || k === "ArrowUp") s.current.keys.up = false;
      if (k === "KeyS" || k === "ArrowDown") s.current.keys.down = false;
      if (k === "KeyA" || k === "ArrowLeft") s.current.keys.left = false;
      if (k === "KeyD" || k === "ArrowRight") s.current.keys.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    s.current.mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
    s.current.mouseY = (e.clientY - rect.top) * (HEIGHT / rect.height);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{String(score).padStart(5, "0")}</span></span>
        <span><span className="text-[var(--muted)]">WAVE </span><span className="text-[var(--foreground)]">{wave}</span></span>
        <span><span className="text-[var(--muted)]">HP </span><span className={hp > 30 ? "text-[#7fd650]" : "text-[#d63d3d]"}>{hp}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-crosshair"
          onMouseMove={onMove}
          onMouseDown={() => { if (s.current.running) s.current.firing = true; }}
          onMouseUp={() => (s.current.firing = false)}
          onMouseLeave={() => (s.current.firing = false)}
        />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              {gameOver ? "YOU DIED" : "ZOMBIE SHOOTER"}
            </h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span> · WAVE {wave}</p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {gameOver ? "TRY AGAIN" : "START"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">WASD to move · mouse to aim<br/><span className="text-xs">hold click to fire · survive the waves</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
