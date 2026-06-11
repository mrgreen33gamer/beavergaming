import type { Building, Unit, Enemy } from "./types";
import { CENTER, BASE_SIZE, BASE_MAX_HP, SLOT_RADIUS } from "./constants";
import { BUILDING_SPECS } from "./specs";

// ===== HQ =====
export function drawBase(ctx: CanvasRenderingContext2D, hp: number, frame: number) {
  const x = CENTER.x;
  const y = CENTER.y;
  const size = BASE_SIZE;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 6, size * 0.7, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const damaged = hp / BASE_MAX_HP < 0.3;

  // Body
  ctx.fillStyle = damaged ? "#5a3a30" : "#6a5040";
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  // Top highlight
  ctx.fillStyle = damaged ? "#7a5a40" : "#8a7060";
  ctx.fillRect(x - size / 2, y - size / 2, size, 6);
  // Bottom shadow
  ctx.fillStyle = "#3a2820";
  ctx.fillRect(x - size / 2, y + size / 2 - 6, size, 6);

  // Corner reinforcements
  ctx.fillStyle = "#3a2820";
  for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) {
    ctx.fillRect(x + (cx * size) / 2 - 4, y + (cy * size) / 2 - 4, 8, 8);
  }

  // Sandbags
  ctx.fillStyle = "#8a6a40";
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(x - 12 + i * 8, y + size / 2 - 2, 6, 4);
  }

  // HQ text
  ctx.fillStyle = "#ffd060";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HQ", x, y);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  // Antenna
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + size / 2 - 8, y - size / 2);
  ctx.lineTo(x + size / 2 - 8, y - size / 2 - 14);
  ctx.stroke();
  if (Math.floor(frame / 20) % 2 === 0) {
    ctx.fillStyle = "#ff5050";
    ctx.beginPath();
    ctx.arc(x + size / 2 - 8, y - size / 2 - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smoke wisp when low HP
  if (hp / BASE_MAX_HP < 0.5 && frame % 4 === 0) {
    ctx.fillStyle = "rgba(60, 50, 45, 0.6)";
    const smokeY = y - size / 2 - ((frame * 0.4) % 20) - 4;
    ctx.beginPath();
    ctx.arc(x - 12, smokeY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Slot buildings =====
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  frame: number,
  hovered: boolean
) {
  const spec = BUILDING_SPECS[b.type];
  const x = b.pos.x;
  const y = b.pos.y;
  const w = SLOT_RADIUS * 1.7;
  const h = SLOT_RADIUS * 1.7;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, w / 2, h / 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = spec.color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = spec.accent;
  ctx.fillRect(x - w / 2, y - h / 2, w, 5);
  ctx.fillStyle = spec.detailColor;
  ctx.fillRect(x - w / 2, y + h / 2 - 5, w, 5);

  if (b.type === "barracks") {
    ctx.fillStyle = spec.detailColor;
    ctx.fillRect(x - 5, y - 2, 10, 14);
    ctx.fillStyle = "#3a5a78";
    ctx.fillRect(x - w / 2 + 5, y - 6, 6, 6);
    ctx.fillRect(x + w / 2 - 11, y - 6, 6, 6);
    ctx.fillStyle = "#aaa";
    ctx.fillRect(x + w / 2 - 4, y - h / 2 - 12, 1, 12);
    ctx.fillStyle = "#d63d3d";
    ctx.fillRect(x + w / 2 - 4, y - h / 2 - 12, 7, 4);
  } else if (b.type === "factory") {
    ctx.fillStyle = spec.detailColor;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - w / 2 + 4 + i * 12, y - h / 2 + 4, 9, 4);
    }
    ctx.fillStyle = spec.detailColor;
    ctx.fillRect(x - 11, y - 2, 22, 16);
    ctx.fillStyle = spec.accent;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x - 11 + 2 + i * 5, y - 2, 1, 16);
    }
    ctx.fillStyle = "#3a2820";
    ctx.fillRect(x + w / 2 - 8, y - h / 2 - 10, 5, 10);
    const smokeY = y - h / 2 - 12 - ((frame * 0.5) % 16);
    ctx.fillStyle = "rgba(180, 160, 136, 0.5)";
    ctx.beginPath();
    ctx.arc(x + w / 2 - 5.5, smokeY, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === "hangar") {
    ctx.fillStyle = spec.accent;
    ctx.fillRect(x - w / 2, y - h / 2, w, 10);
    ctx.fillStyle = spec.detailColor;
    ctx.fillRect(x - w / 2 + 4, y - 4, w - 8, 18);
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const sx = x - w / 2 + 4 + (i * (w - 8)) / 5;
      ctx.beginPath();
      ctx.moveTo(sx, y - 4);
      ctx.lineTo(sx, y + 14);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff8a3d";
    ctx.fillRect(x + w / 2 - 2, y - h / 2 - 7, 6 + Math.sin(frame * 0.12) * 2, 3);
  }

  if (hovered) {
    ctx.strokeStyle = "#7fd650";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
  }
}

// ===== Player units =====
export function drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
  if (u.type === "infantry") drawInfantry(ctx, u);
  else if (u.type === "tank") drawAllyTank(ctx, u);
}

