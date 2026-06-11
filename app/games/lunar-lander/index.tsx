"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 460;
const GRAVITY = 0.06;
const THRUST = 0.16;
const SIDE_THRUST = 0.07;
const ROT_SPEED = 0.045;
const FUEL_MAX = 700;
const SAFE_VY = 1.5;
const SAFE_VX = 0.9;
const SAFE_ANGLE = 0.22;

type Segment = { x1: number; y1: number; x2: number; y2: number; flat: boolean; mult: number };
type Asteroid = { x: number; y: number; vx: number; vy: number; r: number; spin: number; angle: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type Star = { x: number; y: number; tw: number; bright: number };

// Generate terrain WITH guaranteed non-overlapping pads.
// Each pad has a multiplier; harder levels get tighter pads and bigger multipliers.
function generateTerrain(level: number): Segment[] {
  // Decide pad count and sizes from level
  const padCount = level >= 5 ? 4 : 3;
  // Multipliers: easy pads are wide & low, hard pads are narrow & high. Mult = inverse of width.
  type PadSpec = { centerX: number; width: number; y: number; mult: number };
  const padSpecs: PadSpec[] = [];

  // Spread pad centers across the screen with margins
  const margin = 60;
  const usable = WIDTH - margin * 2;
  for (let i = 0; i < padCount; i++) {
    const centerX = margin + ((i + 0.5) / padCount) * usable + (Math.random() - 0.5) * 20;
    // Width tiers: easiest = 80, then 60, 42, 30
    const widths = [80, 60, 42, 30];
    const mults  = [1, 2, 3, 5];
    // Shuffle the difficulty assignment so harder pads aren't always in the same spot
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, padCount);
    const tier = order[i];
    const widthAdj = Math.max(24, widths[tier] - (level - 1) * 3);
    const padY = HEIGHT - 60 - Math.random() * 90 - (mults[tier] >= 3 ? 30 : 0);
    padSpecs.push({ centerX, width: widthAdj, y: padY, mult: mults[tier] });
  }
  // Sort pads left-to-right
  padSpecs.sort((a, b) => a.centerX - b.centerX);

  // Build terrain points: walk left to right, hitting each pad in order
  const points: { x: number; y: number; flat: boolean; mult: number }[] = [];
  let x = 0;
  let y = HEIGHT - 80 + (Math.random() - 0.5) * 40;
  points.push({ x, y, flat: false, mult: 0 });

  for (const pad of padSpecs) {
    const padLeft = pad.centerX - pad.width / 2;
    const padRight = pad.centerX + pad.width / 2;
    // Walk rough terrain until we reach padLeft
    while (x < padLeft - 25) {
      const step = 18 + Math.random() * 22;
      x = Math.min(padLeft - 5, x + step);
      const swing = (Math.random() - 0.5) * 80;
      // Keep peaks taller for higher levels
      const maxClimb = level >= 4 ? 200 : 280;
      y = Math.max(HEIGHT - maxClimb, Math.min(HEIGHT - 30, y + swing));
      points.push({ x, y, flat: false, mult: 0 });
    }
    // Approach ramp to pad
    points.push({ x: padLeft, y: pad.y, flat: false, mult: 0 });
    // Pad itself (flat segment)
    points.push({ x: padRight, y: pad.y, flat: true, mult: pad.mult });
    x = padRight;
  }
  // Trail off to the right edge
  while (x < WIDTH) {
    const step = 18 + Math.random() * 22;
    x = Math.min(WIDTH, x + step);
    y = Math.max(HEIGHT - 250, Math.min(HEIGHT - 30, y + (Math.random() - 0.5) * 70));
    points.push({ x, y, flat: false, mult: 0 });
  }

  // Convert to segments
  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, flat: b.flat, mult: b.flat ? b.mult : 0 });
  }
  return segs;
}

