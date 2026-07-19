import type {
  Biome, Obstacle, Pickup, RainDrop, Star, Mountain,
  Asteroid, Jet, Bullet,
} from "./types";
import {
  WIDTH, HEIGHT, OBSTACLE_WIDTH, PICKUP_SIZE, HELI_W, HELI_H,
  TILT_FACTOR, TILT_MAX,
} from "./constants";
import { clamp, laserPhase, laserPhaseProgress, laserGeometry } from "./helpers";

// ===== Cached sky fills (createLinearGradient every frame was a big cost) =====
const skyCache = new Map<string, CanvasGradient>();
let skyCacheCtx: CanvasRenderingContext2D | null = null;

function skyGradient(ctx: CanvasRenderingContext2D, biome: Biome): CanvasGradient {
  // Gradients are bound to a context; rebuild if the draw context changed.
  if (skyCacheCtx !== ctx) {
    skyCache.clear();
    skyCacheCtx = ctx;
  }
  let g = skyCache.get(biome.id);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, biome.skyTop);
    g.addColorStop(0.6, biome.skyMid);
    g.addColorStop(1, biome.skyBot);
    skyCache.set(biome.id, g);
  }
  return g;
}

// ===== Background / sky =====
export function drawBackground(ctx: CanvasRenderingContext2D, biome: Biome, frame = 0) {
  ctx.fillStyle = skyGradient(ctx, biome);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Underwater light rays — every other frame + fewer rays for perf
  if (biome.id === "underwater" && (frame & 1) === 0) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    const drift = frame * 0.3;
    for (let i = 0; i < 3; i++) {
      const x = ((i * 260 + drift) % (WIDTH + 200)) - 100;
      const w = 28 + (i % 2) * 12;
      ctx.fillStyle = "#60d0f0";
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x + w, -10);
      ctx.lineTo(x + w + 50, HEIGHT + 10);
      ctx.lineTo(x + 50, HEIGHT + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  biome: Biome,
  frame: number
) {
  if (!biome.starCount) return;
  const isOcean = biome.id === "underwater";
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.05 + s.twinkle);
    ctx.globalAlpha = 0.3 + twinkle * 0.5;
    ctx.fillStyle = biome.starColor;
    if (isOcean) {
      // Bubbles: circles that wobble and drift upward
      const wobble = Math.sin(frame * 0.02 + s.twinkle) * 3;
      const drift = (frame * 0.15 + s.twinkle * 100) % (HEIGHT + 40) - 20;
      const bx = s.x + wobble;
      const by = HEIGHT - drift;
      const r = s.size + 1;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      // Tiny highlight on bubble
      ctx.globalAlpha = 0.5 * ctx.globalAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawSun(ctx: CanvasRenderingContext2D, biome: Biome) {
  if (!biome.hasSun || !biome.sunColor) return;
  // Cheap soft halo — no radial gradient (expensive when recreated each frame)
  ctx.fillStyle = "rgba(255, 208, 96, 0.18)";
  ctx.beginPath();
  ctx.arc(620, 110, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = biome.sunColor;
  ctx.beginPath();
  ctx.arc(620, 110, 20, 0, Math.PI * 2);
  ctx.fill();
}

export function drawRain(ctx: CanvasRenderingContext2D, rain: RainDrop[]) {
  if (rain.length === 0) return;
  ctx.strokeStyle = "rgba(180, 210, 240, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const r of rain) {
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - 2, r.y + r.length);
  }
  ctx.stroke();
  // Skip per-drop splash arcs — they were a major cost in storm biome.
}

export function drawLightningFlash(ctx: CanvasRenderingContext2D, intensity: number) {
  // intensity 0..1
  if (intensity <= 0) return;
  ctx.fillStyle = `rgba(220, 230, 255, ${intensity * 0.5})`;
  ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);
}

