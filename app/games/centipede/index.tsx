"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 480;
const HEIGHT = 600;
const CELL = 20;
const COLS = WIDTH / CELL;        // 24
const ROWS = HEIGHT / CELL;       // 30
const PLAYER_ROW = ROWS - 2;      // y = 560
const PLAYER_TOP_ZONE = ROWS - 6; // player can move within bottom 6 rows
const PLAYER_SPEED = 5;
const BULLET_SPEED = 9;

type Seg = { col: number; row: number; dir: 1 | -1; descending: boolean; head: boolean };
type Bullet = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string };

export default function Centipede() {
  // Ref'd because playerHit() is called from the canvas loop, which closes over
  // its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("centipede");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [wave, setWave] = useState(1);

  const s = useRef({
    px: WIDTH / 2, py: PLAYER_ROW * CELL + CELL / 2,
    left: false, right: false, up: false, down: false, firing: false,
    fireCooldown: 0,
    mushrooms: [] as { col: number; row: number; hp: number }[],
    segments: [] as Seg[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    moveTick: 0,
    moveInterval: 6,
    running: false,
    invuln: 0,
    wave: 1,
    score: 0,
    lives: 3,
    lastSync: 0,
  });

  useEffect(() => {
    const h = localStorage.getItem("centipede-high");
    if (h) setHighScore(parseInt(h, 10));
  }, []);

  const mushroomAt = (st: typeof s.current, c: number, r: number) =>
    st.mushrooms.find((m) => m.col === c && m.row === r);

  const seedMushrooms = (st: typeof s.current) => {
    st.mushrooms = [];
    for (let i = 0; i < 40; i++) {
      const c = Math.floor(Math.random() * COLS);
      const r = 2 + Math.floor(Math.random() * (ROWS - 8));
      if (!mushroomAt(st, c, r)) st.mushrooms.push({ col: c, row: r, hp: 4 });
    }
  };

  const spawnCentipede = (st: typeof s.current) => {
    const len = 8 + Math.min(8, st.wave);
    st.segments = [];
    for (let i = 0; i < len; i++) st.segments.push({ col: len - 1 - i, row: 0, dir: 1, descending: false, head: i === 0 });
    st.moveInterval = Math.max(2, 7 - Math.floor(st.wave / 2));
  };

  const start = () => {
    const st = s.current;
    st.px = WIDTH / 2; st.py = PLAYER_ROW * CELL + CELL / 2;
    st.bullets = []; st.particles = [];
    st.wave = 1; st.score = 0; st.lives = 3;
    st.running = true; st.invuln = 0;
    seedMushrooms(st); spawnCentipede(st);
    setScore(0); setLives(3); setWave(1); setOver(false); setStarted(true);
  };

  const fire = (st: typeof s.current) => {
    if (st.fireCooldown > 0 || !st.running) return;
    st.bullets.push({ x: st.px, y: st.py - 12 });
    st.fireCooldown = 8;
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
        // Player movement
        if (st.left) st.px -= PLAYER_SPEED;
        if (st.right) st.px += PLAYER_SPEED;
        if (st.up) st.py -= PLAYER_SPEED;
        if (st.down) st.py += PLAYER_SPEED;
        st.px = Math.max(10, Math.min(WIDTH - 10, st.px));
        st.py = Math.max(PLAYER_TOP_ZONE * CELL, Math.min(HEIGHT - 14, st.py));
        if (st.firing) fire(st);
        if (st.fireCooldown > 0) st.fireCooldown--;
        if (st.invuln > 0) st.invuln--;

        // Bullets
        for (const b of st.bullets) b.y -= BULLET_SPEED;
        // Collide bullets with mushrooms / segments
        const remainBullets: Bullet[] = [];
        for (const b of st.bullets) {
          if (b.y < -10) continue;
          const bc = Math.floor(b.x / CELL), br = Math.floor(b.y / CELL);
          // Check mushroom
          const m = mushroomAt(st, bc, br);
          if (m) {
            m.hp--; st.score += 1;
            spawnParts(st, m.col * CELL + CELL / 2, m.row * CELL + CELL / 2, "#7fd650", 4);
            if (m.hp <= 0) { st.mushrooms = st.mushrooms.filter((x) => x !== m); st.score += 1; }
            continue;
          }
          // Check segment
          let hit = false;
          for (let i = 0; i < st.segments.length; i++) {
            const seg = st.segments[i];
            const sx = seg.col * CELL + CELL / 2, sy = seg.row * CELL + CELL / 2;
            if (Math.abs(sx - b.x) < CELL / 2 && Math.abs(sy - b.y) < CELL / 2) {
              hit = true;
              st.score += seg.head ? 100 : 10;
              spawnParts(st, sx, sy, "#ff5050", 14);
              // Split: segments before and after, new heads at the split
              const before = st.segments.slice(0, i);
              const after = st.segments.slice(i + 1);
              if (before.length) before[before.length - 1].head = true; // shouldn't matter, the head was at i
              if (after.length) {
                // Reverse so the new "head" is at the front and moves opposite direction would feel wrong; keep direction.
                after[0].head = true;
              }
              // Place a mushroom where the segment died
              if (!mushroomAt(st, seg.col, seg.row)) st.mushrooms.push({ col: seg.col, row: seg.row, hp: 4 });
              st.segments = [...before, ...after];
              break;
            }
          }
          if (!hit) remainBullets.push(b);
        }
        st.bullets = remainBullets;

        // Segment movement (stepwise on tick)
        st.moveTick++;
        if (st.moveTick >= st.moveInterval) {
          st.moveTick = 0;
          stepSegments(st);
        }

        // Centipede touches player?
        for (const seg of st.segments) {
          const sx = seg.col * CELL + CELL / 2, sy = seg.row * CELL + CELL / 2;
          if (st.invuln === 0 && Math.abs(sx - st.px) < CELL && Math.abs(sy - st.py) < CELL) {
            playerHit(st);
            break;
          }
        }

        // Wave clear
        if (st.segments.length === 0) {
          st.wave++; setWave(st.wave); spawnCentipede(st); st.score += 50;
        }

        // Sync HUD
        if (frame - st.lastSync >= 4) {
          st.lastSync = frame;
          setScore(st.score);
          setLives(st.lives);
        }
      }

      // Particles
      let w = 0;
      for (let i = 0; i < st.particles.length; i++) { const p = st.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; if (p.life > 0) { if (w !== i) st.particles[w] = p; w++; } }
      st.particles.length = w;

      // ===== DRAW =====
      ctx.fillStyle = "#0a0608"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // bg subtle grid in player zone
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      for (let r = PLAYER_TOP_ZONE; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((r + c) % 2 === 0) ctx.fillRect(c * CELL, r * CELL, CELL, CELL);

      // Mushrooms
      for (const m of st.mushrooms) {
        const mx = m.col * CELL + CELL / 2, my = m.row * CELL + CELL / 2;
        const hpRatio = m.hp / 4;
        ctx.fillStyle = "#d63d3d"; ctx.beginPath();
        ctx.ellipse(mx, my - 3, 8, 6, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#ffd060"; for (let k = 0; k < 3; k++) ctx.fillRect(mx - 4 + k * 4, my - 6 + (k % 2) * 2, 2, 2);
        ctx.fillStyle = "#f5e8d0"; ctx.fillRect(mx - 3, my - 1, 6, 6);
        if (hpRatio < 1) { ctx.fillStyle = `rgba(0,0,0,${(1 - hpRatio) * 0.4})`; ctx.fillRect(mx - 8, my - 8, 16, 16); }
      }

      // Centipede
      for (const seg of st.segments) {
        const sx = seg.col * CELL + CELL / 2, sy = seg.row * CELL + CELL / 2;
        ctx.fillStyle = seg.head ? "#ff8a3d" : "#7fd650";
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(sx - 2, sy - 2, 3, 0, Math.PI * 2); ctx.fill();
        if (seg.head) {
          ctx.fillStyle = "#1a0e0a";
          ctx.beginPath(); ctx.arc(sx - 3, sy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(sx + 3, sy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Bullets
      ctx.fillStyle = "#ffd060";
      for (const b of st.bullets) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 8);

      // Particles
      for (const p of st.particles) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
      ctx.globalAlpha = 1;

      // Player (gnome shooter)
      if (st.invuln === 0 || Math.floor(frame / 4) % 2 === 0) {
        ctx.fillStyle = "#5fc8e0"; ctx.fillRect(st.px - 8, st.py - 4, 16, 10);
        ctx.fillStyle = "#3a96b4"; ctx.fillRect(st.px - 8, st.py + 4, 16, 2);
        ctx.fillStyle = "#ffd060"; ctx.fillRect(st.px - 2, st.py - 11, 4, 6);
      }

      // Player zone bound line
      ctx.strokeStyle = "rgba(95,200,224,0.2)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(0, PLAYER_TOP_ZONE * CELL); ctx.lineTo(WIDTH, PLAYER_TOP_ZONE * CELL); ctx.stroke(); ctx.setLineDash([]);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawnParts = (st: typeof s.current, x: number, y: number, color: string, n: number) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const sp = 1 + Math.random() * 3; st.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 22, maxLife: 22, color }); }
  };

  const stepSegments = (st: typeof s.current) => {
    for (const seg of st.segments) {
      if (seg.descending) {
        seg.row++; seg.descending = false; seg.dir = -seg.dir as 1 | -1;
        if (seg.row >= ROWS) seg.row = 0; // wrap from bottom (rare, classic)
        continue;
      }
      const newCol = seg.col + seg.dir;
      // Hit wall or mushroom → descend next tick
      const blocked = newCol < 0 || newCol >= COLS || mushroomAt(st, newCol, seg.row);
      if (blocked) { seg.descending = true; }
      else seg.col = newCol;
    }
  };

  const playerHit = (st: typeof s.current) => {
    st.lives--; setLives(st.lives);
    spawnParts(st, st.px, st.py, "#5fc8e0", 18);
    st.invuln = 90;
    if (st.lives <= 0) {
      st.running = false;
      const final = st.score;
      if (final > highScore) { setHighScore(final); localStorage.setItem("centipede-high", String(final)); }
      hostRef.current.reportScore(final);
      setOver(true);
    } else {
      // Push centipede back up slightly so player can recover
      for (const seg of st.segments) seg.row = Math.max(0, seg.row - 1);
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = true;
      if (e.code === "ArrowUp" || e.code === "KeyW") s.current.up = true;
      if (e.code === "ArrowDown" || e.code === "KeyS") s.current.down = true;
      if (e.code === "Space") { e.preventDefault(); s.current.firing = true; if (!started || over) start(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = false;
      if (e.code === "ArrowUp" || e.code === "KeyW") s.current.up = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") s.current.down = false;
      if (e.code === "Space") s.current.firing = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, over]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[500px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-x-3 gap-y-1">
        <span><span className="text-[var(--muted)]">WAVE </span><span className="text-[var(--crt-green)]">{wave}</span></span>
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--foreground)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#5fc8e0]">{"♦".repeat(lives)}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[500px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || over) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">{over ? "EATEN BY BUGS" : "CENTIPEDE"}</h2>
            {over && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE <span className="text-[var(--accent)]">{score}</span></p>}
            {over && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={start} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{over ? "PLAY AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">Arrow keys / WASD to move · SPACE to fire<br />Heads = 100 pts. Splits make more heads!</p>
          </div>
        )}
      </div>

      <div className="sm:hidden grid grid-cols-3 gap-2">
        <div /><button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onTouchStart={() => (s.current.up = true)} onTouchEnd={() => (s.current.up = false)}>▲</button><div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onTouchStart={() => (s.current.left = true)} onTouchEnd={() => (s.current.left = false)}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--accent)] text-[var(--background)] rounded" onTouchStart={() => (s.current.firing = true)} onTouchEnd={() => (s.current.firing = false)}>FIRE</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onTouchStart={() => (s.current.right = true)} onTouchEnd={() => (s.current.right = false)}>▶</button>
      </div>
    </div>
  );
}