function drawInfantry(ctx: CanvasRenderingContext2D, u: Unit) {
  const x = u.pos.x;
  const y = u.pos.y;

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + 5, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(u.angle);
  ctx.fillStyle = "#3a2810";
  ctx.fillRect(-5, -3, 4, 6);
  ctx.fillStyle = u.spec.bodyColor;
  ctx.fillRect(-2, -4, 7, 8);
  ctx.fillStyle = "#3a4a30";
  ctx.beginPath();
  ctx.arc(2, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(2, -0.5, 8, 1.5);
  ctx.restore();

  if (u.hp < u.spec.maxHp) {
    drawHpBar(ctx, x, y - 10, u.hp, u.spec.maxHp, 14);
  }
}

function drawAllyTank(ctx: CanvasRenderingContext2D, u: Unit) {
  const x = u.pos.x;
  const y = u.pos.y;
  const size = u.spec.size;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 3, size * 0.9, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(u.angle);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-size * 0.9, -size * 0.8, size * 1.8, size * 0.28);
  ctx.fillRect(-size * 0.9, size * 0.52, size * 1.8, size * 0.28);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let i = -size * 0.9; i < size * 0.9; i += size * 0.2) {
    ctx.fillRect(i, -size * 0.8, 1.5, size * 0.28);
    ctx.fillRect(i, size * 0.52, 1.5, size * 0.28);
  }
  ctx.fillStyle = u.spec.bodyColor;
  ctx.fillRect(-size * 0.85, -size * 0.55, size * 1.7, size * 1.1);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-size * 0.85, -size * 0.55, size * 1.7, size * 0.2);
  ctx.fillStyle = "#7fb073";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(-size * 0.14, -size * 0.14, size * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7fb073";
  ctx.fillRect(0, -size * 0.13, size * 1.2, size * 0.26);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(size * 1.1, -size * 0.16, size * 0.12, size * 0.32);
  ctx.restore();

  if (u.hp < u.spec.maxHp) {
    drawHpBar(ctx, x, y - size - 6, u.hp, u.spec.maxHp, size * 1.6);
  }
}

export function drawAircraft(ctx: CanvasRenderingContext2D, u: Unit) {
  const x = u.pos.x;
  const y = u.pos.y;
  const hover = Math.sin(u.hoverPhase) * 1.5;
  const size = u.spec.size;

  // Offset ground shadow suggests altitude
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x + 7, y + 11, size * 0.7, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y + hover);
  ctx.rotate(u.angle);
  ctx.fillStyle = u.spec.bodyColor;
  ctx.fillRect(-3, -size * 0.85, 7, size * 1.7);
  ctx.fillRect(-size * 0.7, -size * 0.4, 4, size * 0.8);
  ctx.fillStyle = "#3a5a78";
  ctx.fillRect(-size * 0.7, -3, size * 1.5, 6);
  ctx.fillStyle = "#aaa";
  ctx.beginPath();
  ctx.moveTo(size * 0.85, 0);
  ctx.lineTo(size * 0.5, -3);
  ctx.lineTo(size * 0.5, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0a1a2a";
  ctx.fillRect(0, -2, 5, 4);
  ctx.restore();

  if (u.hp < u.spec.maxHp) {
    drawHpBar(ctx, x, y - size - 6 + hover, u.hp, u.spec.maxHp, size * 1.4);
  }
}

// ===== Enemies =====
export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const x = e.pos.x;
  const y = e.pos.y;
  const size = e.spec.size;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, size * 1.0, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(e.bodyAngle);
  ctx.fillStyle = "#1a0e0a";
  ctx.fillRect(-size * 0.92, -size * 0.92, size * 1.84, size * 0.32);
  ctx.fillRect(-size * 0.92, size * 0.6, size * 1.84, size * 0.32);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let i = -size * 0.9; i < size * 0.9; i += size * 0.18) {
    ctx.fillRect(i, -size * 0.92, 2, size * 0.32);
    ctx.fillRect(i, size * 0.6, 2, size * 0.32);
  }
  ctx.fillStyle = e.spec.bodyColor;
  ctx.fillRect(-size * 0.88, -size * 0.65, size * 1.76, size * 1.3);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(-size * 0.88, -size * 0.65, size * 1.76, size * 0.2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-size * 0.88, size * 0.45, size * 1.76, size * 0.2);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = e.spec.turretColor;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(-size * 0.16, -size * 0.16, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(e.turretAngle);
  ctx.fillStyle = e.spec.turretColor;
  ctx.fillRect(0, -size * 0.14, size * 1.35, size * 0.28);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(size * 1.25, -size * 0.17, size * 0.12, size * 0.34);
  ctx.restore();

  if (e.hp < e.spec.maxHp) {
    drawHpBar(ctx, x, y - size - 7, e.hp, e.spec.maxHp, size * 1.8);
  }
}

// ===== HP bar =====
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  width: number
) {
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 4);
  ctx.fillStyle = "#3a2218";
  ctx.fillRect(x - width / 2, y, width, 2);
  const pct = Math.max(0, hp / maxHp);
  ctx.fillStyle = pct > 0.5 ? "#7fd650" : pct > 0.25 ? "#ff6b1a" : "#d63d3d";
  ctx.fillRect(x - width / 2, y, width * pct, 2);
}
