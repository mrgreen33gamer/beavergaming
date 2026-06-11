import type {
  Point, Food, Powerup, Wall, Direction, Particle, FloatingText,
} from "./types";
import {
  GRID, COLS, ROWS, WIDTH, HEIGHT,
  UNDULATION_AMPLITUDE, BLINK_INTERVAL, BLINK_DURATION,
  TONGUE_DURATION, BONUS_LIFESPAN_MS,
  POWERUP_LIFESPAN_MS, POWERUP_WARNING_MS,
  OBSTACLE_WARNING_MS, POISON_LIFESPAN_MS,
} from "./constants";
import { dirVec } from "./mazes";

// ===== Background =====
export function drawBackground(ctx: CanvasRenderingContext2D, frame: number) {
  // Subtle pulse on base bg
  const pulse = 1 + Math.sin(frame * 0.02) * 0.04;
  ctx.fillStyle = "#0a0608";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Checker grid with pulsing brightness
  const baseLum = 26 * pulse; // mid 20s
  ctx.fillStyle = `rgb(${baseLum}, ${baseLum * 0.55}, ${baseLum * 0.4})`;
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * GRID, y * GRID, GRID, GRID);
      }
    }
  }
  // Inner border
  ctx.strokeStyle = "#3a2218";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);
}

// ===== Walls (maze + obstacles) =====
export function drawWalls(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  now: number
) {
  for (const w of walls) {
    let alpha = 1;
    if (w.expiresAt !== null) {
      const remaining = w.expiresAt - now;
      if (remaining < OBSTACLE_WARNING_MS) {
        // Blink in the final 3 seconds
        const blink = Math.floor(remaining / 150) % 2 === 0;
        alpha = blink ? 0.85 : 0.35;
      }
    }
    ctx.globalAlpha = alpha;
    const cx = w.x * GRID;
    const cy = w.y * GRID;
    // Brick block
    ctx.fillStyle = "#5a3a25";
    ctx.fillRect(cx + 1, cy + 1, GRID - 2, GRID - 2);
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(cx + 1, cy + 1, GRID - 2, 4);
    ctx.fillStyle = "#3a2218";
    ctx.fillRect(cx + 1, cy + GRID - 5, GRID - 2, 4);
    // Mortar lines
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(cx + 1, cy + GRID / 2, GRID - 2, 1);
    ctx.fillRect(cx + GRID / 2, cy + 1, 1, GRID / 2);
    ctx.fillRect(cx + GRID / 2 - 4, cy + GRID / 2, 1, GRID / 2);
  }
  ctx.globalAlpha = 1;
}

