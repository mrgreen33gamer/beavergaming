"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 440;
const GRAVITY = 0.06;
const THRUST = 0.16;
const ROT_SPEED = 0.045;
const FUEL_MAX = 700;
const SAFE_VY = 1.4;
const SAFE_VX = 0.8;
const SAFE_ANGLE = 0.25;

type Segment = { x1: number; y1: number; x2: number; y2: number; flat: boolean; mult: number };

function generateTerrain(level: number): Segment[] {
  const segs: Segment[] = [];
  const points: { x: number; y: number; flat: boolean; mult: number }[] = [];
  let x = 0;
  let y = HEIGHT - 80;
  points.push({ x, y, flat: false, mult: 0 });
  // 3-4 landing pads scattered, varying multiplier
  const padCount = 3;
  const padMults = level >= 3 ? [2, 3, 5] : [1, 2, 3];
  const padPositions = Array.from({ length: padCount }, (_, i) => Math.floor(WIDTH * (0.18 + i * 0.28) + (Math.random() * 40 - 20)));
  while (x < WIDTH) {
    const step = 18 + Math.random() * 22;
    x += step;
    if (x > WIDTH) x = WIDTH;
    // Check if near a pad
    const padIdx = padPositions.findIndex((px) => Math.abs(px - x) < 30);
    if (padIdx >= 0 && !points[points.length - 1]?.flat) {
      const padX = padPositions[padIdx];
      const padW = padIdx === 0 ? 80 : padIdx === 1 ? 60 : 42;
      const padY = HEIGHT - 50 - Math.random() * 90;
      points.push({ x: padX - padW / 2, y: padY, flat: false, mult: 0 });
      points.push({ x: padX + padW / 2, y: padY, flat: true, mult: padMults[padIdx] });
      x = padX + padW / 2;
      continue;
    }
    y = Math.max(HEIGHT - 280, Math.min(HEIGHT - 30, y + (Math.random() - 0.5) * 70));
    points.push({ x, y, flat: false, mult: 0 });
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, flat: b.flat, mult: b.flat ? b.mult : 0 });
  }
  return segs;
}

