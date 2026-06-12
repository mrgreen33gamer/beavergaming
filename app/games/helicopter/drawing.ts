import type {
  Biome, Obstacle, Pickup, RainDrop, Star, Mountain,
  Asteroid, Jet, Bullet,
} from "./types";
import {
  WIDTH, HEIGHT, OBSTACLE_WIDTH, PICKUP_SIZE, HELI_W, HELI_H,
  TILT_FACTOR, TILT_MAX,
} from "./constants";
import { clamp, laserState } from "./helpers";

// ===== Background / sky =====
export function drawBackground(ctx: CanvasRenderingContext2D, biome: Biome, frame = 0) {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, biome.skyTop);
  grad.addColorStop(0.6, biome.skyMid);
  grad.addColorStop(1, biome.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);

  // Underwater light rays from surface
  if (biome.id === "underwater") {
    ctx.save();
    ctx.globalAlpha = 0.06;
    const drift = frame * 0.3;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 200 + drift) % (WIDTH + 200)) - 100;
      const w = 30 + Math.sin(i * 1.7) * 15;
      ctx.fillStyle = "#60d0f0";
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x + w, -10);
      ctx.lineTo(x + w + 60, HEIGHT + 10);
      ctx.lineTo(x + 60, HEIGHT + 10);
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
  // Soft halo
  const grad = ctx.createRadialGradient(620, 110, 5, 620, 110, 80);
  grad.addColorStop(0, biome.sunColor);
  grad.addColorStop(0.4, "rgba(255, 208, 96, 0.4)");
  grad.addColorStop(1, "rgba(255, 208, 96, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(540, 30, 160, 160);
  // Core
  ctx.fillStyle = biome.sunColor;
  ctx.beginPath();
  ctx.arc(620, 110, 22, 0, Math.PI * 2);
  ctx.fill();
}

export function drawRain(ctx: CanvasRenderingContext2D, rain: RainDrop[]) {
  ctx.strokeStyle = "rgba(180, 210, 240, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const r of rain) {
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - 2, r.y + r.length);
  }
  ctx.stroke();
  // Splash dots where rain hits the ground
  ctx.fillStyle = "rgba(180, 210, 240, 0.3)";
  for (const r of rain) {
    if (r.y + r.length > HEIGHT - 20) {
      ctx.beginPath();
      ctx.arc(r.x - 2, HEIGHT - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
  // Body gradient
  const grad = ctx.createLinearGradient(o.x, 0, o.x + OBSTACLE_WIDTH, 0);
  grad.addColorStop(0, biome.pillarMain[0]);
  grad.addColorStop(0.5, biome.pillarMain[1]);
  grad.addColorStop(1, biome.pillarMain[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, 0, OBSTACLE_WIDTH, o.gapY - halfGap);
  ctx.fillRect(o.x, o.gapY + halfGap, OBSTACLE_WIDTH, HEIGHT - (o.gapY + halfGap));
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

// Neon laser gate: standard pillars with emitter nodes on the caps and an
// energy beam spanning the gap that pulses off → charging → on.
function drawLaserGate(ctx: CanvasRenderingContext2D, o: Obstacle, biome: Biome) {
  const halfGap = o.gap / 2;
  const topEdge = o.gapY - halfGap;
  const botEdge = o.gapY + halfGap;
  const cx = o.x + OBSTACLE_WIDTH / 2;
  const state = laserState(o.movePhase);

  // Pillar bodies (neon-tinted)
  const grad = ctx.createLinearGradient(o.x, 0, o.x + OBSTACLE_WIDTH, 0);
  grad.addColorStop(0, biome.pillarMain[0]);
  grad.addColorStop(0.5, biome.pillarMain[1]);
  grad.addColorStop(1, biome.pillarMain[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, 0, OBSTACLE_WIDTH, topEdge);
  ctx.fillRect(o.x, botEdge, OBSTACLE_WIDTH, HEIGHT - botEdge);

  // Emitter housings on the inner faces
  ctx.fillStyle = "#1a0830";
  ctx.fillRect(o.x, topEdge - 10, OBSTACLE_WIDTH, 10);
  ctx.fillRect(o.x, botEdge, OBSTACLE_WIDTH, 10);

  // Emitter glow dots
  const emitColor = state === "on" ? "#ff3060" : state === "charging" ? "#ffd060" : "#e060ff";
  ctx.fillStyle = emitColor;
  ctx.beginPath(); ctx.arc(cx, topEdge - 5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, botEdge + 5, 5, 0, Math.PI * 2); ctx.fill();

  // Beam
  if (state === "charging") {
    // Thin flickering pilot line telegraphing the imminent beam
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.random() * 0.25;
    ctx.strokeStyle = "#ffd060";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, topEdge);
    ctx.lineTo(cx, botEdge);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (state === "on") {
    ctx.save();
    // Outer bloom
    const beamGrad = ctx.createLinearGradient(o.x, 0, o.x + OBSTACLE_WIDTH, 0);
    beamGrad.addColorStop(0, "rgba(255,48,96,0)");
    beamGrad.addColorStop(0.5, "rgba(255,80,120,0.5)");
    beamGrad.addColorStop(1, "rgba(255,48,96,0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(o.x, topEdge, OBSTACLE_WIDTH, botEdge - topEdge);
    // Hot core
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#ff3060";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx, topEdge);
    ctx.lineTo(cx, botEdge);
    ctx.stroke();
    ctx.strokeStyle = "#ff6080";
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, topEdge);
    ctx.lineTo(cx, botEdge);
    ctx.stroke();
    ctx.restore();
  }
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
  // Inner pulsing glow
  const pulseR = 25 + Math.sin(frame * 0.1) * 8;
  const innerGlow = ctx.createRadialGradient(x, y, 5, x, y, pulseR);
  innerGlow.addColorStop(0, "rgba(214, 61, 61, 0.25)");
  innerGlow.addColorStop(1, "rgba(214, 61, 61, 0)");
  ctx.fillStyle = innerGlow;
  ctx.fillRect(x - pulseR, y - pulseR, pulseR * 2, pulseR * 2);
  // Expanding rings
  for (let i = 0; i < 3; i++) {
    const phase = (frame * 0.03 + i * 0.33) % 1;
    const r = 30 + phase * 120;
    const alpha = (1 - phase) * 0.4;
    ctx.strokeStyle = `rgba(255, 80, 80, ${alpha})`;
    ctx.lineWidth = 2.5 - phase * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
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

// Subtle warp-streak accent layered over the space starfield.
export function drawSpaceWarp(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 14; i++) {
    const seed = i * 137.5;
    const y = (seed % HEIGHT);
    const speed = 2 + (i % 5);
    const x = WIDTH - ((frame * speed + seed * 3) % (WIDTH + 120));
    const len = 20 + (i % 4) * 18;
    const g = ctx.createLinearGradient(x, y, x + len, y);
    g.addColorStop(0, "rgba(180,200,255,0)");
    g.addColorStop(1, "rgba(200,215,255,0.5)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}