// ===== Food =====
export function drawFood(
  ctx: CanvasRenderingContext2D,
  food: Food,
  frame: number
) {
  const pulse = Math.sin(frame * 0.15) * 1.5;
  const cx = food.x * GRID + GRID / 2;
  const cy = food.y * GRID + GRID / 2;
  // Glow
  ctx.fillStyle = "rgba(214, 61, 61, 0.3)";
  ctx.beginPath();
  ctx.arc(cx, cy, GRID / 2 - 2 + pulse, 0, Math.PI * 2);
  ctx.fill();
  // Apple body
  ctx.fillStyle = "#d63d3d";
  ctx.beginPath();
  ctx.arc(cx, cy, GRID / 2 - 5, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = "#ff8a3d";
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Stem
  ctx.fillStyle = "#7fd650";
  ctx.fillRect(cx - 1, cy - GRID / 2 + 3, 2, 3);
}

// ===== Bonus food (gold star) =====
export function drawBonusFood(
  ctx: CanvasRenderingContext2D,
  food: Food,
  frame: number,
  now: number
) {
  if (!food.spawnedAt) return;
  const remaining = BONUS_LIFESPAN_MS - (now - food.spawnedAt);
  // Blink near end
  if (remaining < 1500 && Math.floor(remaining / 150) % 2 === 0) return;
  const bcx = food.x * GRID + GRID / 2;
  const bcy = food.y * GRID + GRID / 2;
  const bpulse = Math.sin(frame * 0.2) * 2;
  // Glow
  ctx.fillStyle = "rgba(255, 208, 96, 0.3)";
  ctx.beginPath();
  ctx.arc(bcx, bcy, GRID / 2 + bpulse, 0, Math.PI * 2);
  ctx.fill();
  // Star shape
  ctx.fillStyle = "#ffd060";
  ctx.beginPath();
  ctx.moveTo(bcx, bcy - GRID / 2 + 3);
  ctx.lineTo(bcx + 3, bcy - 3);
  ctx.lineTo(bcx + GRID / 2 - 3, bcy);
  ctx.lineTo(bcx + 3, bcy + 3);
  ctx.lineTo(bcx, bcy + GRID / 2 - 3);
  ctx.lineTo(bcx - 3, bcy + 3);
  ctx.lineTo(bcx - GRID / 2 + 3, bcy);
  ctx.lineTo(bcx - 3, bcy - 3);
  ctx.closePath();
  ctx.fill();
  // Highlight
  ctx.fillStyle = "#fff5d0";
  ctx.beginPath();
  ctx.arc(bcx - 2, bcy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Power-ups =====
export function drawPowerup(
  ctx: CanvasRenderingContext2D,
  p: Powerup,
  frame: number,
  now: number
) {
  const remaining = POWERUP_LIFESPAN_MS - (now - p.spawnedAt);
  if (remaining < POWERUP_WARNING_MS && Math.floor(remaining / 150) % 2 === 0) {
    return; // blink off
  }
  const cx = p.x * GRID + GRID / 2;
  const cy = p.y * GRID + GRID / 2;
  const bob = Math.sin(frame * 0.12 + p.x * 0.5) * 1.5;

  // Background glow color per type
  const glowColor =
    p.type === "slow"   ? "rgba(140, 110, 220, 0.4)" :
    p.type === "ghost"  ? "rgba(220, 220, 255, 0.4)" :
    p.type === "shrink" ? "rgba(255, 140, 60, 0.4)" :
    p.type === "speed"  ? "rgba(80, 200, 255, 0.4)" :
                          "rgba(255, 208, 96, 0.4)"; // multi

  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(cx, cy + bob, GRID / 2 + 2, 0, Math.PI * 2);
  ctx.fill();

  if (p.type === "slow") drawSlowIcon(ctx, cx, cy + bob, frame);
  else if (p.type === "ghost") drawGhostIcon(ctx, cx, cy + bob, frame);
  else if (p.type === "shrink") drawShrinkIcon(ctx, cx, cy + bob);
  else if (p.type === "speed") drawSpeedIcon(ctx, cx, cy + bob);
  else drawMultiIcon(ctx, cx, cy + bob);
}

function drawSlowIcon(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  // Hourglass
  ctx.fillStyle = "#8c6edc";
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 7);
  ctx.lineTo(x + 6, y - 7);
  ctx.lineTo(x + 6, y - 6);
  ctx.lineTo(x + 1, y);
  ctx.lineTo(x + 6, y + 6);
  ctx.lineTo(x + 6, y + 7);
  ctx.lineTo(x - 6, y + 7);
  ctx.lineTo(x - 6, y + 6);
  ctx.lineTo(x - 1, y);
  ctx.lineTo(x - 6, y - 6);
  ctx.closePath();
  ctx.fill();
  // Sand level animation
  const t = (Math.sin(frame * 0.07) + 1) / 2;
  ctx.fillStyle = "#ffd060";
  // top
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 6);
  ctx.lineTo(x + 5, y - 6);
  ctx.lineTo(x + 1, y - 6 + 5 * (1 - t));
  ctx.lineTo(x - 1, y - 6 + 5 * (1 - t));
  ctx.closePath();
  ctx.fill();
  // bottom
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 6);
  ctx.lineTo(x + 5, y + 6);
  ctx.lineTo(x + 1, y + 6 - 5 * t);
  ctx.lineTo(x - 1, y + 6 - 5 * t);
  ctx.closePath();
  ctx.fill();
}

