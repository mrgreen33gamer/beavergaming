"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 640;
const HEIGHT = 480;
const GROUND_Y = HEIGHT - 30;
const CITY_W = 36;
const CITY_H = 22;
const NUM_CITIES = 6;
const NUM_BATTERIES = 3;
const AMMO_PER_BATTERY = 10;
const INTERCEPT_SPEED = 6;
const BLAST_RADIUS = 36;
const BLAST_DURATION = 38;

type Missile = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; alive: boolean; trail: { x: number; y: number }[] };
type Intercept = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; alive: boolean; trail: { x: number; y: number }[] };
type Blast = { x: number; y: number; t: number };
type City = { x: number; alive: boolean };
type Battery = { x: number; ammo: number };

export default function MissileCommand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [cities, setCities] = useState(NUM_CITIES);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [waveTransition, setWaveTransition] = useState(false);

  const s = useRef({
    cities: [] as City[],
    batteries: [] as Battery[],
    missiles: [] as Missile[],
    intercepts: [] as Intercept[],
    blasts: [] as Blast[],
    spawnTimer: 0,
    spawnsRemaining: 0,
    wave: 1,
    score: 0,
    running: false,
    waveCleared: false,
    stars: [] as { x: number; y: number; tw: number }[],
    lastSync: 0,
  });

  useEffect(() => {
    const h = localStorage.getItem("missilecmd-high");
    if (h) setHighScore(parseInt(h, 10));
    const st = s.current;
    for (let i = 0; i < 50; i++) st.stars.push({ x: Math.random() * WIDTH, y: Math.random() * (HEIGHT * 0.6), tw: Math.random() * Math.PI * 2 });
  }, []);

  const setupCities = () => {
    const xs: City[] = [];
    const sectorW = WIDTH / NUM_CITIES;
    for (let i = 0; i < NUM_CITIES; i++) xs.push({ x: sectorW * (i + 0.5), alive: true });
    return xs;
  };
  const setupBatteries = (): Battery[] => {
    return [
      { x: 60, ammo: AMMO_PER_BATTERY },
      { x: WIDTH / 2, ammo: AMMO_PER_BATTERY },
      { x: WIDTH - 60, ammo: AMMO_PER_BATTERY },
    ];
  };

  const startGame = () => {
    const st = s.current;
    st.cities = setupCities();
    st.batteries = setupBatteries();
    st.missiles = []; st.intercepts = []; st.blasts = [];
    st.wave = 1; st.score = 0;
    st.running = true;
    startWave(st);
    setWave(1); setScore(0); setCities(NUM_CITIES); setOver(false); setStarted(true);
  };

  const startWave = (st: typeof s.current) => {
    // Refill batteries each wave
    for (const b of st.batteries) b.ammo = AMMO_PER_BATTERY;
    st.spawnsRemaining = 6 + st.wave * 2;
    st.spawnTimer = 30;
    st.waveCleared = false;
    setWaveTransition(true);
    setTimeout(() => setWaveTransition(false), 1200);
  };

  const spawnMissile = (st: typeof s.current) => {
    const fromX = Math.random() * WIDTH;
    // Aim at a remaining city or battery
    const targets: { x: number; y: number }[] = [];
    for (const c of st.cities) if (c.alive) targets.push({ x: c.x, y: GROUND_Y - CITY_H / 2 });
    for (const b of st.batteries) if (b.ammo > 0) targets.push({ x: b.x, y: GROUND_Y });
    if (!targets.length) targets.push({ x: WIDTH / 2, y: GROUND_Y });
    const tgt = targets[Math.floor(Math.random() * targets.length)];
    const speed = 0.6 + Math.min(2.2, st.wave * 0.18);
    const angle = Math.atan2(tgt.y, tgt.x - fromX);
    st.missiles.push({
      x: fromX, y: -10, tx: tgt.x, ty: tgt.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      alive: true, trail: [],
    });
  };

  const fireIntercept = (st: typeof s.current, tx: number, ty: number) => {
    // Pick the closest battery with ammo
    let best: Battery | null = null; let bd = Infinity;
    for (const b of st.batteries) {
      if (b.ammo <= 0) continue;
      const d = Math.abs(b.x - tx);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return false;
    best.ammo--;
    const sx = best.x, sy = GROUND_Y - 4;
    const angle = Math.atan2(ty - sy, tx - sx);
    st.intercepts.push({
      x: sx, y: sy, tx, ty,
      vx: Math.cos(angle) * INTERCEPT_SPEED, vy: Math.sin(angle) * INTERCEPT_SPEED,
      alive: true, trail: [],
    });
    return true;
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
        // Spawn missiles
        if (st.spawnsRemaining > 0) {
          st.spawnTimer--;
          if (st.spawnTimer <= 0) {
            const interval = Math.max(20, 80 - st.wave * 5);
            st.spawnTimer = interval + Math.random() * 30;
            spawnMissile(st);
            st.spawnsRemaining--;
          }
        }

        // Update missiles
        for (const m of st.missiles) {
          if (!m.alive) continue;
          m.trail.push({ x: m.x, y: m.y }); if (m.trail.length > 60) m.trail.shift();
          m.x += m.vx; m.y += m.vy;
          // Hit ground/target
          if (m.y >= m.ty || m.y >= GROUND_Y - 2) {
            m.alive = false;
            // Damage cities/batteries near impact
            for (const c of st.cities) if (c.alive && Math.abs(c.x - m.x) < CITY_W / 2 + 4) c.alive = false;
            for (const b of st.batteries) if (b.ammo > 0 && Math.abs(b.x - m.x) < 24) b.ammo = 0;
            st.blasts.push({ x: m.x, y: m.y, t: 0 });
            // Ground spurt
          }
          // Hit by a blast?
          for (const bl of st.blasts) {
            if (bl.t > BLAST_DURATION) continue;
            if (Math.hypot(bl.x - m.x, bl.y - m.y) < currentBlastRadius(bl)) {
              m.alive = false;
              st.blasts.push({ x: m.x, y: m.y, t: 0 });
              st.score += 25;
              break;
            }
          }
        }
        st.missiles = st.missiles.filter((m) => m.alive || m.trail.length > 0);

        // Update intercepts
        for (const i of st.intercepts) {
          if (!i.alive) continue;
          i.trail.push({ x: i.x, y: i.y }); if (i.trail.length > 40) i.trail.shift();
          i.x += i.vx; i.y += i.vy;
          if (Math.hypot(i.x - i.tx, i.y - i.ty) < 8 || i.y < 0 || i.x < 0 || i.x > WIDTH) {
            i.alive = false;
            st.blasts.push({ x: i.x, y: i.y, t: 0 });
          }
        }
        st.intercepts = st.intercepts.filter((i) => i.alive);

        // Update blasts
        for (const bl of st.blasts) bl.t++;
        st.blasts = st.blasts.filter((bl) => bl.t <= BLAST_DURATION);

        // Check wave clear
        if (!st.waveCleared && st.spawnsRemaining === 0 && st.missiles.length === 0 && st.intercepts.length === 0) {
          st.waveCleared = true;
          // Bonus per surviving city + ammo
          const cityBonus = st.cities.filter((c) => c.alive).length * 100;
          const ammoBonus = st.batteries.reduce((a, b) => a + b.ammo * 5, 0);
          st.score += cityBonus + ammoBonus;
          setTimeout(() => {
            if (st.cities.every((c) => !c.alive)) { endGame(st); return; }
            st.wave++; setWave(st.wave); startWave(st);
          }, 1200);
        }

        // Lose check
        if (st.cities.every((c) => !c.alive)) endGame(st);

        // Sync HUD
        if (frame - st.lastSync >= 4) {
          st.lastSync = frame;
          setScore(st.score);
          setCities(st.cities.filter((c) => c.alive).length);
        }
      }

      // ===== DRAW =====
      const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      g.addColorStop(0, "#080612"); g.addColorStop(1, "#1a0f2a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, GROUND_Y);
      for (const star of st.stars) { const a = 0.3 + Math.abs(Math.sin(frame * 0.04 + star.tw)) * 0.5; ctx.fillStyle = `rgba(220,225,255,${a})`; ctx.fillRect(star.x, star.y, 1.5, 1.5); }

      // Ground
      ctx.fillStyle = "#3a2218"; ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
      ctx.fillStyle = "#4a2e1f"; ctx.fillRect(0, GROUND_Y, WIDTH, 3);

      // Cities
      for (const c of st.cities) {
        if (!c.alive) {
          // rubble
          ctx.fillStyle = "#5a3a22"; ctx.fillRect(c.x - CITY_W / 2, GROUND_Y - 5, CITY_W, 5);
          continue;
        }
        ctx.fillStyle = "#5fc8e0";
        ctx.fillRect(c.x - CITY_W / 2, GROUND_Y - CITY_H, CITY_W, CITY_H);
        ctx.fillStyle = "#3a96b4"; ctx.fillRect(c.x - CITY_W / 2, GROUND_Y - 4, CITY_W, 4);
        // windows
        ctx.fillStyle = "#ffd060";
        for (let wx = -CITY_W / 2 + 4; wx < CITY_W / 2 - 4; wx += 6) ctx.fillRect(c.x + wx, GROUND_Y - CITY_H + 5, 3, 4);
        for (let wx = -CITY_W / 2 + 4; wx < CITY_W / 2 - 4; wx += 6) ctx.fillRect(c.x + wx, GROUND_Y - CITY_H + 12, 3, 4);
      }

      // Batteries
      for (const b of st.batteries) {
        const dead = b.ammo === 0;
        ctx.fillStyle = dead ? "#5a3a22" : "#7fd650";
        ctx.fillRect(b.x - 14, GROUND_Y - 8, 28, 8);
        ctx.fillStyle = dead ? "#3a2218" : "#5a9628";
        ctx.fillRect(b.x - 3, GROUND_Y - 16, 6, 8);
        // Ammo stacks
        if (!dead) {
          ctx.fillStyle = "#fff";
          for (let i = 0; i < b.ammo; i++) {
            const col = i % 3, row = (i / 3) | 0;
            ctx.fillRect(b.x - 12 + col * 5, GROUND_Y - 22 - row * 4, 3, 3);
          }
        }
      }

      // Missile trails
      ctx.strokeStyle = "#ff5050"; ctx.lineWidth = 1.5;
      for (const m of st.missiles) {
        if (m.trail.length < 2) continue;
        ctx.beginPath();
        for (let k = 0; k < m.trail.length; k++) { const t = m.trail[k]; if (k === 0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y); }
        ctx.stroke();
        if (m.alive) {
          ctx.fillStyle = "#fff"; ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
        }
      }

      // Intercept trails
      ctx.strokeStyle = "#7fd650"; ctx.lineWidth = 1.5;
      for (const i of st.intercepts) {
        if (i.trail.length < 2) continue;
        ctx.beginPath();
        for (let k = 0; k < i.trail.length; k++) { const t = i.trail[k]; if (k === 0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y); }
        ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.fillRect(i.x - 2, i.y - 2, 4, 4);
        // target dot
        ctx.strokeStyle = "rgba(127,214,80,0.5)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(i.tx - 4, i.ty); ctx.lineTo(i.tx + 4, i.ty); ctx.moveTo(i.tx, i.ty - 4); ctx.lineTo(i.tx, i.ty + 4); ctx.stroke();
        ctx.strokeStyle = "#7fd650"; ctx.lineWidth = 1.5;
      }

      // Blasts (filled radial)
      for (const bl of st.blasts) {
        const r = currentBlastRadius(bl);
        if (r < 0.5) continue;
        const grad = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, r);
        grad.addColorStop(0, "rgba(255,255,200,0.85)");
        grad.addColorStop(0.5, "rgba(255,140,40,0.6)");
        grad.addColorStop(1, "rgba(255,40,40,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(bl.x, bl.y, r, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endGame = (st: typeof s.current) => {
    st.running = false;
    const final = st.score; setScore(final);
    if (final > highScore) { setHighScore(final); localStorage.setItem("missilecmd-high", String(final)); }
    setOver(true);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = s.current;
    if (!st.running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
    if (y < GROUND_Y - 6) fireIntercept(st, x, y);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[640px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-x-3 gap-y-1">
        <span><span className="text-[var(--muted)]">WAVE </span><span className="text-[var(--crt-green)]">{wave}</span></span>
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--foreground)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">CITIES </span><span className="text-[#5fc8e0]">{"●".repeat(cities)}<span className="text-[#3a2818]">{"●".repeat(NUM_CITIES - cities)}</span></span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[640px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onClick={onClick}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-crosshair" />
        {waveTransition && !over && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded pointer-events-none">
            <span className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)]">WAVE {wave}</span>
          </div>
        )}
        {(!started || over) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-2">{over ? "CITIES LOST" : "MISSILE COMMAND"}</h2>
            {over && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE <span className="text-[var(--accent)]">{score}</span></p>}
            {over && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-1">survived {wave - 1} wave{wave === 2 ? "" : "s"}</p>}
            {over && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={startGame} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{over ? "DEFEND AGAIN" : "DEPLOY"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">Click anywhere in the sky to launch an interceptor.<br />Closest battery with ammo fires.</p>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md leading-snug">
        Click in the sky to detonate an interceptor where you clicked. Catch missiles in your blast radius before they hit your six cities — lose them all and it&apos;s over.
      </p>
    </div>
  );
}

function currentBlastRadius(bl: { t: number }): number {
  if (bl.t <= 12) return (bl.t / 12) * BLAST_RADIUS;
  return BLAST_RADIUS * (1 - (bl.t - 12) / (BLAST_DURATION - 12)) * 0.9 + 4;
}
