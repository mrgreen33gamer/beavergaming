import type {
  Mole, MoleType, Particle, FloatingText,
} from "./types";
import {
  WIDTH, HEIGHT, HOLE_RADIUS,
  HAMMER_SWING_MS, MOLE_SPECS,
} from "./constants";
import { holeCenter } from "./helpers";

// ===== Background =====
export function drawBackground(ctx: CanvasRenderingContext2D, dim: number) {
  // dim: 0..1, how dark to tint (used for late-game pressure in classic mode)
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  const topL = 30 - dim * 14;
  const botL = 18 - dim * 8;
  grad.addColorStop(0, `rgb(${topL}, ${topL * 0.6}, ${topL * 0.45})`);
  grad.addColorStop(1, `rgb(${botL}, ${botL * 0.55}, ${botL * 0.4})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Faint diagonal hatching
  ctx.strokeStyle = `rgba(60, 40, 30, 0.18)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -HEIGHT; i < WIDTH; i += 24) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i + HEIGHT, HEIGHT);
  }
  ctx.stroke();
}

// ===== Hole =====
// Per-hole tiny variations in rim shadow + dirt color so the field doesn't look uniform.
const HOLE_VARIATIONS = [
  { rim: "#2a1810", dirt: "#3a2218", grass: "#5a8c5e" },
  { rim: "#221610", dirt: "#3a2820", grass: "#4a7c4e" },
  { rim: "#1f1208", dirt: "#321e14", grass: "#5fa050" },
  { rim: "#2c1a10", dirt: "#3e2820", grass: "#5a8a5a" },
  { rim: "#241810", dirt: "#3a2418", grass: "#508050" },
  { rim: "#281a12", dirt: "#3c2820", grass: "#5a905a" },
  { rim: "#1f1408", dirt: "#32201a", grass: "#508a4f" },
  { rim: "#2a1c12", dirt: "#3a261e", grass: "#5c8c5c" },
  { rim: "#241408", dirt: "#36241a", grass: "#5a945a" },
];

export function drawHole(ctx: CanvasRenderingContext2D, index: number) {
  const c = holeCenter(index);
  const v = HOLE_VARIATIONS[index] || HOLE_VARIATIONS[0];

  // Grass patch around hole
  ctx.fillStyle = v.grass;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + HOLE_RADIUS - 4, HOLE_RADIUS + 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Grass blades
  ctx.fillStyle = "#3a6a3a";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    const gx = c.x + Math.cos(a) * (HOLE_RADIUS + 10);
    const gy = c.y + HOLE_RADIUS - 4 - Math.sin(a) * 6;
    ctx.fillRect(gx, gy - 3, 1, 3);
  }

  // Hole pit (dark ellipse)
  ctx.fillStyle = v.rim;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, HOLE_RADIUS, HOLE_RADIUS * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner dark depth gradient
  const grad = ctx.createRadialGradient(c.x, c.y - 5, 5, c.x, c.y, HOLE_RADIUS);
  grad.addColorStop(0, "#000");
  grad.addColorStop(1, v.rim);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, HOLE_RADIUS - 4, HOLE_RADIUS * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Foreground dirt mound that covers mole's lower body. Draw AFTER the mole.