function drawGhostIcon(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const wobble = Math.sin(frame * 0.15) * 0.5;
  // Body
  ctx.fillStyle = "rgba(245, 245, 255, 0.92)";
  ctx.beginPath();
  ctx.arc(x, y - 2, 6, Math.PI, 0);
  ctx.lineTo(x + 6, y + 6);
  // Wavy bottom
  ctx.lineTo(x + 4 + wobble, y + 4);
  ctx.lineTo(x + 2, y + 6);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x - 2, y + 6);
  ctx.lineTo(x - 4 + wobble, y + 4);
  ctx.lineTo(x - 6, y + 6);
  ctx.closePath();
  ctx.fill();
  // Eyes
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(x - 3, y - 2, 1.5, 2.5);
  ctx.fillRect(x + 1.5, y - 2, 1.5, 2.5);
}

function drawShrinkIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Scissors: two diagonal blades + small circles for handles
  ctx.strokeStyle = "#c0c0c8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 4);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 6, y - 4);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
  // Pivot
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Handle rings
  ctx.strokeStyle = "#ff8a3d";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x - 6, y - 4, 2, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 4, 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMultiIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Background coin
  ctx.fillStyle = "#ffd060";
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a06820";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  // "x2" text
  ctx.fillStyle = "#ffd060";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("×2", x, y + 1);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawSpeedIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Lightning bolt
  ctx.fillStyle = "#50c8ff";
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 8);
  ctx.lineTo(x - 3, y);
  ctx.lineTo(x + 1, y);
  ctx.lineTo(x - 2, y + 8);
  ctx.lineTo(x + 3, y);
  ctx.lineTo(x - 1, y);
  ctx.closePath();
  ctx.fill();
  // Bright core
  ctx.fillStyle = "#a0e8ff";
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 5);
  ctx.lineTo(x - 1, y);
  ctx.lineTo(x + 1, y);
  ctx.lineTo(x - 1, y + 5);
  ctx.lineTo(x + 1, y);
  ctx.lineTo(x - 1, y);
  ctx.closePath();
  ctx.fill();
}

// ===== Poison food (toxic skull) =====
export function drawPoisonFood(
  ctx: CanvasRenderingContext2D,
  food: Food,
  frame: number,
  now: number
) {
  if (!food.spawnedAt) return;
  const remaining = POISON_LIFESPAN_MS - (now - food.spawnedAt);
  // Blink near end
  if (remaining < 2000 && Math.floor(remaining / 150) % 2 === 0) return;
  const cx = food.x * GRID + GRID / 2;
  const cy = food.y * GRID + GRID / 2;
  const pulse = Math.sin(frame * 0.18) * 1.5;
  // Toxic glow
  ctx.fillStyle = "rgba(140, 60, 200, 0.35)";
  ctx.beginPath();
  ctx.arc(cx, cy, GRID / 2 + pulse, 0, Math.PI * 2);
  ctx.fill();
  // Skull body (circle)
  ctx.fillStyle = "#9040c0";
  ctx.beginPath();
  ctx.arc(cx, cy - 1, GRID / 2 - 5, 0, Math.PI * 2);
  ctx.fill();
  // Jaw
  ctx.fillRect(cx - 4, cy + 2, 8, 4);
  // Eye sockets
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(cx - 4, cy - 4, 3, 3);
  ctx.fillRect(cx + 1, cy - 4, 3, 3);
  // Nose
  ctx.fillRect(cx - 1, cy, 2, 2);
  // Teeth
  ctx.fillStyle = "#d0b0e0";
  ctx.fillRect(cx - 3, cy + 3, 2, 2);
  ctx.fillRect(cx + 1, cy + 3, 2, 2);
}

