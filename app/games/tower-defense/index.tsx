"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const TILE = 40;
const COLS = 15;
const ROWS = 10;
const WIDTH = COLS * TILE;  // 600
const HEIGHT = ROWS * TILE; // 400
const TOWER_COST = 50;

// Path as grid waypoints (col,row). Enemies walk center-to-center.
const PATH: { c: number; r: number }[] = [
  { c: -1, r: 1 }, { c: 3, r: 1 }, { c: 3, r: 5 }, { c: 7, r: 5 },
  { c: 7, r: 2 }, { c: 11, r: 2 }, { c: 11, r: 8 }, { c: 3, r: 8 },
  { c: 3, r: 7 }, { c: -1, r: 7 },
];

type Tower = { c: number; r: number; cooldown: number; range: number; dmg: number };
type Enemy = { seg: number; t: number; x: number; y: number; hp: number; maxHp: number; speed: number };
type Bullet = { x: number; y: number; tx: number; ty: number; target: Enemy | null };

// Build set of path tiles for blocking placement
const pathTiles = new Set<string>();
(() => {
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const dc = Math.sign(b.c - a.c), dr = Math.sign(b.r - a.r);
    let c = a.c, r = a.r;
    pathTiles.add(`${c},${r}`);
    while (c !== b.c || r !== b.r) { c += dc; r += dr; pathTiles.add(`${c},${r}`); }
  }
})();