function spawnAsteroids(level: number): Asteroid[] {
  if (level < 5) return [];
  const count = Math.min(5, level - 4);
  const list: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = Math.random() < 0.5;
    list.push({
      x: fromLeft ? -30 : WIDTH + 30,
      y: 40 + Math.random() * (HEIGHT * 0.45),
      vx: (fromLeft ? 1 : -1) * (0.6 + Math.random() * 0.6),
      vy: (Math.random() - 0.5) * 0.4,
      r: 9 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.06,
      angle: Math.random() * Math.PI * 2,
    });
  }
  return list;
}

function pickWind(level: number): number {
  if (level < 3) return 0;
  const max = 0.015 + (level - 3) * 0.005;
  return (Math.random() < 0.5 ? -1 : 1) * (0.005 + Math.random() * max);
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
    keys: { left: false, right: false, up: false, sideL: false, sideR: false },
    terrain: [] as Segment[],
    asteroids: [] as Asteroid[],
    running: false,
    score: 0, level: 1,
    wind: 0,
    flameFlicker: 0,
    debris: [] as Particle[],
    exhaust: [] as Particle[],
    dust: [] as Particle[],
    stars: [] as Star[],
    landingFlash: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("lander-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
    const st = s.current;
    if (st.stars.length === 0) {
      for (let i = 0; i < 80; i++) {
        st.stars.push({
          x: Math.random() * WIDTH,
          y: Math.random() * (HEIGHT * 0.75),
          tw: Math.random() * Math.PI * 2,
          bright: Math.random() < 0.15 ? 1 : Math.random() * 0.6 + 0.2,
        });
      }
    }
  }, []);

  const resetLevel = (lv: number) => {
    const st = s.current;
    st.x = WIDTH / 2 - 120 + Math.random() * 240;
    st.y = 40;
    st.vx = (Math.random() - 0.5) * 1.2;
    st.vy = 0;
    st.angle = 0;
    // Fuel budget gets tighter at higher levels but doesn't crater
    st.fuel = Math.max(280, FUEL_MAX - (lv - 1) * 40);
    st.terrain = generateTerrain(lv);
    st.asteroids = spawnAsteroids(lv);
    st.wind = pickWind(lv);
    st.running = true;
    st.level = lv;
    st.debris = [];
    st.exhaust = [];
    st.dust = [];
    st.landingFlash = 0;
    setFuel(st.fuel); setLevel(lv); setStatus("play"); setStarted(true);
  };

  const beginGame = () => {
    const st = s.current;
    st.score = 0;
    setScore(0);
    resetLevel(1);
  };

  // Find the closest landing pad below the lander
  const findClosestPadX = (st: typeof s.current): { cx: number; cy: number; dist: number; mult: number } | null => {
    let best: { cx: number; cy: number; dist: number; mult: number } | null = null;
    for (const seg of st.terrain) {
      if (!seg.flat) continue;
      const cx = (seg.x1 + seg.x2) / 2;
      const cy = seg.y1;
      const dx = cx - st.x;
      const dy = cy - st.y;
      if (dy < 0) continue;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.dist) best = { cx, cy, dist: d, mult: seg.mult };
    }
    return best;
  };

  const tickParticles = (arr: Particle[], gravity: boolean) => {
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.x += p.vx; p.y += p.vy;
      if (gravity) p.vy += 0.08;
      p.vx *= 0.985; p.vy *= 0.985;
      p.life--;
      if (p.life > 0) { if (w !== i) arr[w] = p; w++; }
    }
    arr.length = w;
  };

  const crash = (st: typeof s.current, msg: string) => {
    if (!st.running) return;
    st.running = false;
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      st.debris.push({ x: st.x, y: st.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 60, maxLife: 60, color: Math.random() < 0.4 ? "#ffd060" : "#ff6b1a", size: 2 });
    }
    setResultMsg(msg);
    setStatus("crashed");
    if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("lander-highscore", String(st.score)); }
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

        // Main thruster
        const thrusting = st.keys.up && st.fuel > 0;
        if (thrusting) {
          st.vx += Math.sin(st.angle) * THRUST;
          st.vy -= Math.cos(st.angle) * THRUST;
          st.fuel = Math.max(0, st.fuel - 2);
          // exhaust particles emanating from rear (opposite of "up" relative to ship)
          for (let i = 0; i < 2; i++) {
            const a = st.angle + Math.PI + (Math.random() - 0.5) * 0.6;
            const sp = 1.5 + Math.random() * 1.5;
            st.exhaust.push({
              x: st.x + Math.sin(st.angle) * 4,
              y: st.y + Math.cos(st.angle) * 8,
              vx: Math.sin(a) * sp + st.vx * 0.4,
              vy: -Math.cos(a) * sp + st.vy * 0.4,
              life: 18 + Math.random() * 10,
              maxLife: 22,
              color: Math.random() < 0.4 ? "#ffd060" : "#ff6b1a",
              size: 1.5 + Math.random() * 1.5,
            });
          }
        }
        // Side thrusters (Q/E) — small lateral push, less fuel
        if (st.keys.sideL && st.fuel > 0) {
          st.vx -= SIDE_THRUST;
          st.fuel = Math.max(0, st.fuel - 1);
          st.exhaust.push({ x: st.x + 10, y: st.y, vx: 2 + Math.random(), vy: (Math.random() - 0.5) * 0.5, life: 10, maxLife: 10, color: "#ffd060", size: 1 });
        }
        if (st.keys.sideR && st.fuel > 0) {
          st.vx += SIDE_THRUST;
          st.fuel = Math.max(0, st.fuel - 1);
          st.exhaust.push({ x: st.x - 10, y: st.y, vx: -2 - Math.random(), vy: (Math.random() - 0.5) * 0.5, life: 10, maxLife: 10, color: "#ffd060", size: 1 });
        }

        st.vy += GRAVITY;
        st.vx += st.wind;
        st.x += st.vx; st.y += st.vy;
        st.flameFlicker = thrusting ? (Math.random() * 0.5 + 0.5) : 0;

        // Wrap horizontally
        if (st.x < -20) st.x = WIDTH + 20;
        if (st.x > WIDTH + 20) st.x = -20;

        // Asteroids
        for (const a of st.asteroids) {
          a.x += a.vx; a.y += a.vy; a.angle += a.spin;
          if (a.x < -40) a.x = WIDTH + 30;
          if (a.x > WIDTH + 40) a.x = -30;
          // Collide with lander
          const d = Math.hypot(a.x - st.x, a.y - st.y);
          if (d < a.r + 10) {
            crash(st, "Hit by an asteroid!");
            break;
          }
        }

        // Collide with terrain
        if (st.running) {
          for (const seg of st.terrain) {
            if (st.x >= Math.min(seg.x1, seg.x2) && st.x <= Math.max(seg.x1, seg.x2)) {
              const t = (st.x - seg.x1) / (seg.x2 - seg.x1 || 1);
              const ty = seg.y1 + (seg.y2 - seg.y1) * t;
              if (st.y + 10 >= ty) {
                const goodLanding = seg.flat
                  && Math.abs(st.vy) <= SAFE_VY
                  && Math.abs(st.vx) <= SAFE_VX
                  && Math.abs(st.angle) <= SAFE_ANGLE;
                if (goodLanding) {
                  st.running = false;
                  st.landingFlash = 24;
                  // Snap lander to pad surface
                  st.y = ty - 10;
                  st.vx = 0; st.vy = 0;
                  // Dust puff
                  for (let i = 0; i < 18; i++) {
                    const a2 = Math.random() * Math.PI - Math.PI; // upward hemisphere
                    const sp = 0.6 + Math.random() * 1.6;
                    st.dust.push({ x: st.x, y: ty, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: 30, maxLife: 30, color: "#d8c8a8", size: 1.5 });
                  }
                  const speed = Math.hypot(st.vx, st.vy);
                  const fuelBonus = Math.floor(st.fuel * 0.5);
                  const padBonus = Math.floor(100 * seg.mult * (1 + (10 - Math.min(10, speed * 5))));
                  const total = padBonus + fuelBonus;
                  st.score += total;
                  setScore(st.score);
                  if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("lander-highscore", String(st.score)); }
                  setResultMsg(`x${seg.mult} pad bonus +${padBonus} · fuel +${fuelBonus}`);
                  setStatus("landed");
                } else {
                  crash(st, seg.flat
                    ? (Math.abs(st.angle) > SAFE_ANGLE ? "Bad angle — straighten up!" : "Too fast — ease off the gas!")
                    : "Crashed on rough terrain");
                }
                break;
              }
            }
          }
        }
        setFuel(st.fuel);
      }

      // Update particles
      tickParticles(st.exhaust, true);
      tickParticles(st.dust, false);
      tickParticles(st.debris, true);

      if (st.landingFlash > 0) st.landingFlash--;

      // ===== DRAW =====
      // Space background
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, "#06070f"); g.addColorStop(1, "#10131e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Stars (twinkling)
      for (const star of st.stars) {
        const tw = 0.4 + Math.abs(Math.sin(frame * 0.04 + star.tw)) * 0.6;
        const a = star.bright * tw;
        ctx.fillStyle = `rgba(220,225,255,${a.toFixed(3)})`;
        const sz = star.bright > 0.9 ? 2 : 1.5;
        ctx.fillRect(star.x, star.y, sz, sz);
      }
      // Distant nebula tint
      const neb = ctx.createRadialGradient(WIDTH * 0.75, HEIGHT * 0.2, 30, WIDTH * 0.75, HEIGHT * 0.2, 200);
      neb.addColorStop(0, "rgba(127,80,200,0.12)");
      neb.addColorStop(1, "rgba(127,80,200,0)");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Asteroids
      for (const a of st.asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        ctx.fillStyle = "#6a5444";
        ctx.beginPath();
        // Lumpy circle
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const rr = a.r * (0.85 + ((i * 13) % 7) * 0.04);
          if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#4a3a2c";
        ctx.beginPath(); ctx.arc(-a.r * 0.3, -a.r * 0.2, a.r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a.r * 0.35, a.r * 0.1, a.r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Terrain
      ctx.strokeStyle = "#b8a088"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < st.terrain.length; i++) {
        const seg = st.terrain[i];
        if (i === 0) ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
      // Fill below terrain
      ctx.fillStyle = "#1a1410";
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (const seg of st.terrain) ctx.lineTo(seg.x1, seg.y1);
      const last = st.terrain[st.terrain.length - 1];
      if (last) ctx.lineTo(last.x2, last.y2);
      ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();
      // Pads highlighted with multiplier label
      for (const seg of st.terrain) {
        if (!seg.flat) continue;
        const padColor = seg.mult >= 5 ? "#ff8a3d" : seg.mult >= 3 ? "#ffd060" : "#7fd650";
        ctx.fillStyle = padColor;
        ctx.fillRect(seg.x1, seg.y1 - 3, seg.x2 - seg.x1, 4);
        // tiny strut "feet" at each end
        ctx.fillStyle = "#4a3a28";
        ctx.fillRect(seg.x1, seg.y1, 3, 6);
        ctx.fillRect(seg.x2 - 3, seg.y1, 3, 6);
        ctx.fillStyle = padColor;
        ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
        ctx.fillText(`×${seg.mult}`, (seg.x1 + seg.x2) / 2, seg.y1 - 6);
        ctx.textAlign = "start";
      }

      // Approach guide: dotted line down from lander toward closest pad if close-ish
      const target = findClosestPadX(st);
      if (st.running && target && target.dist < 220) {
        ctx.strokeStyle = "rgba(127,214,80,0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(target.cx, target.cy - 2);
        ctx.lineTo(target.cx, target.cy - 30);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Particles (under ship)
      for (const p of st.exhaust) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
      for (const p of st.dust) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.7;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
      ctx.globalAlpha = 1;

      // Debris (crash)
      for (const p of st.debris) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 3, 3);
      }
      ctx.globalAlpha = 1;

      // Lander (only if not crashed)
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
        // main flame
        if (st.flameFlicker > 0) {
          ctx.fillStyle = "#ffd060";
          ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(0, 12 + st.flameFlicker * 10); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#ff6b1a";
          ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(0, 8 + st.flameFlicker * 7); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill();
        }
        // landing flash halo
        if (st.landingFlash > 0) {
          const a = st.landingFlash / 24;
          ctx.globalAlpha = a;
          ctx.strokeStyle = "#7fd650"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, 24 + (24 - st.landingFlash) * 1.5, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      // HUD overlay — top-left status
      const speed = Math.hypot(st.vx, st.vy);
      const safe = Math.abs(st.vy) <= SAFE_VY && Math.abs(st.vx) <= SAFE_VX && Math.abs(st.angle) <= SAFE_ANGLE;
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = safe ? "#7fd650" : "#d63d3d";
      ctx.fillText(`SPD ${speed.toFixed(2)}`, 10, 18);
      ctx.fillStyle = Math.abs(st.angle) <= SAFE_ANGLE ? "#7fd650" : "#d63d3d";
      ctx.fillText(`TILT ${(st.angle * 180 / Math.PI).toFixed(0)}°`, 10, 32);

      // Altitude
      if (target) {
        const alt = Math.max(0, target.cy - st.y);
        ctx.fillStyle = "#b8a088";
        ctx.fillText(`ALT ${alt.toFixed(0)}`, 10, 46);
      }

      // Wind indicator top-right
      if (st.wind !== 0) {
        const dir = st.wind > 0 ? "→" : "←";
        const mag = Math.min(5, Math.round(Math.abs(st.wind) * 1000) / 10);
        ctx.fillStyle = "#ff8a3d";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`WIND ${dir} ${mag}`, WIDTH - 10, 18);
        ctx.textAlign = "start";
      }

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
      if (e.code === "KeyQ") s.current.keys.sideL = true;
      if (e.code === "KeyE") s.current.keys.sideR = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.keys.right = false;
      if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") s.current.keys.up = false;
      if (e.code === "KeyQ") s.current.keys.sideL = false;
      if (e.code === "KeyE") s.current.keys.sideR = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const safeFuel = fuel > 200;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--foreground)]">{level}</span></span>
        <span className="flex items-center gap-2"><span className="text-[var(--muted)]">FUEL</span>
          <span className="inline-block w-28 h-2.5 bg-[var(--surface-2)] rounded overflow-hidden border border-[var(--border)]">
            <span className="block h-full transition-all" style={{ width: `${(fuel / FUEL_MAX) * 100}%`, background: safeFuel ? "#7fd650" : fuel > 80 ? "#ffd060" : "#d63d3d" }} />
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
              onClick={() => { if (!started) beginGame(); else if (status === "landed") resetLevel(level + 1); else beginGame(); }}
              className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
            >
              {!started ? "LAUNCH" : status === "landed" ? "NEXT LANDING →" : "TRY AGAIN"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">
              ← → rotate · ↑/SPACE main thrust · Q/E side thrust<br />
              Land flat, slow, on a colored pad
            </p>
            {!started && <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[#ff8a3d]">From level 3: wind. From level 5: asteroids.</p>}
          </div>
        )}
      </div>

      <div className="sm:hidden grid grid-cols-5 gap-2 mt-2 w-full max-w-[440px]">
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded text-xl" onTouchStart={() => (s.current.keys.left = true)} onTouchEnd={() => (s.current.keys.left = false)}>↺</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded text-sm" onTouchStart={() => (s.current.keys.sideL = true)} onTouchEnd={() => (s.current.keys.sideL = false)}>◀ Q</button>
        <button className="pixel-edge p-3 bg-[var(--accent)] text-[var(--background)] rounded" onTouchStart={() => (s.current.keys.up = true)} onTouchEnd={() => (s.current.keys.up = false)}>▲</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded text-sm" onTouchStart={() => (s.current.keys.sideR = true)} onTouchEnd={() => (s.current.keys.sideR = false)}>E ▶</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded text-xl" onTouchStart={() => (s.current.keys.right = true)} onTouchEnd={() => (s.current.keys.right = false)}>↻</button>
      </div>
    </div>
  );
}