// ===== Snake =====
// Renders the snake body with undulation, optional ghost translucency,
// blinking eyes, and a tongue flick when recently eaten.
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Point[],
  direction: Direction,
  frame: number,
  ghostActive: boolean,
  tongueAt: number,
  now: number,
  alive: boolean
) {
  const tonguing = alive && now - tongueAt < (TONGUE_DURATION * 16);

  // Blink: eyes closed during BLINK_DURATION frames of every BLINK_INTERVAL
  const blinkPhase = frame % BLINK_INTERVAL;
  const blinking = blinkPhase < BLINK_DURATION;

  ctx.globalAlpha = ghostActive ? 0.55 : 1;

  for (let i = 0; i < snake.length; i++) {
    const seg = snake[i];
    const isHead = i === 0;
    const cx = seg.x * GRID + GRID / 2;
    const cy = seg.y * GRID + GRID / 2;
    // Undulation: per-segment sine offset
    const wave = Math.sin(frame * 0.12 + i * 0.55) * UNDULATION_AMPLITUDE;
    // Direction-perpendicular wobble for the body
    const wobbleX = direction === "up" || direction === "down" ? wave : 0;
    const wobbleY = direction === "left" || direction === "right" ? wave : 0;
    const segX = cx + wobbleX;
    const segY = cy + wobbleY;

    const radius = isHead ? GRID / 2 - 1 : GRID / 2 - 2;
    // Dark ring
    ctx.fillStyle = isHead ? "#4a8c20" : "#3a7820";
    ctx.beginPath();
    ctx.arc(segX, segY, radius + 1, 0, Math.PI * 2);
    ctx.fill();
    // Inner body — alternating shades for stripes
    ctx.fillStyle = isHead ? "#7fd650" : (i % 3 === 0 ? "#5fb030" : "#6fc040");
    ctx.beginPath();
    ctx.arc(segX, segY, radius - 1, 0, Math.PI * 2);
    ctx.fill();

    // Connector to next segment
    if (i < snake.length - 1) {
      const next = snake[i + 1];
      const nx = next.x * GRID + GRID / 2;
      const ny = next.y * GRID + GRID / 2;
      ctx.fillStyle = "#5fb030";
      const dx = nx - segX;
      const dy = ny - segY;
      ctx.fillRect(
        segX + Math.min(0, dx) - (Math.abs(dx) < 1 ? radius - 2 : 0),
        segY + Math.min(0, dy) - (Math.abs(dy) < 1 ? radius - 2 : 0),
        Math.abs(dx) + (Math.abs(dx) < 1 ? (radius - 2) * 2 : 0),
        Math.abs(dy) + (Math.abs(dy) < 1 ? (radius - 2) * 2 : 0)
      );
    }

    if (isHead && alive) {
      const v = dirVec[direction];
      // Eyes
      ctx.fillStyle = ghostActive ? "rgba(255,255,255,0.6)" : "#fff";
      if (blinking) {
        // Closed eyes - draw dashes
        ctx.fillRect(segX + v.x * 3 - v.y * 3 - 2, segY + v.y * 3 - v.x * 3 - 0.5, 4, 1);
        ctx.fillRect(segX + v.x * 3 + v.y * 3 - 2, segY + v.y * 3 + v.x * 3 - 0.5, 4, 1);
      } else {
        ctx.beginPath();
        ctx.arc(segX + v.x * 3 - v.y * 3, segY + v.y * 3 - v.x * 3, 2.5, 0, Math.PI * 2);
        ctx.arc(segX + v.x * 3 + v.y * 3, segY + v.y * 3 + v.x * 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0608";
        ctx.beginPath();
        ctx.arc(segX + v.x * 4 - v.y * 3, segY + v.y * 4 - v.x * 3, 1.2, 0, Math.PI * 2);
        ctx.arc(segX + v.x * 4 + v.y * 3, segY + v.y * 4 + v.x * 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tongue flick
      if (tonguing) {
        const tongueLen = 6 + Math.sin((now - tongueAt) * 0.04) * 2;
        const tx = segX + v.x * (radius + tongueLen);
        const ty = segY + v.y * (radius + tongueLen);
        ctx.strokeStyle = "#ff5050";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(segX + v.x * radius, segY + v.y * radius);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        // Forked tip
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + v.y * 2, ty - v.x * 2);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - v.y * 2, ty + v.x * 2);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ===== Speed trail =====
export function drawSpeedTrail(
  ctx: CanvasRenderingContext2D,
  trail: Point[]
) {
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    const alpha = (i / trail.length) * 0.35;
    ctx.fillStyle = `rgba(127, 214, 80, ${alpha})`;
    const cx = t.x * GRID + GRID / 2;
    const cy = t.y * GRID + GRID / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, (GRID / 2 - 4) * (i / trail.length), 0, Math.PI * 2);
    ctx.fill();
  }
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
    const alpha = Math.min(1, (ft.life / ft.maxLife) * 2);
    ctx.globalAlpha = alpha;
    const size = Math.floor(12 * ft.scale);
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