export default function TowerDefense() {
  // Ref'd because the death handler runs inside the canvas loop, which closes
  // over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("tower-defense");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [money, setMoney] = useState(150);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [waveActive, setWaveActive] = useState(false);

  const s = useRef({
    towers: [] as Tower[],
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    money: 150,
    lives: 20,
    wave: 0,
    score: 0,
    toSpawn: 0,
    spawnTimer: 0,
    waveActive: false,
    running: true,
    hoverC: -1, hoverR: -1,
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("td-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const pathPx = (seg: number, t: number) => {
    const a = PATH[seg], b = PATH[seg + 1];
    const ax = a.c * TILE + TILE / 2, ay = a.r * TILE + TILE / 2;
    const bx = b.c * TILE + TILE / 2, by = b.r * TILE + TILE / 2;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
  };

  const startWave = () => {
    const st = s.current;
    if (st.waveActive || !st.running) return;
    st.wave += 1;
    st.toSpawn = 5 + st.wave * 2;
    st.waveActive = true;
    setWave(st.wave);
    setWaveActive(true);
  };

  const reset = () => {
    const st = s.current;
    st.towers = []; st.enemies = []; st.bullets = [];
    st.money = 150; st.lives = 20; st.wave = 0; st.score = 0;
    st.toSpawn = 0; st.spawnTimer = 0; st.waveActive = false;
    st.running = true;
    setMoney(150); setLives(20); setWave(0); setScore(0);
    setGameOver(false); setWaveActive(false);
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
        // Spawn enemies
        if (st.waveActive && st.toSpawn > 0) {
          st.spawnTimer++;
          if (st.spawnTimer >= 35) {
            st.spawnTimer = 0;
            st.toSpawn--;
            const hp = 3 + st.wave * 2;
            const start = pathPx(0, 0);
            st.enemies.push({ seg: 0, t: 0, x: start.x, y: start.y, hp, maxHp: hp, speed: 0.006 + st.wave * 0.0004 });
          }
        } else if (st.waveActive && st.enemies.length === 0) {
          st.waveActive = false;
          setWaveActive(false);
          st.money += 30; // wave clear bonus
        }

        // Move enemies
        for (const e of st.enemies) {
          e.t += e.speed;
          if (e.t >= 1) { e.t = 0; e.seg++; }
          if (e.seg >= PATH.length - 1) {
            // reached end
            e.hp = -999;
            st.lives -= 1;
            setLives(st.lives);
            if (st.lives <= 0) { die(st); }
            continue;
          }
          const p = pathPx(e.seg, e.t);
          e.x = p.x; e.y = p.y;
        }
        st.enemies = st.enemies.filter((e) => e.hp > -100);

        // Towers shoot
        for (const tw of st.towers) {
          if (tw.cooldown > 0) { tw.cooldown--; continue; }
          const tx = tw.c * TILE + TILE / 2, ty = tw.r * TILE + TILE / 2;
          let target: Enemy | null = null;
          let bestProgress = -1;
          for (const e of st.enemies) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - tx, e.y - ty);
            if (d <= tw.range) {
              const prog = e.seg + e.t;
              if (prog > bestProgress) { bestProgress = prog; target = e; }
            }
          }
          if (target) {
            tw.cooldown = 30;
            st.bullets.push({ x: tx, y: ty, tx: target.x, ty: target.y, target });
          }
        }

        // Move bullets
        for (const b of st.bullets) {
          if (b.target && b.target.hp > 0) { b.tx = b.target.x; b.ty = b.target.y; }
          const a = Math.atan2(b.ty - b.y, b.tx - b.x);
          b.x += Math.cos(a) * 8;
          b.y += Math.sin(a) * 8;
          if (Math.hypot(b.tx - b.x, b.ty - b.y) < 8) {
            if (b.target && b.target.hp > 0) {
              b.target.hp -= 2;
              if (b.target.hp <= 0) {
                st.money += 8;
                st.score += 10;
              }
            }
            b.target = null;
            b.x = -999; b.y = -999;
          }
        }
        st.bullets = st.bullets.filter((b) => b.x > -100);
        st.enemies = st.enemies.filter((e) => e.hp > 0 || e.hp < -100);
        st.enemies = st.enemies.filter((e) => e.hp > 0);

        if (frame - st.lastSync >= 5) {
          st.lastSync = frame;
          setMoney(st.money);
          setScore(st.score);
        }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#2a3a1a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Grass tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = "#324420";
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      }
      // Path
      ctx.fillStyle = "#6a4a28";
      for (const key of pathTiles) {
        const [c, r] = key.split(",").map(Number);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        ctx.fillStyle = "#7a5a34";
        ctx.fillRect(c * TILE + 3, r * TILE + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = "#6a4a28";
      }

      // Hover preview
      if (st.hoverC >= 0 && !st.waveActive) {
        const key = `${st.hoverC},${st.hoverR}`;
        const occupied = st.towers.some((t) => t.c === st.hoverC && t.r === st.hoverR);
        const valid = !pathTiles.has(key) && !occupied && st.money >= TOWER_COST;
        ctx.fillStyle = valid ? "rgba(127,214,80,0.3)" : "rgba(214,61,61,0.3)";
        ctx.fillRect(st.hoverC * TILE, st.hoverR * TILE, TILE, TILE);
        if (valid) {
          ctx.strokeStyle = "rgba(127,214,80,0.4)";
          ctx.beginPath();
          ctx.arc(st.hoverC * TILE + TILE / 2, st.hoverR * TILE + TILE / 2, 90, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Towers
      for (const tw of st.towers) {
        const tx = tw.c * TILE + TILE / 2, ty = tw.r * TILE + TILE / 2;
        ctx.fillStyle = "#5a6a7a";
        ctx.beginPath();
        ctx.arc(tx, ty, TILE / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7a8a9a";
        ctx.beginPath();
        ctx.arc(tx, ty, TILE / 2 - 9, 0, Math.PI * 2);
        ctx.fill();
        // Barrel pointing at nearest enemy
        let near: Enemy | null = null, nd = Infinity;
        for (const e of st.enemies) { const d = Math.hypot(e.x - tx, e.y - ty); if (d < nd) { nd = d; near = e; } }
        const a = near ? Math.atan2(near.y - ty, near.x - tx) : -Math.PI / 2;
        ctx.strokeStyle = "#3a4a5a";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(a) * 14, ty + Math.sin(a) * 14);
        ctx.stroke();
      }

      // Enemies
      for (const e of st.enemies) {
        if (e.hp <= 0) continue;
        ctx.fillStyle = "#d63d3d";
        ctx.beginPath();
        ctx.arc(e.x, e.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8a2020";
        ctx.fillRect(e.x - 4, e.y - 3, 3, 3);
        ctx.fillRect(e.x + 1, e.y - 3, 3, 3);
        // HP bar
        ctx.fillStyle = "#1a0e0a";
        ctx.fillRect(e.x - 11, e.y - 18, 22, 4);
        ctx.fillStyle = "#7fd650";
        ctx.fillRect(e.x - 11, e.y - 18, 22 * Math.max(0, e.hp) / e.maxHp, 4);
      }

      // Bullets
      ctx.fillStyle = "#ffd060";
      for (const b of st.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
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
    const finalScore = st.score;
    setScore(finalScore);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem("td-highscore", String(finalScore));
    }
    hostRef.current.reportScore(finalScore);
    setGameOver(true);
  };

  const cellFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = s.current;
    if (!st.running) return;
    const { c, r } = cellFromEvent(e);
    const key = `${c},${r}`;
    if (pathTiles.has(key)) return;
    if (st.towers.some((t) => t.c === c && t.r === r)) return;
    if (st.money < TOWER_COST) return;
    st.money -= TOWER_COST;
    st.towers.push({ c, r, cooldown: 0, range: 90, dmg: 2 });
    setMoney(st.money);
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { c, r } = cellFromEvent(e);
    s.current.hoverC = c; s.current.hoverR = r;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">💰 </span><span className="text-[#ffd060]">{money}</span></span>
        <span><span className="text-[var(--muted)]">❤ </span><span className="text-[#d63d3d]">{lives}</span></span>
        <span><span className="text-[var(--muted)]">WAVE </span><span className="text-[var(--foreground)]">{wave}</span></span>
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <button
          onClick={startWave}
          disabled={waveActive || gameOver}
          className="pixel-edge px-3 py-1 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs disabled:opacity-40"
        >
          {waveActive ? "WAVE…" : "START WAVE"}
        </button>
      </div>

      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-pointer"
          onClick={onClick}
          onMouseMove={onMove}
          onMouseLeave={() => { s.current.hoverC = -1; }}
        />
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">BASE OVERRUN</h2>
            <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span> · WAVE {wave}</p>
            {score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">TRY AGAIN</button>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click any grass tile to build a tower (💰{TOWER_COST}). Towers auto-fire at enemies in range.
        Earn gold per kill + a wave-clear bonus. Don&apos;t let 20 enemies reach the exit.
      </p>
    </div>
  );
}