export function drawDirtMound(ctx: CanvasRenderingContext2D, index: number) {
  const c = holeCenter(index);
  const v = HOLE_VARIATIONS[index] || HOLE_VARIATIONS[0];
  ctx.fillStyle = v.dirt;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 6, HOLE_RADIUS - 2, HOLE_RADIUS * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlight on top of mound
  ctx.fillStyle = "rgba(255, 220, 180, 0.08)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 2, HOLE_RADIUS - 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Moles =====
// Render a mole at a given hole. riseAmount 0..1 controls how far it pops out.
export function drawMole(
  ctx: CanvasRenderingContext2D,
  mole: Mole,
  riseAmount: number,
  stunProgress: number,
  frame: number
) {
  const c = holeCenter(mole.index);
  // Mole's head center sits at hole center when fully popped, hidden when not.
  // Rise lifts it by ~38 px.
  const yOffset = -riseAmount * 38;
  // Bobble slightly while alive
  const bob = mole.state === "alive" ? Math.sin(frame * 0.18) * 0.8 : 0;
  // Stun: head tilts and shakes
  const stunShakeX = mole.state === "stunned" ? (Math.random() - 0.5) * stunProgress * 4 : 0;
  const stunTilt = mole.state === "stunned" ? stunProgress * 0.3 : 0;

  ctx.save();
  ctx.translate(c.x + stunShakeX, c.y + yOffset + bob);
  ctx.rotate(stunTilt);

  if (mole.type === "bomb") {
    drawBomb(ctx, mole, frame);
  } else {
    drawMoleBody(ctx, mole, frame);
  }

  // Stun stars
  if (mole.state === "stunned" && mole.type !== "bomb") {
    drawStunStars(ctx, frame);
  }

  ctx.restore();
}

// ===== Type-specific mole bodies =====
function drawMoleBody(
  ctx: CanvasRenderingContext2D,
  mole: Mole,
  frame: number
) {
  const spec = MOLE_SPECS[mole.type];
  const isBoss = mole.type === "boss";
  const r = isBoss ? 30 : mole.type === "speedy" ? 22 : 26;
  const stunned = mole.state === "stunned";

  // Speed lines behind speedy moles (when alive)
  if (mole.type === "speedy" && !stunned) {
    ctx.strokeStyle = "rgba(255, 200, 100, 0.6)";
    ctx.lineWidth = 2;
    const phase = (frame * 0.4) % 8;
    for (let i = 0; i < 3; i++) {
      const off = -10 - i * 7 - phase;
      ctx.beginPath();
      ctx.moveTo(-r - 6 + off, -8 + i * 8);
      ctx.lineTo(-r - 14 + off, -8 + i * 8);
      ctx.stroke();
    }
  }

  // Golden sparkles
  if (mole.type === "golden" && !stunned) {
    const sparkAlpha = (Math.sin(frame * 0.25) + 1) * 0.5;
    ctx.fillStyle = `rgba(255, 245, 208, ${sparkAlpha})`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + frame * 0.04;
      const dx = Math.cos(a) * (r + 8);
      const dy = Math.sin(a) * (r + 6) - 4;
      ctx.fillRect(dx - 1.5, dy - 1.5, 3, 3);
    }
  }

  // Freeze: misty halo + ice crystals
  if (mole.type === "freeze" && !stunned) {
    ctx.fillStyle = "rgba(168, 232, 248, 0.35)";
    ctx.beginPath();
    ctx.arc(0, -4, r + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== Body =====
  // Belly (lighter front)
  ctx.fillStyle = spec.light;
  ctx.beginPath();
  ctx.ellipse(0, 4, r - 2, r - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main body
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);  // top half (dome)
  ctx.lineTo(r, 8);
  ctx.lineTo(-r, 8);
  ctx.closePath();
  ctx.fill();
  // Belly highlight
  ctx.fillStyle = "rgba(255, 220, 180, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 6, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = spec.dark;
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 0.6, r * 0.18, 0, Math.PI * 2);
  ctx.arc(r * 0.55, -r * 0.6, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffaaaa";
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 0.6, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.55, -r * 0.6, r * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // ===== Boss helmet =====
  if (isBoss && mole.hitsLeft > 1) {
    // Silver helmet covering top
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(0, -2, r + 2, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#bbb";
    ctx.beginPath();
    ctx.arc(0, -2, r + 2, Math.PI * 1.1, Math.PI * 1.5);
    ctx.fill();
    // Strap
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(-r - 1, -2, (r + 1) * 2, 3);
    // Rivets
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.arc(-r * 0.6, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(r * 0.6, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (isBoss && mole.hitsLeft === 1) {
    // Helmet broken — show scratches on top of head
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -r * 0.7);
    ctx.lineTo(2, -r * 0.5);
    ctx.moveTo(4, -r * 0.8);
    ctx.lineTo(10, -r * 0.55);
    ctx.stroke();
  }

  // ===== Eyes =====
  if (stunned) {
    // X eyes
    ctx.strokeStyle = "#1a0e0a";
    ctx.lineWidth = 2;
    drawX(ctx, -r * 0.4, -r * 0.15, 3);
    drawX(ctx, r * 0.4, -r * 0.15, 3);
  } else {
    // White of eye
    const eyeR = mole.type === "speedy" ? 3 : isBoss ? 4 : 3.5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-r * 0.4, -r * 0.15, eyeR, 0, Math.PI * 2);
    ctx.arc(r * 0.4, -r * 0.15, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // Pupils — type-specific behavior
    ctx.fillStyle = "#1a0e0a";
    if (mole.type === "speedy") {
      // Darting eyes
      const dart = Math.floor(frame / 6) % 4;
      const dx = dart === 0 ? -1 : dart === 2 ? 1 : 0;
      ctx.beginPath();
      ctx.arc(-r * 0.4 + dx, -r * 0.15, 1.5, 0, Math.PI * 2);
      ctx.arc(r * 0.4 + dx, -r * 0.15, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (mole.type === "freeze") {
      // Closed-eye cool look: short dashes
      ctx.fillStyle = "#1a608c";
      ctx.fillRect(-r * 0.4 - 3, -r * 0.15 - 0.5, 6, 1.2);
      ctx.fillRect(r * 0.4 - 3, -r * 0.15 - 0.5, 6, 1.2);
    } else if (isBoss) {
      // Stern: smaller, lower pupils
      ctx.beginPath();
      ctx.arc(-r * 0.4, -r * 0.1, 1.5, 0, Math.PI * 2);
      ctx.arc(r * 0.4, -r * 0.1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Angry brows
      ctx.strokeStyle = spec.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.4);
      ctx.lineTo(-r * 0.25, -r * 0.3);
      ctx.moveTo(r * 0.55, -r * 0.4);
      ctx.lineTo(r * 0.25, -r * 0.3);
      ctx.stroke();
    } else {
      // Normal/golden: round pupils, looking up (surprised)
      ctx.beginPath();
      ctx.arc(-r * 0.4, -r * 0.2, 1.7, 0, Math.PI * 2);
      ctx.arc(r * 0.4, -r * 0.2, 1.7, 0, Math.PI * 2);
      ctx.fill();
      // Gleam
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-r * 0.4 + 0.6, -r * 0.2 - 0.6, 0.8, 0, Math.PI * 2);
      ctx.arc(r * 0.4 + 0.6, -r * 0.2 - 0.6, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== Nose =====
  ctx.fillStyle = "#e07a90";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-2.5, 2);
  ctx.lineTo(2.5, 2);
  ctx.closePath();
  ctx.fill();

  // ===== Mouth / teeth =====
  if (mole.type === "golden") {
    // Big happy smile
    ctx.strokeStyle = "#1a0e0a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 3, 4, 0, Math.PI);
    ctx.stroke();
  } else if (mole.type === "freeze") {
    // Calm smile
    ctx.strokeStyle = "#1a608c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 3, 3, 0, Math.PI);
    ctx.stroke();
  } else if (isBoss && !stunned) {
    // Frown
    ctx.strokeStyle = "#1a0e0a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 8, 3, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (stunned) {
    // Open mouth (KO)
    ctx.fillStyle = "#1a0e0a";
    ctx.beginPath();
    ctx.ellipse(0, 5, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Buck teeth
    ctx.fillStyle = "#fff5d0";
    ctx.fillRect(-2.5, 3, 2, 4);
    ctx.fillRect(0.5, 3, 2, 4);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(-0.5, 3, 1, 4);
  }

  // Whiskers
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-3, 2); ctx.lineTo(-r * 0.7, 0);
  ctx.moveTo(-3, 3); ctx.lineTo(-r * 0.7, 4);
  ctx.moveTo(3, 2);  ctx.lineTo(r * 0.7, 0);
  ctx.moveTo(3, 3);  ctx.lineTo(r * 0.7, 4);
  ctx.stroke();
}

function drawBomb(
  ctx: CanvasRenderingContext2D,
  mole: Mole,
  frame: number
) {
  const r = 24;
  const stunned = mole.state === "stunned";
  // Body
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.arc(-6, -8, 6, 0, Math.PI * 2);
  ctx.fill();
  // Fuse cap
  ctx.fillStyle = "#5a4028";
  ctx.fillRect(-3, -r - 4, 6, 6);
  // Fuse string
  ctx.strokeStyle = "#8a6a40";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r - 4);
  ctx.quadraticCurveTo(8, -r - 12, 6, -r - 18);
  ctx.stroke();
  // Sparking tip
  if (!stunned) {
    const sparkR = 3 + Math.sin(frame * 0.5) * 1.5;
    ctx.fillStyle = `rgba(255, 200, 60, ${0.8 + Math.sin(frame * 0.5) * 0.2})`;
    ctx.beginPath();
    ctx.arc(6, -r - 18, sparkR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(6, -r - 18, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes
  ctx.fillStyle = "#ff5050";
  ctx.beginPath();
  ctx.arc(-7, -3, 2.5, 0, Math.PI * 2);
  ctx.arc(7, -3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0e0a";
  ctx.beginPath();
  ctx.arc(-7, -3, 1.2, 0, Math.PI * 2);
  ctx.arc(7, -3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Angry brows
  ctx.strokeStyle = "#ff5050";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -10); ctx.lineTo(-4, -6);
  ctx.moveTo(12, -10);  ctx.lineTo(4, -6);
  ctx.stroke();
  // Frown
  ctx.strokeStyle = "#ff5050";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 12, 4, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

function drawStunStars(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.fillStyle = "#ffd060";
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + frame * 0.15;
    const sx = Math.cos(a) * 18;
    const sy = Math.sin(a) * 12 - 24;
    // Draw star
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(1, -1);
    ctx.lineTo(3, 0);
    ctx.lineTo(1, 1);
    ctx.lineTo(0, 3);
    ctx.lineTo(-1, 1);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ===== Hammer cursor =====
// swingProgress: 0..1, where 0 = at rest and 1 = mid-swing (peak).
export function drawHammer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  swingProgress: number
) {
  // Hammer "phase": ramp up to 1 quickly, then fall back to 0 over longer
  let phase = 0;
  if (swingProgress > 0 && swingProgress < 1) {
    if (swingProgress < 0.3) phase = swingProgress / 0.3;
    else phase = (1 - swingProgress) / 0.7;
  }
  phase = Math.max(0, Math.min(1, phase));

  // Rotation: rest = -π/4 (upper-right), peak = -π/2 (straight up).
  const restRot = -Math.PI / 4;
  const peakRot = -Math.PI / 2;
  const rot = restRot + (peakRot - restRot) * phase;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // Local frame: +x is handle direction (away from impact head)
  // Handle
  ctx.fillStyle = "#7a5a30";
  ctx.fillRect(0, -3, 38, 6);
  ctx.fillStyle = "#5a3a20";
  ctx.fillRect(0, 2, 38, 1);
  ctx.fillStyle = "#9a7a50";
  ctx.fillRect(0, -3, 38, 1);
  // Grip wrap
  ctx.fillStyle = "#3a2218";
  ctx.fillRect(28, -4, 6, 8);
  ctx.fillStyle = "#5a3a25";
  ctx.fillRect(28, -3, 6, 6);
  // Hammer head
  ctx.fillStyle = "#444";
  ctx.fillRect(-12, -14, 20, 28);
  ctx.fillStyle = "#666";
  ctx.fillRect(-12, -14, 20, 4);
  ctx.fillStyle = "#222";
  ctx.fillRect(-12, 10, 20, 4);
  // Bright stripe
  ctx.fillStyle = "#888";
  ctx.fillRect(4, -14, 4, 28);
  ctx.restore();
}

// ===== Impact flash =====
// Drawn at click point, fades over ~200ms.
export function drawImpactFlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  maxAge: number
) {
  const t = age / maxAge;
  if (t >= 1) return;
  const r = 12 + t * 30;
  const alpha = (1 - t) * 0.8;
  const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
  grad.addColorStop(0, `rgba(255, 255, 230, ${alpha})`);
  grad.addColorStop(1, "rgba(255, 200, 100, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ===== Freeze overlay =====
export function drawFreezeOverlay(
  ctx: CanvasRenderingContext2D,
  intensity: number,
  frame: number
) {
  if (intensity <= 0) return;
  ctx.fillStyle = `rgba(168, 232, 248, ${0.18 * intensity})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Drifting ice flakes
  ctx.fillStyle = `rgba(220, 240, 255, ${0.55 * intensity})`;
  for (let i = 0; i < 24; i++) {
    const fx = (i * 67 + frame * 0.6) % WIDTH;
    const fy = (i * 41 + frame * 0.8) % HEIGHT;
    ctx.fillRect(fx, fy, 2, 2);
  }
}

// ===== Screen flash (bomb / freeze pickup) =====
export function drawScreenFlash(
  ctx: CanvasRenderingContext2D,
  color: string,
  intensity: number
) {
  if (intensity <= 0) return;
  ctx.fillStyle = color.replace("ALPHA", String(0.6 * intensity));
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// ===== Particles =====
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[]
) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ===== Floating texts =====
export function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[]
) {
  for (const ft of texts) {
    ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 2);
    const size = Math.floor(13 * ft.scale);
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
}

export { holeCenter };