// ===== Mountains =====
export function drawMountains(
  ctx: CanvasRenderingContext2D,
  far: Mountain[],
  near: Mountain[],
  biome: Biome
) {
  const isOcean = biome.id === "underwater";

  if (isOcean) {
    // Far layer: kelp/seaweed silhouettes (dark teal mounds)
    ctx.fillStyle = biome.mountainFar;
    for (const m of far) {
      ctx.beginPath();
      ctx.moveTo(m.x, HEIGHT);
      ctx.quadraticCurveTo(m.x + 20, HEIGHT - m.height * 0.7, m.x + 35, HEIGHT - m.height);
      ctx.quadraticCurveTo(m.x + 50, HEIGHT - m.height * 0.8, m.x + 65, HEIGHT - m.height * 0.5);
      ctx.quadraticCurveTo(m.x + 80, HEIGHT - m.height * 0.3, m.x + 90, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    // Near layer: coral reef (pink/coral rounded humps)
    ctx.fillStyle = biome.mountainNear;
    for (const m of near) {
      const h = m.height * 0.8;
      ctx.beginPath();
      ctx.moveTo(m.x, HEIGHT);
      ctx.quadraticCurveTo(m.x + 15, HEIGHT - h * 0.6, m.x + 30, HEIGHT - h);
      ctx.quadraticCurveTo(m.x + 55, HEIGHT - h * 1.1, m.x + 70, HEIGHT - h * 0.7);
      ctx.quadraticCurveTo(m.x + 90, HEIGHT - h * 0.4, m.x + 110, HEIGHT);
      ctx.closePath();
      ctx.fill();
      // Coral dots
      ctx.fillStyle = "#e08090";
      const dotY = HEIGHT - h * 0.5;
      ctx.beginPath();
      ctx.arc(m.x + 35, dotY, 3, 0, Math.PI * 2);
      ctx.arc(m.x + 60, dotY + 6, 2, 0, Math.PI * 2);
      ctx.arc(m.x + 48, dotY - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = biome.mountainNear;
    }
  } else {
    ctx.fillStyle = biome.mountainFar;
    for (const m of far) {
      ctx.beginPath();
      ctx.moveTo(m.x, HEIGHT);
      ctx.lineTo(m.x + 45, HEIGHT - m.height);
      ctx.lineTo(m.x + 90, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = biome.mountainNear;
    for (const m of near) {
      ctx.beginPath();
      ctx.moveTo(m.x, HEIGHT);
      ctx.lineTo(m.x + 55, HEIGHT - m.height);
      ctx.lineTo(m.x + 110, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ===== Obstacles =====
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  o: Obstacle,
  biome: Biome
) {
  if (o.type === "sawblade") {
    drawSawblade(ctx, o);
    return;
  }
  if (o.type === "laser") {
    drawLaserGate(ctx, o, biome);
    return;
  }
  const halfGap = o.gap / 2;
  // Solid fill (no per-pillar createLinearGradient — large win with many columns)
  ctx.fillStyle = biome.pillarMain[1];
  ctx.fillRect(o.x, 0, OBSTACLE_WIDTH, o.gapY - halfGap);
  ctx.fillRect(o.x, o.gapY + halfGap, OBSTACLE_WIDTH, HEIGHT - (o.gapY + halfGap));
  // Edge strips for depth without a full gradient
  ctx.fillStyle = biome.pillarMain[0];
  ctx.fillRect(o.x, 0, 5, o.gapY - halfGap);
  ctx.fillRect(o.x, o.gapY + halfGap, 5, HEIGHT - (o.gapY + halfGap));
  // Caps
  ctx.fillStyle = biome.pillarCap;
  ctx.fillRect(o.x, o.gapY - halfGap - 8, OBSTACLE_WIDTH, 8);
  ctx.fillRect(o.x, o.gapY + halfGap, OBSTACLE_WIDTH, 8);
  // Dark cap corners
  ctx.fillStyle = biome.pillarEdge;
  ctx.fillRect(o.x, o.gapY - halfGap - 8, 4, 8);
  ctx.fillRect(o.x + OBSTACLE_WIDTH - 4, o.gapY - halfGap - 8, 4, 8);
  ctx.fillRect(o.x, o.gapY + halfGap, 4, 8);
  ctx.fillRect(o.x + OBSTACLE_WIDTH - 4, o.gapY + halfGap, 4, 8);

  // Subtle marker for moving pillars (arrows on caps)
  if (o.type === "moving") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    const cx = o.x + OBSTACLE_WIDTH / 2;
    // up arrow on top cap
    ctx.beginPath();
    ctx.moveTo(cx, o.gapY - halfGap - 6);
    ctx.lineTo(cx - 3, o.gapY - halfGap - 2);
    ctx.lineTo(cx + 3, o.gapY - halfGap - 2);
    ctx.closePath();
    ctx.fill();
    // down arrow on bottom cap
    ctx.beginPath();
    ctx.moveTo(cx, o.gapY + halfGap + 6);
    ctx.lineTo(cx - 3, o.gapY + halfGap + 2);
    ctx.lineTo(cx + 3, o.gapY + halfGap + 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSawblade(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const x = o.x + OBSTACLE_WIDTH / 2;
  const y = o.sawY;
  const r = 28;
  // Mount post from ceiling or floor (whichever is closer)
  const fromTop = y < HEIGHT / 2;
  ctx.strokeStyle = "#5a5a5a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (fromTop) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y - r);
  } else {
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x, y + r);
  }
  ctx.stroke();

  // Spinning blade
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.sawAngle);
  // Outer teeth (8)
  ctx.fillStyle = "#c0c0c8";
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(4, -r - 6);
    ctx.lineTo(-4, -r - 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Disc
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aaa";
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
  ctx.fill();
  // Hub
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Streaks for motion
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
    ctx.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
  }
  ctx.stroke();
  ctx.restore();
}

// Neon laser gate — TWO openings split by a middle bar. The beam alternates
// between blocking the upper opening and blocking the lower one. Each fires
// in three stages: charge (telegraph) → BURST (super-bright flash) → thin
// steady beam. Eye indicators on the middle bar tell you which opening is
// about to fire.
function drawLaserGate(ctx: CanvasRenderingContext2D, o: Obstacle, biome: Biome) {
  const geo = laserGeometry(o.gapY, o.gap);
  const cx = o.x + OBSTACLE_WIDTH / 2;
  const phase = laserPhase(o.movePhase);
  const progress = laserPhaseProgress(o.movePhase);

  // Pillar bodies: top, middle bar, bottom — all solid.
  const grad = ctx.createLinearGradient(o.x, 0, o.x + OBSTACLE_WIDTH, 0);
  grad.addColorStop(0, biome.pillarMain[0]);
  grad.addColorStop(0.5, biome.pillarMain[1]);
  grad.addColorStop(1, biome.pillarMain[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, 0, OBSTACLE_WIDTH, geo.topEdge);
  ctx.fillRect(o.x, geo.barTop, OBSTACLE_WIDTH, geo.barBot - geo.barTop);
  ctx.fillRect(o.x, geo.botEdge, OBSTACLE_WIDTH, HEIGHT - geo.botEdge);

  // Emitter housings on the inside edges (top opening edges + bar edges + bottom opening edges)
  ctx.fillStyle = "#1a0830";
  ctx.fillRect(o.x, geo.topEdge - 8, OBSTACLE_WIDTH, 8);   // top of upper opening
  ctx.fillRect(o.x, geo.midTop - 4, OBSTACLE_WIDTH, 4);    // bottom of upper opening
  ctx.fillRect(o.x, geo.midBot,     OBSTACLE_WIDTH, 4);    // top of lower opening
  ctx.fillRect(o.x, geo.botEdge,    OBSTACLE_WIDTH, 8);    // bottom of lower opening

  // === Eye indicators on the middle bar ===
  // A pair of "eyes" facing each opening; pupils swivel toward the side that's
  // about to fire or currently firing.
  const eyeY = (geo.barTop + geo.barBot) / 2;
  const upperWatch = phase === "charge_upper" || phase === "burst_upper" || phase === "thin_upper";
  const lowerWatch = phase === "charge_lower" || phase === "burst_lower" || phase === "thin_lower";
  const upperFiring = phase === "burst_upper" || phase === "thin_upper";
  const lowerFiring = phase === "burst_lower" || phase === "thin_lower";
  // The pupils look in the direction of the active opening, idle = level.
  const lookDir = upperWatch ? -1 : lowerWatch ? 1 : 0;
  const eyeIsAngry = upperFiring || lowerFiring;
  drawEyePair(ctx, cx, eyeY, lookDir, eyeIsAngry, phase, progress);

  // === Beams ===
  if (phase === "charge_upper") drawChargePulse(ctx, cx, geo.topEdge, geo.midTop, progress);
  if (phase === "charge_lower") drawChargePulse(ctx, cx, geo.midBot,  geo.botEdge, progress);
  if (phase === "burst_upper")  drawBurstBeam(ctx, o.x, cx, geo.topEdge, geo.midTop, progress);
  if (phase === "burst_lower")  drawBurstBeam(ctx, o.x, cx, geo.midBot,  geo.botEdge, progress);
  if (phase === "thin_upper")   drawThinBeam (ctx, o.x, cx, geo.topEdge, geo.midTop);
  if (phase === "thin_lower")   drawThinBeam (ctx, o.x, cx, geo.midBot,  geo.botEdge);
}

// Draw two side-by-side eyes (like 👀) on the middle bar. lookDir: -1 looks
// up, +1 looks down, 0 looks straight ahead (idle).
function drawEyePair(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, lookDir: number, angry: boolean,
  phase: ReturnType<typeof laserPhase>, progress: number
) {
  const eyeR = 5;
  const eyeSep = 7;
  const drawOne = (x: number) => {
    // Sclera (white). When firing it goes red+bright.
    ctx.fillStyle = angry ? "#ffe0e0" : "#fff5e0";
    ctx.beginPath(); ctx.arc(x, cy, eyeR, 0, Math.PI * 2); ctx.fill();
    // Charge phase pulses the iris glow to telegraph.
    if (phase === "charge_upper" || phase === "charge_lower") {
      ctx.fillStyle = `rgba(255,210,80,${0.4 + 0.4 * Math.sin(progress * Math.PI * 6)})`;
      ctx.beginPath(); ctx.arc(x, cy, eyeR + 2, 0, Math.PI * 2); ctx.fill();
    }
    // Pupil
    const pupilOffset = lookDir * 2;
    ctx.fillStyle = angry ? "#ff1030" : "#0a0418";
    ctx.beginPath();
    ctx.arc(x, cy + pupilOffset, angry ? 3 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Highlight glint
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x - 1, cy + pupilOffset - 1, 0.8, 0, Math.PI * 2);
    ctx.fill();
  };
  drawOne(cx - eyeSep);
  drawOne(cx + eyeSep);
}

function drawChargePulse(
  ctx: CanvasRenderingContext2D,
  cx: number, y1: number, y2: number, progress: number
) {
  // Build-up: thin dashed line that intensifies as charge progresses.
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.45 * progress + Math.random() * 0.2;
  ctx.strokeStyle = "#ffd060";
  ctx.lineWidth = 1.5 + progress * 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, y1);
  ctx.lineTo(cx, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// BURST: super-bright wide flash filling the entire opening. Intensity
// fades out as the burst transitions into the thin steady state.
function drawBurstBeam(
  ctx: CanvasRenderingContext2D,
  oxLeft: number, cx: number, y1: number, y2: number, progress: number
) {
  // progress 0..1 across the burst phase. Fade the burst as it ends so the
  // transition into thin reads smoothly.
  const intensity = 1 - progress * 0.4;

  ctx.save();
  // Soft outer halo extending beyond the opening
  const halo = ctx.createRadialGradient(cx, (y1 + y2) / 2, 0, cx, (y1 + y2) / 2, OBSTACLE_WIDTH * 2.5);
  halo.addColorStop(0, `rgba(255,180,200,${0.55 * intensity})`);
  halo.addColorStop(1, "rgba(255,80,120,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(oxLeft - OBSTACLE_WIDTH, y1, OBSTACLE_WIDTH * 3, y2 - y1);

  // Vertical bloom along the corridor width
  const bloom = ctx.createLinearGradient(oxLeft, 0, oxLeft + OBSTACLE_WIDTH, 0);
  bloom.addColorStop(0,    "rgba(255,80,120,0)");
  bloom.addColorStop(0.5,  `rgba(255,200,220,${0.95 * intensity})`);
  bloom.addColorStop(1,    "rgba(255,80,120,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(oxLeft, y1, OBSTACLE_WIDTH, y2 - y1);

  // Solid hot core — no shadowBlur (canvas shadows are extremely expensive)
  ctx.strokeStyle = `rgba(255,90,120,${intensity})`;
  ctx.lineWidth = 14 + 10 * intensity;
  ctx.beginPath();
  ctx.moveTo(cx, y1); ctx.lineTo(cx, y2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5 + 6 * intensity;
  ctx.beginPath();
  ctx.moveTo(cx, y1); ctx.lineTo(cx, y2);
  ctx.stroke();

  // Endpoint flares — punctuates the cutoff
  ctx.fillStyle = `rgba(255,255,255,${intensity})`;
  ctx.beginPath(); ctx.arc(cx, y1, 6 + 4 * intensity, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, y2, 6 + 4 * intensity, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// THIN steady beam — the long deadly state. Calmer than the burst but still
// unmistakably lethal.
function drawThinBeam(
  ctx: CanvasRenderingContext2D,
  oxLeft: number, cx: number, y1: number, y2: number
) {
  ctx.save();
  // Subtle bloom
  const bloom = ctx.createLinearGradient(oxLeft, 0, oxLeft + OBSTACLE_WIDTH, 0);
  bloom.addColorStop(0,   "rgba(255,48,96,0)");
  bloom.addColorStop(0.5, "rgba(255,90,130,0.45)");
  bloom.addColorStop(1,   "rgba(255,48,96,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(oxLeft, y1, OBSTACLE_WIDTH, y2 - y1);

  // White core + red overlay (no shadowBlur)
  ctx.strokeStyle = "rgba(255,90,130,0.7)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, y1); ctx.lineTo(cx, y2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, y1); ctx.lineTo(cx, y2);
  ctx.stroke();

  // Endpoint glints
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.arc(cx, y1, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, y2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function drawPickup(
  ctx: CanvasRenderingContext2D,
  p: Pickup,
  frame: number
) {
  const bob = Math.sin(p.bob + frame * 0.08) * 3;
  const x = p.x;
  const y = p.y + bob;

  if (p.type === "blue_gem") drawGem(ctx, x, y, p.spin, "#5fc8e0", "#a8e8f8", "#1a608c");
  else if (p.type === "green_gem") drawGreenGem(ctx, x, y, p.spin, frame);
  else if (p.type === "red_gem") drawRedGem(ctx, x, y, p.spin, frame);
  else if (p.type === "gold_gem") drawGoldGem(ctx, x, y, p.spin, frame);
  else if (p.type === "coin") drawCoin(ctx, x, y, p.spin, frame);
  else if (p.type === "heart") drawHeartPickup(ctx, x, y, frame);
  else if (p.type === "shield") drawShieldPickup(ctx, x, y, frame);
  else if (p.type === "slowmo") drawSlowmoPickup(ctx, x, y, frame);
  else if (p.type === "magnet") drawMagnetPickup(ctx, x, y, frame);
}

// Spinning gold coin — the 3D-flip illusion comes from squashing width by
// |cos(spin)|. Used for the 3x3 coin patches.
function drawCoin(
  ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, frame: number
) {
  const R = PICKUP_SIZE * 0.78;
  const flip = Math.cos(spin);
  const w = Math.max(2, Math.abs(flip) * R);

  // Soft glow
  const glow = ctx.createRadialGradient(x, y, 1, x, y, R + 5);
  glow.addColorStop(0, "rgba(255,210,80,0.55)");
  glow.addColorStop(1, "rgba(255,210,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - R - 5, y - R - 5, (R + 5) * 2, (R + 5) * 2);

  // Edge (visible when the coin turns side-on) — darker gold
  ctx.fillStyle = "#a06820";
  ctx.beginPath();
  ctx.ellipse(x, y, w + 1.5, R, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.fillStyle = flip >= 0 ? "#ffd060" : "#f0b840";
  ctx.beginPath();
  ctx.ellipse(x, y, w, R, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner ring + star, only legible when the face is open enough
  if (w > R * 0.4) {
    ctx.strokeStyle = "#fff5d0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.62, R * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    // little star glint
    const tw = Math.sin(frame * 0.2 + x) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.5 + tw * 0.4})`;
    ctx.beginPath();
    ctx.arc(x - w * 0.2, y - R * 0.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Heart pickup — extra life. Pulses on a slow heartbeat so it reads as alive.
function drawHeartPickup(
  ctx: CanvasRenderingContext2D, x: number, y: number, frame: number
) {
  const beat = 0.92 + 0.08 * Math.sin(frame * 0.18);
  const R = PICKUP_SIZE * 0.85 * beat;

  // Soft red halo
  const halo = ctx.createRadialGradient(x, y, 1, x, y, R + 8);
  halo.addColorStop(0, "rgba(255,80,100,0.55)");
  halo.addColorStop(1, "rgba(255,80,100,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(x - R - 8, y - R - 8, (R + 8) * 2, (R + 8) * 2);

  // Heart shape — two lobes + triangle point
  const path = (scale: number, fill: string) => {
    const w = R * scale;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x - w * 0.5, y - w * 0.15, w * 0.55, 0, Math.PI * 2);
    ctx.arc(x + w * 0.5, y - w * 0.15, w * 0.55, 0, Math.PI * 2);
    ctx.moveTo(x - w * 1.0, y + w * 0.1);
    ctx.lineTo(x, y + w * 1.05);
    ctx.lineTo(x + w * 1.0, y + w * 0.1);
    ctx.closePath();
    ctx.fill();
  };
  // Dark outline
  path(1.05, "#7a1020");
  // Main red
  path(1.0,  "#e8324a");
  // Lighter top
  path(0.78, "#ff6b6b");
  // Sparkle highlight
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(x - R * 0.35, y - R * 0.35, R * 0.18, R * 0.10, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawGem(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, spin: number,
  base: string, highlight: string, dark: string
) {
  const r = PICKUP_SIZE;
  // Soft glow
  const glow = ctx.createRadialGradient(x, y, 2, x, y, r + 6);
  glow.addColorStop(0, base + "aa");
  glow.addColorStop(1, base + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r - 6, y - r - 6, (r + 6) * 2, (r + 6) * 2);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  // Diamond
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  // Top-left facet (highlight)
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.lineTo(-r * 0.25, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  // Bottom-right facet (shadow)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(r * 0.25, r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGoldGem(
  ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, frame: number
) {
  drawGem(ctx, x, y, spin, "#ffd060", "#fff5d0", "#a06820");
  // Sparkle
  const sparkle = Math.sin(frame * 0.2) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 245, 208, ${sparkle * 0.9})`;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + frame * 0.05;
    const r = PICKUP_SIZE + 6;
    ctx.fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 2, 2);
  }
}

function drawGreenGem(
  ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, frame: number
) {
  drawGem(ctx, x, y, spin, "#40c870", "#90f0a8", "#1a7030");
  // Subtle pulse glow
  const pulse = Math.sin(frame * 0.12) * 0.3 + 0.5;
  ctx.fillStyle = `rgba(64, 200, 112, ${pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(x, y, PICKUP_SIZE + 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawRedGem(
  ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, frame: number
) {
  drawGem(ctx, x, y, spin, "#e04050", "#ff8898", "#801828");
  // Ruby sparkle (2 orbiting dots, less flashy than gold)
  const sparkle = Math.sin(frame * 0.18) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 136, 152, ${sparkle * 0.8})`;
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + frame * 0.06;
    const r = PICKUP_SIZE + 5;
    ctx.fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 2, 2);
  }
}

function drawShieldPickup(
  ctx: CanvasRenderingContext2D, x: number, y: number, frame: number
) {
  // Soft glow
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 22);
  glow.addColorStop(0, "rgba(95, 200, 224, 0.7)");
  glow.addColorStop(1, "rgba(95, 200, 224, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 22, y - 22, 44, 44);
  const pulse = 1 + Math.sin(frame * 0.15) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  // Shield shape
  ctx.fillStyle = "#5fc8e0";
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, -8);
  ctx.lineTo(10, 4);
  ctx.lineTo(0, 14);
  ctx.lineTo(-10, 4);
  ctx.lineTo(-10, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#a8e8f8";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(8, -6);
  ctx.lineTo(8, 0);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-8, -6);
  ctx.closePath();
  ctx.fill();
  // Cross
  ctx.fillStyle = "#fff";
  ctx.fillRect(-1, -6, 2, 12);
  ctx.fillRect(-5, -1, 10, 2);
  ctx.restore();
}

function drawSlowmoPickup(
  ctx: CanvasRenderingContext2D, x: number, y: number, frame: number
) {
  // Soft glow
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 22);
  glow.addColorStop(0, "rgba(140, 110, 220, 0.7)");
  glow.addColorStop(1, "rgba(140, 110, 220, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 22, y - 22, 44, 44);
  ctx.save();
  ctx.translate(x, y);
  // Hourglass
  ctx.fillStyle = "#8c6edc";
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.lineTo(10, -12);
  ctx.lineTo(10, -10);
  ctx.lineTo(2, 0);
  ctx.lineTo(10, 10);
  ctx.lineTo(10, 12);
  ctx.lineTo(-10, 12);
  ctx.lineTo(-10, 10);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-10, -10);
  ctx.closePath();
  ctx.fill();
  // Sand
  const sandFrac = (Math.sin(frame * 0.06) + 1) / 2;
  ctx.fillStyle = "#ffd060";
  // top sand
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.lineTo(8, -10);
  ctx.lineTo(2, -10 + 8 * (1 - sandFrac));
  ctx.lineTo(-2, -10 + 8 * (1 - sandFrac));
  ctx.closePath();
  ctx.fill();
  // bottom sand
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(8, 10);
  ctx.lineTo(2, 10 - 8 * sandFrac);
  ctx.lineTo(-2, 10 - 8 * sandFrac);
  ctx.closePath();
  ctx.fill();
  // sand stream
  ctx.fillRect(-0.5, -2, 1, 4);
  ctx.restore();
}

function drawMagnetPickup(
  ctx: CanvasRenderingContext2D, x: number, y: number, frame: number
) {
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 22);
  glow.addColorStop(0, "rgba(214, 61, 61, 0.6)");
  glow.addColorStop(1, "rgba(214, 61, 61, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 22, y - 22, 44, 44);
  ctx.save();
  ctx.translate(x, y - 2);
  // U-shaped magnet (drawn as two prongs + connector)
  ctx.fillStyle = "#d63d3d";
  ctx.fillRect(-10, -10, 5, 18);
  ctx.fillRect(5, -10, 5, 18);
  ctx.fillRect(-10, -10, 20, 5);
  // Silver tips
  ctx.fillStyle = "#c0c0c8";
  ctx.fillRect(-10, 5, 5, 5);
  ctx.fillRect(5, 5, 5, 5);
  // Little attraction sparks
  ctx.fillStyle = `rgba(255, 245, 208, ${(Math.sin(frame * 0.3) + 1) * 0.4})`;
  ctx.fillRect(-14, 4, 2, 2);
  ctx.fillRect(12, 4, 2, 2);
  ctx.restore();
}

// ===== Helicopter =====
export function drawHeli(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, vy: number, frame: number,
  shieldActive: boolean, invulnT: number
) {
  // Shield aura
  if (shieldActive) {
    const pulse = Math.sin(frame * 0.15) * 0.1 + 0.5;
    ctx.strokeStyle = `rgba(95, 200, 224, ${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x - 2, y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(168, 232, 248, ${pulse * 0.6})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x - 2, y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Invuln flash overlay (after shield consumed)
  const invulnAlpha = invulnT > 0 ? (Math.floor(frame / 3) % 2 === 0 ? 0.5 : 1.0) : 1.0;

  const tilt = clamp(vy * TILT_FACTOR, -TILT_MAX, TILT_MAX);

  ctx.save();
  ctx.globalAlpha = invulnAlpha;
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(-1, 1); // mirror so cockpit faces right (direction of travel)

  // Tail boom
  ctx.fillStyle = "#5a8c5e";
  ctx.fillRect(8, -2, 16, 4);
  // Tail rotor
  const tailRot = (frame * 0.8) % 16;
  ctx.fillStyle = "#f5e8d0";
  ctx.fillRect(22, -6 + tailRot * 0.4, 2, 8 - tailRot * 0.4);
  // Body
  ctx.fillStyle = "#7fd650";
  ctx.fillRect(-18, -7, 28, 14);
  // Body highlight
  ctx.fillStyle = "#9fe070";
  ctx.fillRect(-18, -7, 28, 3);
  // Body shadow
  ctx.fillStyle = "#5a9a3a";
  ctx.fillRect(-18, 4, 28, 3);
  // Cockpit window
  ctx.fillStyle = "#0a1a2a";
  ctx.fillRect(-16, -4, 10, 7);
  ctx.fillStyle = "#3a6090";
  ctx.fillRect(-16, -4, 10, 2);
  // Landing skid
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(-14, 7, 22, 2);
  ctx.fillRect(-14, 7, 2, 4);
  ctx.fillRect(6, 7, 2, 4);
  // Main rotor (blurred)
  const rotorOffset = (frame * 5) % 30;
  ctx.fillStyle = "rgba(245, 232, 208, 0.85)";
  ctx.fillRect(-18 + rotorOffset - 15, -13, 30, 2);
  ctx.fillStyle = "rgba(245, 232, 208, 0.4)";
  ctx.fillRect(-22, -13, 38, 2);
  // Rotor hub
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(-4, -14, 4, 4);
  // Blinking nav light
  if (Math.floor(frame / 20) % 2 === 0) {
    ctx.fillStyle = "#ff5050";
    ctx.fillRect(8, -1, 2, 2);
  }
  ctx.restore();
}

// ===== Magnet aura around heli =====
export function drawMagnetAura(
  ctx: CanvasRenderingContext2D, x: number, y: number, frame: number
) {
  // One ring only (was 3 rings + radial gradient every frame)
  const phase = (frame * 0.03) % 1;
  const r = 30 + phase * 100;
  const alpha = (1 - phase) * 0.35;
  ctx.strokeStyle = `rgba(255, 80, 80, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Orbiting attraction dots
  ctx.fillStyle = "rgba(255, 120, 120, 0.6)";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + frame * 0.04;
    const r = 60 + Math.sin(frame * 0.06 + i) * 20;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Slow-mo vignette overlay =====
export function drawSlowmoOverlay(ctx: CanvasRenderingContext2D, intensity: number) {
  const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 100, WIDTH / 2, HEIGHT / 2, WIDTH / 2);
  grad.addColorStop(0, "rgba(140, 110, 220, 0)");
  grad.addColorStop(1, `rgba(140, 110, 220, ${0.35 * intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// ===== Smoke trail =====
export function drawSmoke(ctx: CanvasRenderingContext2D, smoke: { x: number; y: number; life: number; maxLife: number; size: number }[]) {
  for (const sm of smoke) {
    const a = (sm.life / sm.maxLife) * 0.5;
    ctx.fillStyle = `rgba(180, 160, 136, ${a})`;
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Sparks (wall scrapes) =====
export function drawSparks(ctx: CanvasRenderingContext2D, sparks: { x: number; y: number; life: number; maxLife: number }[]) {
  for (const s of sparks) {
    const a = s.life / s.maxLife;
    // Glow halo
    ctx.fillStyle = `rgba(255, 200, 60, ${a * 0.3})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.fillStyle = `rgba(255, 240, 140, ${a})`;
    ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
  }
}

// HELI_W and HELI_H are re-exported above via constants
export { HELI_W, HELI_H };

// ===== 6-pointed geometric explosion =====
// progress: 0..1 over the explosion lifetime
export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number, frame: number
) {
  if (progress >= 1) return;
  const t = Math.max(0, Math.min(1, progress)); // clamp: guards against negative radii
  const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
  const fade = Math.max(0, 1 - t * 1.2);

  ctx.save();
  ctx.translate(x, y);

  // --- Layer 1: central flash ---
  if (t < 0.4) {
    const flashR = Math.max(0.01, ease * 80);
    const flashAlpha = (1 - t / 0.4) * 0.9;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR);
    grad.addColorStop(0, `rgba(255, 255, 240, ${flashAlpha})`);
    grad.addColorStop(0.4, `rgba(255, 200, 80, ${flashAlpha * 0.6})`);
    grad.addColorStop(1, `rgba(255, 107, 26, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-flashR, -flashR, flashR * 2, flashR * 2);
  }

  // --- Layer 2: chunky filled sunburst (outer glow) ---
  // 12-pointed star, fully filled — replaces the old outline.
  const sunOuter = ease * 115;
  const sunInner = ease * 62;
  ctx.fillStyle = `rgba(255, 180, 60, ${fade * 0.85})`;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? sunOuter : sunInner;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // --- Layer 3: bright filled hot core (chunky 8-pointed star) ---
  const coreOuter = ease * 58;
  const coreInner = ease * 30;
  ctx.fillStyle = `rgba(255, 240, 170, ${fade * 0.95})`;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2 + 0.1;
    const r = i % 2 === 0 ? coreOuter : coreInner;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // --- Layer 4: filled shockwave ring (solid annulus, not a stroked circle) ---
  if (t > 0.1) {
    const t3 = (t - 0.1) / 0.9;
    const outer = t3 * 165;
    const thickness = Math.max(2, 14 - t3 * 6);
    const inner = Math.max(0, outer - thickness);
    const alpha = Math.max(0, 1 - t3 * 1.3) * 0.6;
    ctx.fillStyle = `rgba(255, 100, 40, ${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, Math.PI * 2);
    ctx.arc(0, 0, inner, 0, Math.PI * 2, true); // counterclockwise = hole
    ctx.fill();
  }

  // --- Layer 6: geometric debris triangles ---
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + frame * 0.02;
    const dist = ease * (60 + (i % 3) * 40);
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    const triSize = (3 + (i % 4)) * (1 - t);
    const triAlpha = fade * 0.8;
    const rot = frame * 0.08 + i * 1.2;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.globalAlpha = triAlpha;
    ctx.fillStyle = i % 3 === 0 ? "#ff6b1a" : i % 3 === 1 ? "#ffd060" : "#d63d3d";
    ctx.beginPath();
    ctx.moveTo(0, -triSize);
    ctx.lineTo(-triSize * 0.87, triSize * 0.5);
    ctx.lineTo(triSize * 0.87, triSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- Layer 7: bright sparkles riding the sunburst tips ---
  if (t < 0.6) {
    ctx.fillStyle = `rgba(255, 255, 200, ${(1 - t / 0.6) * 0.95})`;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const r = sunOuter + Math.sin(frame * 0.3 + i) * 5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3 - t * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
// ===== Space biome flyers =====

export function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);

  // Body — lumpy polygon from the per-vertex shape multipliers
  const n = a.shape.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rr = a.r * a.shape[i];
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-a.r, -a.r, a.r, a.r);
  g.addColorStop(0, "#8a7a6a");
  g.addColorStop(1, "#4a3e36");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#352a24";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Craters
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.arc(-a.r * 0.25, -a.r * 0.15, a.r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(a.r * 0.3, a.r * 0.1, a.r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(a.r * 0.05, -a.r * 0.4, a.r * 0.12, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

export function drawJet(ctx: CanvasRenderingContext2D, j: Jet, frame: number) {
  ctx.save();
  ctx.translate(j.x, j.y);

  // Engine flame trailing to the right (jet flies left)
  const flick = 0.6 + Math.random() * 0.4;
  const fg = ctx.createLinearGradient(10, 0, 30, 0);
  fg.addColorStop(0, `rgba(255,200,80,${flick})`);
  fg.addColorStop(1, "rgba(255,80,40,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.lineTo(26 + flick * 8, 0);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  // Fuselage — nose points left
  ctx.fillStyle = "#c0c8d4";
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(8, -5);
  ctx.lineTo(14, 0);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fill();
  // Wings
  ctx.fillStyle = "#8a93a0";
  ctx.beginPath();
  ctx.moveTo(2, -3);
  ctx.lineTo(10, -14);
  ctx.lineTo(6, -3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, 3);
  ctx.lineTo(10, 14);
  ctx.lineTo(6, 3);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.fillStyle = "#5fc8e0";
  ctx.beginPath();
  ctx.ellipse(-6, 0, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose blinker
  const blink = Math.sin(frame * 0.3) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255,80,80,${0.4 + blink * 0.6})`;
  ctx.beginPath();
  ctx.arc(-18, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  ctx.save();
  // Tracer tail
  const g = ctx.createLinearGradient(b.x, 0, b.x + 18, 0);
  g.addColorStop(0, "rgba(255,90,90,0.9)");
  g.addColorStop(1, "rgba(255,90,90,0)");
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x + 16, b.y);
  ctx.stroke();
  // Hot head
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5a5a";
  ctx.beginPath();
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.restore();
}

// Storm-biome tornado: a tall funnel built from rotating ellipses that taper
// toward the ground. Position is owned by the caller; this just renders at
// `x`. `frame` drives rotation and `phase` lets the caller offset the sway
// independently per tornado.
export function drawTornado(
  ctx: CanvasRenderingContext2D,
  x: number,
  frame: number,
  phase: number
) {
  // Geometry
  const topY = 40;
  const baseY = HEIGHT - 70; // sits a bit above the ground so mountains overlap
  const topR = 56;
  const baseR = 9;
  const rings = 7; // fewer rings = big storm-biome savings

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // Flat halo (no radial gradient)
  ctx.fillStyle = "rgba(10,10,18,0.35)";
  ctx.fillRect(x - 70, topY - 10, 140, baseY - topY + 30);

  // Stack of ellipses from top to base, each rotated and swayed slightly
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);              // 0 at top, 1 at base
    const ringY = topY + (baseY - topY) * t;
    // Funnel taper: radius eases out as t→1, gives that hourglass narrowing
    const eased = Math.pow(t, 0.65);
    const ringR = topR * (1 - eased) + baseR * eased;
    // Each ring sways with its own phase offset so the funnel writhes
    const sway = Math.sin(frame * 0.04 + phase + t * 2.8) * (10 + (1 - t) * 18);
    const rx = x + sway;
    // Squashed ellipses for perspective; rotated slowly per-frame
    const rot = frame * 0.06 + i * 0.55 + phase;
    const tilt = Math.sin(rot) * 0.18;
    const ringH = ringR * 0.42;

    // Outer dark shell
    ctx.fillStyle = `rgba(28,28,42,${0.55 + t * 0.20})`;
    ctx.beginPath();
    ctx.ellipse(rx, ringY, ringR, ringH, tilt, 0, Math.PI * 2);
    ctx.fill();

    // Inner lighter highlight on the leading edge
    ctx.fillStyle = `rgba(96,96,128,${0.25 + t * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(rx + ringR * 0.15, ringY, ringR * 0.65, ringH * 0.65, tilt, 0, Math.PI * 2);
    ctx.fill();

    // Wispy streak on the trailing edge
    ctx.strokeStyle = `rgba(160,160,190,${0.18 + t * 0.10})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(rx - ringR * 0.1, ringY, ringR * 1.05, ringH * 1.05, tilt, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Top "thundercloud" overhang
  ctx.fillStyle = "rgba(20,20,32,0.85)";
  ctx.beginPath();
  ctx.ellipse(x, topY - 4, topR + 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(60,60,82,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - topR * 0.3, topY - 8, topR * 0.7, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ground dust kicked up at the base
  const dustY = baseY + 4;
  ctx.fillStyle = "rgba(80,75,90,0.45)";
  for (let i = 0; i < 5; i++) {
    const a = frame * 0.08 + i * 1.3 + phase;
    const dx = x + Math.cos(a) * (18 + i * 4);
    const r = 8 + (i % 3) * 3;
    ctx.beginPath();
    ctx.ellipse(dx, dustY + Math.sin(a) * 2, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Swirling debris specks orbiting the funnel
  ctx.fillStyle = "rgba(180,180,200,0.7)";
  for (let i = 0; i < 4; i++) {
    const spin = frame * 0.12 + i * 0.7 + phase;
    const yT = (i / 9);
    const orbitR = topR * 0.55 * (1 - yT * 0.55);
    const dY = topY + (baseY - topY) * yT;
    const dX = x + Math.cos(spin) * orbitR;
    const dz = Math.sin(spin); // depth cue: dim when behind
    const alpha = 0.35 + dz * 0.4;
    ctx.globalAlpha = Math.max(0.1, alpha);
    ctx.fillRect(dX - 1, dY - 1, 2, 2);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}


export function drawSpaceWarp(ctx: CanvasRenderingContext2D, frame: number) {
  // Simple streaks — no per-streak createLinearGradient
  ctx.save();
  ctx.strokeStyle = "rgba(200,215,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const seed = i * 137.5;
    const y = seed % HEIGHT;
    const speed = 2 + (i % 5);
    const x = WIDTH - ((frame * speed + seed * 3) % (WIDTH + 120));
    const len = 20 + (i % 4) * 16;
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
  }
  ctx.stroke();
  ctx.restore();
}
