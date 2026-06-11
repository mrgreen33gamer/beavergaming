import type {
  Arrow, Apple, AppleChunk, JuiceParticle, GrassBlade, Mood,
} from "./types";
import {
  WIDTH, HEIGHT, GROUND_Y, ARCHER_X, ARCHER_Y, APPLE_RADIUS,
} from "./constants";

// ===== Sky / atmosphere =====
export function drawSky(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#1a0e0a");
  sky.addColorStop(0.6, "#2a1810");
  sky.addColorStop(1, "#5a3a25");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, GROUND_Y);
}

export function drawMoon(ctx: CanvasRenderingContext2D) {
  // Crescent moon
  ctx.fillStyle = "#f5e8d0";
  ctx.beginPath();
  ctx.arc(650, 70, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0e0a";
  ctx.beginPath();
  ctx.arc(657, 65, 18, 0, Math.PI * 2);
  ctx.fill();
}

export function drawClouds(
  ctx: CanvasRenderingContext2D,
  cloudOffset: number,
  wind: number
) {
  ctx.fillStyle = "rgba(80, 50, 35, 0.5)";
  // Clouds drift with wind (slight speed-up)
  const eff = cloudOffset + wind * 0.4;
  for (let i = 0; i < 4; i++) {
    const cx = (i * 250 + eff) % (WIDTH + 200) - 100;
    const cy = 60 + i * 25;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 50, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 30, cy - 8, 35, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGround(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  // green top strip
  ctx.fillStyle = "#7fd650";
  ctx.fillRect(0, GROUND_Y, WIDTH, 2);
}

// ===== Grass that sways with wind =====
export function drawGrass(
  ctx: CanvasRenderingContext2D,
  blades: GrassBlade[],
  wind: number,
  frame: number
) {
  ctx.strokeStyle = "#5fb030";
  ctx.lineWidth = 1;
  const windEffect = wind * 0.45;
  const swayAmp = 0.05 + Math.abs(wind) * 0.35;
  for (const b of blades) {
    const sway = Math.sin(frame * 0.1 + b.phase) * swayAmp;
    const tilt = windEffect + sway;
    // Tilted blade from (b.x, GROUND_Y) upward
    const tipX = b.x + Math.sin(tilt) * b.height;
    const tipY = GROUND_Y - Math.cos(tilt) * b.height;
    ctx.beginPath();
    ctx.moveTo(b.x, GROUND_Y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }
}

// ===== Wind indicator (top-right HUD strip) =====
export function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  wind: number
) {
  if (Math.abs(wind) <= 0.05) return;
  const wx = WIDTH - 130;
  const wy = 30;
  ctx.fillStyle = "#f5e8d0";
  ctx.font = "11px monospace";
  ctx.fillText("WIND", wx, wy - 5);
  ctx.strokeStyle = "#7fd650";
  ctx.lineWidth = 2;
  const arrowLen = Math.abs(wind) * 50;
  const dir = wind > 0 ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(wx + 50, wy);
  ctx.lineTo(wx + 50 + arrowLen * dir, wy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx + 50 + arrowLen * dir, wy);
  ctx.lineTo(wx + 50 + (arrowLen - 6) * dir, wy - 4);
  ctx.moveTo(wx + 50 + arrowLen * dir, wy);
  ctx.lineTo(wx + 50 + (arrowLen - 6) * dir, wy + 4);
  ctx.stroke();
}

// ===== Archer (left) =====
export function drawArcher(
  ctx: CanvasRenderingContext2D,
  drawing: boolean,
  power: number
) {
  const x = ARCHER_X;
  const y = ARCHER_Y;
  const skin = "#f5d0a0";
  const shirt = "#5a8c5e";

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y - 60, 8, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(x - 8, y - 66, 16, 4);
  // Body
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 6, y - 50, 12, 20);
  // Pants
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(x - 6, y - 30, 5, 22);
  ctx.fillRect(x + 1, y - 30, 5, 22);
  // Boots
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(x - 7, y - 10, 6, 4);
  ctx.fillRect(x + 1, y - 10, 6, 4);

  // Bow + string
  const bowX = x + 14;
  const bowY = y - 38;
  ctx.strokeStyle = "#a04020";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(bowX, bowY, 18, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = "#f5e8d0";
  ctx.lineWidth = 1;
  const stringPull = drawing ? (power / 200) * 10 : 0;
  ctx.beginPath();
  ctx.moveTo(bowX, bowY - 18);
  ctx.lineTo(bowX - stringPull, bowY);
  ctx.lineTo(bowX, bowY + 18);
  ctx.stroke();
  // Arms
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 45);
  ctx.lineTo(bowX, bowY);
  ctx.stroke();
}

// ===== Friend (target) with mood + arm pose =====
// Arms extend if level has hand apples.
export function drawFriend(
  ctx: CanvasRenderingContext2D,
  friendX: number,
  mood: Mood,
  applesActive: Apple[],
  frame: number
) {
  const x = friendX;
  const y = ARCHER_Y;
  const skin = "#b8a088";
  const shirt = "#8048a8";

  // Cheer = small bounce
  let bounce = 0;
  if (mood === "cheer") {
    bounce = Math.sin(frame * 0.35) * 2;
  } else if (mood === "panic") {
    bounce = Math.sin(frame * 0.6) * 1.2;
  }

  // Body
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 6, y - 50 + bounce, 12, 20);
  // Pants
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(x - 6, y - 30, 5, 22);
  ctx.fillRect(x + 1, y - 30, 5, 22);
  // Boots
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(x - 7, y - 10, 6, 4);
  ctx.fillRect(x + 1, y - 10, 6, 4);

  // Arms — pose depends on which apples are present and on mood.
  const hasLeftApple = applesActive.some((a) => a.pos === "left_hand" && !a.hit);
  const hasRightApple = applesActive.some((a) => a.pos === "right_hand" && !a.hit);

  ctx.strokeStyle = skin;
  ctx.lineWidth = 3;

  if (mood === "flinch") {
    // Arms up shielding head
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 45 + bounce);
    ctx.lineTo(x - 9, y - 60 + bounce);
    ctx.lineTo(x - 3, y - 66 + bounce);
    ctx.moveTo(x + 6, y - 45 + bounce);
    ctx.lineTo(x + 9, y - 60 + bounce);
    ctx.lineTo(x + 3, y - 66 + bounce);
    ctx.stroke();
  } else if (mood === "cheer") {
    // Fist pump (one arm up)
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 45 + bounce);
    ctx.lineTo(x - 12, y - 35 + bounce);
    ctx.moveTo(x + 6, y - 45 + bounce);
    ctx.lineTo(x + 12, y - 65 + bounce);
    ctx.stroke();
    // Fist
    ctx.fillStyle = skin;
    ctx.fillRect(x + 10, y - 70 + bounce, 5, 5);
  } else if (mood === "panic") {
    // Both arms flailing
    const flail = Math.sin(frame * 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 45 + bounce);
    ctx.lineTo(x - 16, y - 38 + bounce - flail);
    ctx.moveTo(x + 6, y - 45 + bounce);
    ctx.lineTo(x + 16, y - 38 + bounce + flail);
    ctx.stroke();
  } else {
    // Default poses, possibly holding apples in hands.
    // Left arm
    if (hasLeftApple) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 45 + bounce);
      ctx.lineTo(x - 22, y - 48 + bounce);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 45 + bounce);
      ctx.lineTo(x - 12, y - 35 + bounce);
      ctx.stroke();
    }
    // Right arm
    if (hasRightApple) {
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 45 + bounce);
      ctx.lineTo(x + 22, y - 48 + bounce);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 45 + bounce);
      ctx.lineTo(x + 12, y - 35 + bounce);
      ctx.stroke();
    }
  }

  // Head + face
  drawFriendHead(ctx, x, y - 60 + bounce, mood, frame);
}

function drawFriendHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  mood: Mood,
  frame: number
) {
  const skin = "#b8a088";
  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  // Face features by mood
  ctx.fillStyle = "#1a0e0a";
  if (mood === "idle") {
    // Dots
    ctx.fillRect(cx - 3, cy - 2, 1.5, 1.5);
    ctx.fillRect(cx + 1.5, cy - 2, 1.5, 1.5);
    // Neutral mouth
    ctx.fillRect(cx - 2, cy + 3, 4, 1);
  } else if (mood === "worried") {
    // Dots
    ctx.fillRect(cx - 3, cy - 2, 1.5, 1.5);
    ctx.fillRect(cx + 1.5, cy - 2, 1.5, 1.5);
    // Small O mouth
    ctx.beginPath();
    ctx.arc(cx, cy + 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Sweat drop
    ctx.fillStyle = "#5fc8e0";
    ctx.beginPath();
    ctx.arc(cx + 6, cy - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === "panic") {
    // Big circle eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0e0a";
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, 1.2, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // BIG O mouth
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Speech bubble bursting
    if (Math.floor(frame / 12) % 2 === 0) {
      ctx.fillStyle = "#ff5050";
      ctx.font = "bold 11px monospace";
      ctx.fillText("AH!", cx - 12, cy - 14);
    }
  } else if (mood === "flinch") {
    // Closed eyes (lines)
    ctx.fillRect(cx - 4, cy - 2, 3, 1);
    ctx.fillRect(cx + 1, cy - 2, 3, 1);
    // Grimace mouth
    ctx.fillRect(cx - 3, cy + 3, 6, 1);
  } else if (mood === "cheer") {
    // Closed-eye smile (^^)
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 1);
    ctx.lineTo(cx - 2, cy - 3);
    ctx.lineTo(cx, cy - 1);
    ctx.moveTo(cx, cy - 1);
    ctx.lineTo(cx + 2, cy - 3);
    ctx.lineTo(cx + 4, cy - 1);
    ctx.strokeStyle = "#1a0e0a";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Happy mouth
    ctx.fillStyle = "#1a0e0a";
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 3, 0, Math.PI);
    ctx.fill();
    // Speech bubble
    if (Math.floor(frame / 18) % 2 === 0) {
      ctx.fillStyle = "#7fd650";
      ctx.font = "bold 10px monospace";
      ctx.fillText("PHEW!", cx - 14, cy - 14);
    }
  }
}