export default function LunarLander() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [fuel, setFuel] = useState(FUEL_MAX);
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<"play" | "landed" | "crashed">("play");
  const [started, setStarted] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  const s = useRef({
    x: WIDTH / 2, y: 40, vx: 0, vy: 0, angle: 0, fuel: FUEL_MAX,
    keys: { left: false, right: false, up: false },
    terrain: [] as Segment[],
    running: false,
    score: 0, level: 1,
    flameFlicker: 0,
    debris: [] as { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[],
    stars: [] as { x: number; y: number; tw: number }[],
  });

  useEffect(() => {
    const saved = localStorage.getItem("lander-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
    const st = s.current;
    for (let i = 0; i < 50; i++) st.stars.push({ x: Math.random() * WIDTH, y: Math.random() * (HEIGHT * 0.7), tw: Math.random() * Math.PI * 2 });
  }, []);

  const reset = (lv: number) => {
    const st = s.current;
    st.x = WIDTH / 2 - 100 + Math.random() * 200; st.y = 40;
    st.vx = (Math.random() - 0.5) * 1.2; st.vy = 0; st.angle = 0;
    st.fuel = FUEL_MAX - (lv - 1) * 50;
    st.terrain = generateTerrain(lv);
    st.running = true;
    st.level = lv;
    st.debris = [];
    setFuel(st.fuel); setLevel(lv); setStatus("play"); setStarted(true);
  };

  const beginGame = () => {
    const st = s.current;
    st.score = 0;
    setScore(0);
    reset(1);
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
        if (st.keys.left) st.angle -= ROT_SPEED;
        if (st.keys.right) st.angle += ROT_SPEED;
        const thrusting = st.keys.up && st.fuel > 0;
        if (thrusting) {
          st.vx += Math.sin(st.angle) * THRUST;
          st.vy -= Math.cos(st.angle) * THRUST;
          st.fuel = Math.max(0, st.fuel - 2);
        }
        st.vy += GRAVITY;
        st.x += st.vx; st.y += st.vy;
        st.flameFlicker = thrusting ? (Math.random() * 0.5 + 0.5) : 0;

        // Wrap horizontally
        if (st.x < -20) st.x = WIDTH + 20;
        if (st.x > WIDTH + 20) st.x = -20;

        // Collide with terrain
        for (const seg of st.terrain) {
          // Find y at lander's x along this segment
          if (st.x >= Math.min(seg.x1, seg.x2) && st.x <= Math.max(seg.x1, seg.x2)) {
            const t = (st.x - seg.x1) / (seg.x2 - seg.x1 || 1);
            const ty = seg.y1 + (seg.y2 - seg.y1) * t;
            if (st.y + 10 >= ty) {
              // Touch!
              const goodLanding = seg.flat && Math.abs(st.vy) <= SAFE_VY && Math.abs(st.vx) <= SAFE_VX && Math.abs(st.angle) <= SAFE_ANGLE;
              if (goodLanding) {
                st.running = false;
                const speed = Math.hypot(st.vx, st.vy);
                const fuelBonus = Math.floor(st.fuel * 0.5);
                const padBonus = Math.floor(100 * seg.mult * (1 + (10 - Math.min(10, speed * 5))));
                const total = padBonus + fuelBonus;
                st.score += total;
                setScore(st.score);
                if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("lander-highscore", String(st.score)); }
                setResultMsg(`x${seg.mult} pad — pad ${padBonus}, fuel +${fuelBonus}`);
                setStatus("landed");
              } else {
                // Crash
                st.running = false;
                for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2; const sp = 1 + Math.random() * 4; st.debris.push({ x: st.x, y: st.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 50, maxLife: 50 }); }
                setResultMsg(seg.flat ? "Too rough! Slow down next time" : "Crashed on rough terrain");
                setStatus("crashed");
                if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("lander-highscore", String(st.score)); }
              }
              break;
            }
          }
        }
        setFuel(st.fuel);
      }

      // Debris
      let w = 0;
      for (let i = 0; i < st.debris.length; i++) { const p = st.debris[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; if (p.life > 0) { if (w !== i) st.debris[w] = p; w++; } }
      st.debris.length = w;

      // ===== DRAW =====
      // Space background
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, "#06070f"); g.addColorStop(1, "#0c0e1e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      for (const star of st.stars) { const a = 0.4 + Math.abs(Math.sin(frame * 0.04 + star.tw)) * 0.5; ctx.fillStyle = `rgba(220,225,255,${a})`; ctx.fillRect(star.x, star.y, 1.5, 1.5); }

      // Terrain
      ctx.strokeStyle = "#b8a088"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < st.terrain.length; i++) { const seg = st.terrain[i]; if (i === 0) ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); }
      ctx.stroke();
      // Fill below terrain
      ctx.fillStyle = "#1a1410";
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (const seg of st.terrain) ctx.lineTo(seg.x1, seg.y1);
      const last = st.terrain[st.terrain.length - 1];
      if (last) ctx.lineTo(last.x2, last.y2);
      ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();
      // Pads highlighted
      for (const seg of st.terrain) {
        if (!seg.flat) continue;
        ctx.fillStyle = "#7fd650"; ctx.fillRect(seg.x1, seg.y1 - 3, seg.x2 - seg.x1, 4);
        ctx.fillStyle = "#1a0e0a"; ctx.font = "10px monospace"; ctx.textAlign = "center";
        ctx.fillText(`x${seg.mult}`, (seg.x1 + seg.x2) / 2, seg.y1 - 6); ctx.textAlign = "start";
      }

      // Debris
      for (const p of st.debris) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = "#ff8a3d"; ctx.fillRect(p.x - 2, p.y - 2, 3, 3); }
      ctx.globalAlpha = 1;

      // Lander
      if (status !== "crashed") {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(st.angle);
        // body
        ctx.fillStyle = "#c0c8d0"; ctx.fillRect(-8, -10, 16, 14);
        ctx.fillStyle = "#7a8a9a"; ctx.fillRect(-8, -10, 16, 4);
        // legs
        ctx.strokeStyle = "#c0c8d0"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-12, 12); ctx.moveTo(6, 4); ctx.lineTo(12, 12); ctx.stroke();
        // feet
        ctx.fillStyle = "#c0c8d0"; ctx.fillRect(-14, 11, 5, 2); ctx.fillRect(9, 11, 5, 2);
        // window
        ctx.fillStyle = "#5fc8e0"; ctx.fillRect(-4, -6, 8, 5);
        // flame
        if (st.flameFlicker > 0) {
          ctx.fillStyle = "#ffd060";
          ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(0, 12 + st.flameFlicker * 10); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#ff6b1a";
          ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(0, 8 + st.flameFlicker * 7); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }

      // HUD (velocity indicator)
      const speed = Math.hypot(st.vx, st.vy);
      const safe = speed <= SAFE_VY && Math.abs(st.vx) <= SAFE_VX && Math.abs(st.angle) <= SAFE_ANGLE;
      ctx.fillStyle = safe ? "#7fd650" : "#d63d3d";
      ctx.font = "11px monospace";
      ctx.fillText(`SPD ${speed.toFixed(2)}`, 10, 18);
      ctx.fillText(`ANG ${(st.angle * 180 / Math.PI).toFixed(0)}°`, 10, 32);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.keys.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.keys.right = true;
      if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") { e.preventDefault(); s.current.keys.up = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.keys.right = false;
      if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") s.current.keys.up = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--foreground)]">{level}</span></span>
        <span className="flex items-center gap-2"><span className="text-[var(--muted)]">FUEL</span>
          <span className="inline-block w-24 h-2.5 bg-[var(--surface-2)] rounded overflow-hidden border border-[var(--border)]">
            <span className="block h-full" style={{ width: `${(fuel / FUEL_MAX) * 100}%`, background: fuel > 200 ? "#7fd650" : "#d63d3d" }} />
          </span>
        </span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full rounded border-2 border-[var(--border)]" />
        {(!started || status !== "play") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-2">
              {!started ? "LUNAR LANDER" : status === "landed" ? "EAGLE HAS LANDED" : "CRASHED"}
            </h2>
            {status === "landed" && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--crt-green)] mb-1">{resultMsg}</p>}
            {status === "crashed" && <p className="font-[family-name:var(--font-mono)] text-base text-[#d63d3d] mb-1">{resultMsg}</p>}
            {started && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-2">SCORE <span className="text-[var(--accent)]">{score}</span></p>}
            <button
              onClick={() => { if (!started) beginGame(); else if (status === "landed") reset(level + 1); else beginGame(); }}
              className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
            >
              {!started ? "LAUNCH" : status === "landed" ? "NEXT LANDING →" : "TRY AGAIN"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">← → rotate · ↑/SPACE thrust<br />Land flat &amp; slow on a green pad</p>
          </div>
        )}
      </div>

      <div className="sm:hidden grid grid-cols-3 gap-2 mt-2">
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded text-xl" onTouchStart={() => (s.current.keys.left = true)} onTouchEnd={() => (s.current.keys.left = false)}>↺</button>
        <button className="pixel-edge p-3 bg-[var(--accent)] text-[var(--background)] rounded" onTouchStart={() => (s.current.keys.up = true)} onTouchEnd={() => (s.current.keys.up = false)}>▲</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded text-xl" onTouchStart={() => (s.current.keys.right = true)} onTouchEnd={() => (s.current.keys.right = false)}>↻</button>
      </div>
    </div>
  );
}