// ===== Apple =====
export function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + APPLE_RADIUS - 1, APPLE_RADIUS, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = "#d63d3d";
  ctx.beginPath();
  ctx.arc(x, y, APPLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = "#ff8a3d";
  ctx.beginPath();
  ctx.arc(x - 4, y - 5, APPLE_RADIUS * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Stem
  ctx.strokeStyle = "#3a2218";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - APPLE_RADIUS);
  ctx.lineTo(x + 2, y - APPLE_RADIUS - 5);
  ctx.stroke();
  // Leaf
  ctx.fillStyle = "#7fd650";
  ctx.beginPath();
  ctx.ellipse(x + 6, y - APPLE_RADIUS - 4, 4, 2, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Apple chunks =====
export function drawChunks(
  ctx: CanvasRenderingContext2D,
  chunks: AppleChunk[]
) {
  for (const c of chunks) {
    const alpha = Math.min(1, c.life / c.maxLife);
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation);
    if (c.type === "stem") {
      ctx.fillStyle = c.color;
      ctx.fillRect(-1, -c.size, 2, c.size * 2);
    } else {
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ===== Juice =====
export function drawJuice(
  ctx: CanvasRenderingContext2D,
  juice: JuiceParticle[]
) {
  for (const j of juice) {
    ctx.globalAlpha = Math.max(0, j.life / j.maxLife);
    ctx.fillStyle = j.color;
    ctx.fillRect(j.x - j.size / 2, j.y - j.size / 2, j.size, j.size);
  }
  ctx.globalAlpha = 1;
}

// ===== Arrow with trail =====
export function drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow) {
  // Trail first (behind arrow)
  if (arrow.trail.length > 1) {
    for (let i = 0; i < arrow.trail.length - 1; i++) {
      const t1 = arrow.trail[i];
      const t2 = arrow.trail[i + 1];
      const alpha = (t1.life / 14) * 0.5;
      ctx.strokeStyle = `rgba(255, 220, 120, ${alpha})`;
      ctx.lineWidth = alpha * 2;
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.stroke();
    }
  }

  // Arrow body
  const angle = arrow.stuck ? arrow.stuckAngle : Math.atan2(arrow.vy, arrow.vx);
  ctx.save();
  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(angle);
  // Shaft
  ctx.fillStyle = "#d4b896";
  ctx.fillRect(-22, -1.5, 22, 3);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-22, 0.5, 22, 1);
  // Head
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -4);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();
  // Fletching
  ctx.fillStyle = "#d63d3d";
  ctx.beginPath();
  ctx.moveTo(-22, -1.5);
  ctx.lineTo(-26, -4);
  ctx.lineTo(-20, -1.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-22, 1.5);
  ctx.lineTo(-26, 4);
  ctx.lineTo(-20, 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ===== Trajectory preview =====
export function drawTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  vx0: number,
  vy0: number,
  gravity: number,
  wind: number,
  frames: number
) {
  let px = startX;
  let py = startY;
  let pvx = vx0;
  let pvy = vy0;
  for (let i = 0; i < frames; i++) {
    px += pvx;
    py += pvy;
    pvy += gravity;
    pvx += wind * 0.04;
    if (py >= GROUND_Y) break;
    if (i % 2 === 0) {
      const alpha = 0.6 - (i / frames) * 0.5;
      ctx.fillStyle = `rgba(255, 107, 26, ${alpha})`;
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
  }
}
