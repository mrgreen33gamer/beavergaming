import type { Building, Unit, Enemy, Vec, TimeOfDay } from "./types";
import { CENTER, BASE_SIZE, BASE_MAX_HP, SLOT_RADIUS, W, H, SLOT_POSITIONS, RADAR_REVEAL_RANGE, REPAIR_RANGE } from "./constants";
import { BUILDING_SPECS } from "./specs";

// ===== Terrain (drawn once to offscreen canvas) =====
let terrainCanvas: OffscreenCanvas | null = null;
export function getTerrainCanvas(): OffscreenCanvas {
  if (terrainCanvas) return terrainCanvas;
  terrainCanvas = new OffscreenCanvas(W, H);
  const ctx = terrainCanvas.getContext("2d")!;

  // Base terrain
  ctx.fillStyle = "#1a2418";
  ctx.fillRect(0, 0, W, H);

  // Noise texture
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const g = 20 + Math.random() * 15;
    ctx.fillStyle = `rgb(${g + 6}, ${g + 16}, ${g})`;
    ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }

  // Dirt paths from center to each slot
  ctx.strokeStyle = "#2a2018";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  for (const s of SLOT_POSITIONS) {
    ctx.beginPath();
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }
  // Path texture
  ctx.strokeStyle = "#322818";
  ctx.lineWidth = 4;
  for (const s of SLOT_POSITIONS) {
    ctx.beginPath();
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }

  // Scatter rocks
  ctx.fillStyle = "#2a2a22";
  for (let i = 0; i < 40; i++) {
    const x = 30 + Math.random() * (W - 60);
    const y = 30 + Math.random() * (H - 60);
    const r = 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return terrainCanvas;
}

// ===== Grid overlay =====
export function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(60, 80, 50, 0.15)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

// ===== Supply lines (pulsing energy from HQ to buildings) =====
export function drawSupplyLines(ctx: CanvasRenderingContext2D, buildings: Building[], frame: number) {
  for (const b of buildings) {
    const grad = ctx.createLinearGradient(CENTER.x, CENTER.y, b.pos.x, b.pos.y);
    const pulse = 0.15 + Math.sin(frame * 0.05 + b.slot) * 0.08;
    const spec = BUILDING_SPECS[b.type];
    grad.addColorStop(0, `rgba(255, 208, 96, ${pulse})`);
    grad.addColorStop(1, spec.accent + "44");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -frame * 0.5;
    ctx.beginPath();
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ===== Radar sweep =====
export function drawRadarSweep(ctx: CanvasRenderingContext2D, buildings: Building[], frame: number) {
  for (const b of buildings) {
    if (b.type !== "radar-tower") continue;
    const r = RADAR_REVEAL_RANGE * (1 + (b.level - 1) * 0.25);
    const angle = (frame * 0.03) % (Math.PI * 2);

    // Range circle
    ctx.strokeStyle = "rgba(64, 176, 112, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Sweep line
    ctx.strokeStyle = "rgba(64, 176, 112, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.pos.x, b.pos.y);
    ctx.lineTo(b.pos.x + Math.cos(angle) * r, b.pos.y + Math.sin(angle) * r);
    ctx.stroke();
  }
}

// ===== Repair depot range =====
export function drawRepairRanges(ctx: CanvasRenderingContext2D, buildings: Building[], frame: number) {
  for (const b of buildings) {
    if (b.type !== "repair-depot") continue;
    const r = REPAIR_RANGE * (1 + (b.level - 1) * 0.2);
    const pulse = 0.08 + Math.sin(frame * 0.04) * 0.04;
    ctx.strokeStyle = `rgba(96, 160, 208, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ===== HQ =====
export function drawBase(ctx: CanvasRenderingContext2D, hp: number, frame: number, shielded: boolean) {
  const x = CENTER.x, y = CENTER.y, size = BASE_SIZE;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 5, size * 0.75, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const dmgPct = hp / BASE_MAX_HP;
  const bodyCol = dmgPct < 0.3 ? "#4a3028" : "#5a5040";
  const topCol = dmgPct < 0.3 ? "#6a4a38" : "#7a7060";

  // Outer walls
  ctx.fillStyle = "#3a3428";
  const ow = size * 1.3;
  ctx.fillRect(x - ow / 2, y - ow / 2, ow, ow);

  // Inner compound
  ctx.fillStyle = bodyCol;
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.fillStyle = topCol;
  ctx.fillRect(x - size / 2, y - size / 2, size, 5);
  ctx.fillStyle = "#2a2420";
  ctx.fillRect(x - size / 2, y + size / 2 - 5, size, 5);

  // Corner turrets
  for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.fillStyle = "#4a4030";
    ctx.fillRect(x + (cx * ow) / 2 - 5, y + (cy * ow) / 2 - 5, 10, 10);
    ctx.fillStyle = "#6a6050";
    ctx.beginPath();
    ctx.arc(x + (cx * ow) / 2, y + (cy * ow) / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // HQ text
  ctx.fillStyle = "#ffd060";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HQ", x, y);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  // Antenna with blinking light
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + size / 2 - 6, y - size / 2);
  ctx.lineTo(x + size / 2 - 6, y - size / 2 - 18);
  ctx.stroke();
  if (Math.floor(frame / 18) % 2 === 0) {
    ctx.fillStyle = "#ff5050";
    ctx.beginPath();
    ctx.arc(x + size / 2 - 6, y - size / 2 - 18, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smoke when damaged
  if (dmgPct < 0.5) {
    ctx.fillStyle = `rgba(80, 70, 60, ${0.4 + Math.sin(frame * 0.1) * 0.2})`;
    const sy = y - size / 2 - ((frame * 0.6) % 30) - 5;
    ctx.beginPath();
    ctx.arc(x - 10, sy, 5 + Math.sin(frame * 0.08) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shield bubble
  if (shielded) {
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 + Math.sin(frame * 0.1) * 0.15})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(100, 200, 255, ${0.06 + Math.sin(frame * 0.08) * 0.03})`;
    ctx.fill();
  }
}

// ===== Building slot (empty) =====
export function drawEmptySlot(ctx: CanvasRenderingContext2D, pos: Vec, frame: number, active: boolean) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(frame * 0.004);
  ctx.strokeStyle = active ? "#7fd650" : "#3a4a30";
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, SLOT_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Plus icon
  ctx.fillStyle = active ? "#7fd650" : "#3a4a30";
  ctx.fillRect(pos.x - 7, pos.y - 1.5, 14, 3);
  ctx.fillRect(pos.x - 1.5, pos.y - 7, 3, 14);
}

// ===== Building =====
export function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, frame: number, active: boolean) {
  const spec = BUILDING_SPECS[b.type];
  const { x, y } = b.pos;
  const w = SLOT_RADIUS * 1.8;
  const h = SLOT_RADIUS * 1.6;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, w / 2, h / 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main structure
  ctx.fillStyle = spec.color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = spec.accent;
  ctx.fillRect(x - w / 2, y - h / 2, w, 4);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - w / 2, y + h / 2 - 4, w, 4);

  // Type-specific details
  if (b.type === "radar-tower") {
    // Rotating dish
    const ra = frame * 0.04;
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ra) * 14, y + Math.sin(ra) * 14);
    ctx.stroke();
    ctx.fillStyle = spec.accent;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === "repair-depot") {
    // Plus symbol
    ctx.fillStyle = spec.accent;
    ctx.fillRect(x - 8, y - 2, 16, 4);
    ctx.fillRect(x - 2, y - 8, 4, 16);
  } else {
    // Door/window details
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x - 5, y, 10, h / 2 - 4);
    // Unit icon
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x - w / 2 + 4, y - h / 2 + 6, 8, 6);
    ctx.fillRect(x + w / 2 - 12, y - h / 2 + 6, 8, 6);
  }

  // Level indicator (stars)
  if (b.level > 1) {
    ctx.fillStyle = b.level === 3 ? "#ffd700" : "#c0c0c0";
    for (let i = 0; i < b.level; i++) {
      ctx.beginPath();
      ctx.arc(x - 6 + i * 6, y - h / 2 - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Active highlight
  if (active) {
    ctx.strokeStyle = "#7fd650";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
  }
}

// ===== Player units =====
export function drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
  const { x, y } = u.pos;
  const hover = u.spec.isAircraft ? Math.sin(u.hoverPhase) * 2 : 0;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + (u.spec.isAircraft ? 5 : 0), y + (u.spec.isAircraft ? 10 : 4),
    u.spec.size * 0.7, u.spec.size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y + hover);
  ctx.rotate(u.angle);

  const s = u.spec.size;
  const col = u.spec.bodyColor;

  switch (u.type) {
    case "infantry":
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(2, -1, s, 2); // rifle
      break;

    case "sniper":
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(2, -0.5, s * 1.6, 1.5); // long barrel
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(s * 1.8, 0, 1.5, 0, Math.PI * 2); // laser dot
      ctx.fill();
      break;

    case "tank":
      // Treads
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-s * 0.9, -s * 0.8, s * 1.8, s * 0.25);
      ctx.fillRect(-s * 0.9, s * 0.55, s * 1.8, s * 0.25);
      // Hull
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.8, -s * 0.55, s * 1.6, s * 1.1);
      // Turret
      ctx.fillStyle = "#6a8a5a";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      // Barrel
      ctx.fillStyle = "#4a5a3a";
      ctx.fillRect(0, -s * 0.1, s * 1.1, s * 0.2);
      break;

    case "mech":
      // Legs
      ctx.fillStyle = "#3a3a4a";
      ctx.fillRect(-s * 0.5, s * 0.3, s * 0.25, s * 0.5);
      ctx.fillRect(s * 0.25, s * 0.3, s * 0.25, s * 0.5);
      // Body
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 0.8);
      // Shoulder pads
      ctx.fillStyle = "#8080c0";
      ctx.beginPath();
      ctx.arc(-s * 0.55, -s * 0.2, s * 0.2, 0, Math.PI * 2);
      ctx.arc(s * 0.55, -s * 0.2, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = "#ff6060";
      ctx.beginPath();
      ctx.arc(0, -s * 0.4, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "aircraft":
      // Wings
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.8, -s * 0.15, s * 1.6, s * 0.3);
      // Fuselage
      ctx.fillStyle = "#3a6a8a";
      ctx.fillRect(-s * 0.2, -s * 0.7, s * 0.4, s * 1.4);
      // Nose
      ctx.fillStyle = "#aaa";
      ctx.beginPath();
      ctx.moveTo(s * 0.8, 0);
      ctx.lineTo(s * 0.4, -s * 0.15);
      ctx.lineTo(s * 0.4, s * 0.15);
      ctx.fill();
      break;

    case "drone":
      // X frame
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s, -s); ctx.lineTo(s, s);
      ctx.moveTo(s, -s); ctx.lineTo(-s, s);
      ctx.stroke();
      // Center
      ctx.fillStyle = "#aaa";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Rotors
      const rAngle = (Date.now() * 0.02) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(200,200,200,0.5)";
      ctx.lineWidth = 1;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, s * 0.5, rAngle, rAngle + Math.PI);
        ctx.stroke();
      }
      break;

    case "artillery":
      // Base platform
      ctx.fillStyle = "#4a3a28";
      ctx.fillRect(-s * 0.7, -s * 0.6, s * 1.4, s * 1.2);
      // Barrel (angled up slightly)
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.15, -s * 0.1, s * 1.5, s * 0.2);
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(s * 1.3, -s * 0.15, s * 0.15, s * 0.3);
      break;

    case "flamethrower":
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Nozzle cone
      ctx.fillStyle = "#ff6020";
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.4);
      ctx.lineTo(s * 1.4, -s * 0.8);
      ctx.lineTo(s * 1.4, s * 0.8);
      ctx.lineTo(s * 0.5, s * 0.4);
      ctx.closePath();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
  }
  ctx.restore();

  // HP bar
  if (u.hp < u.maxHp) {
    drawHpBar(ctx, x, y - u.spec.size - 6 + hover, u.hp, u.maxHp, u.spec.size * 1.5);
  }

  // Burn indicator
  if (u.burnTicks > 0) {
    ctx.fillStyle = `rgba(255, 100, 30, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y + hover, u.spec.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Enemies =====
export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const { x, y } = e.pos;
  const s = e.spec.size;

  // Stealth handling
  const prevAlpha = ctx.globalAlpha;
  if (e.spec.stealth) {
    ctx.globalAlpha = e.stealthAlpha;
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, s * 0.9, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);

  switch (e.type) {
    case "basic":
    case "heavy":
      // Tank-like body
      ctx.rotate(e.bodyAngle);
      ctx.fillStyle = "#1a0e0a";
      ctx.fillRect(-s * 0.9, -s * 0.85, s * 1.8, s * 0.3);
      ctx.fillRect(-s * 0.9, s * 0.55, s * 1.8, s * 0.3);
      ctx.fillStyle = e.spec.bodyColor;
      ctx.fillRect(-s * 0.85, -s * 0.6, s * 1.7, s * 1.2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(-s * 0.85, -s * 0.6, s * 1.7, s * 0.2);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      // Turret
      ctx.fillStyle = e.spec.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(e.turretAngle);
      ctx.fillStyle = e.spec.accentColor;
      ctx.fillRect(0, -s * 0.12, s * 1.2, s * 0.24);
      if (e.type === "heavy") {
        // Double barrel
        ctx.fillRect(0, -s * 0.25, s * 1.1, s * 0.12);
        ctx.fillRect(0, s * 0.13, s * 1.1, s * 0.12);
      }
      break;

    case "scout":
      ctx.rotate(e.bodyAngle);
      // Diamond shape
      ctx.fillStyle = e.spec.bodyColor;
      ctx.beginPath();
      ctx.moveTo(s * 0.8, 0);
      ctx.lineTo(0, -s * 0.6);
      ctx.lineTo(-s * 0.6, 0);
      ctx.lineTo(0, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.spec.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "stealth":
      ctx.rotate(e.bodyAngle);
      ctx.fillStyle = e.spec.bodyColor;
      ctx.beginPath();
      ctx.moveTo(s * 0.8, 0);
      ctx.lineTo(-s * 0.3, -s * 0.5);
      ctx.lineTo(-s * 0.6, 0);
      ctx.lineTo(-s * 0.3, s * 0.5);
      ctx.closePath();
      ctx.fill();
      // Shimmer
      if (Math.random() > 0.7) {
        ctx.strokeStyle = `rgba(80, 255, 170, ${0.2 + Math.random() * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;

    case "bomber":
      ctx.rotate(e.bodyAngle);
      // Triangular rush shape
      ctx.fillStyle = e.spec.bodyColor;
      ctx.beginPath();
      ctx.moveTo(s * 0.9, 0);
      ctx.lineTo(-s * 0.6, -s * 0.7);
      ctx.lineTo(-s * 0.4, 0);
      ctx.lineTo(-s * 0.6, s * 0.7);
      ctx.closePath();
      ctx.fill();
      // Glowing tip
      ctx.fillStyle = "#ff3030";
      ctx.beginPath();
      ctx.arc(s * 0.6, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "swarm":
      ctx.fillStyle = e.spec.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.spec.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "healer":
      ctx.fillStyle = e.spec.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
      // Green plus
      ctx.fillStyle = e.spec.accentColor;
      ctx.fillRect(-s * 0.5, -s * 0.15, s, s * 0.3);
      ctx.fillRect(-s * 0.15, -s * 0.5, s * 0.3, s);
      // Heal aura
      ctx.strokeStyle = `rgba(64, 160, 80, ${0.2 + Math.sin(Date.now() * 0.005) * 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case "boss":
      ctx.rotate(e.bodyAngle);
      // Massive body
      ctx.fillStyle = e.spec.bodyColor;
      ctx.fillRect(-s * 0.8, -s * 0.7, s * 1.6, s * 1.4);
      // Armor plates
      ctx.fillStyle = "#3a2020";
      ctx.fillRect(-s * 0.85, -s * 0.75, s * 1.7, s * 0.15);
      ctx.fillRect(-s * 0.85, s * 0.6, s * 1.7, s * 0.15);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      // Turret
      ctx.fillStyle = e.spec.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Glowing eyes
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.1, 3, 0, Math.PI * 2);
      ctx.arc(s * 0.15, -s * 0.1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(e.turretAngle);
      // Double barrel
      ctx.fillStyle = e.spec.accentColor;
      ctx.fillRect(0, -s * 0.2, s * 1.3, s * 0.15);
      ctx.fillRect(0, s * 0.05, s * 1.3, s * 0.15);
      break;
  }

  ctx.restore();
  ctx.globalAlpha = prevAlpha;

  // HP bar (not for stealth unrevealed)
  if (e.hp < e.maxHp && (e.revealed || e.stealthAlpha > 0.3)) {
    drawHpBar(ctx, x, y - s - 7, e.hp, e.maxHp, s * 1.6, true);
  }
}

// ===== HP bar =====
export function drawHpBar(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  hp: number, maxHp: number, width: number, isEnemy = false
) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
  ctx.fillStyle = "#2a1a10";
  ctx.fillRect(x - width / 2, y, width, 3);
  const pct = Math.max(0, hp / maxHp);
  if (isEnemy) {
    ctx.fillStyle = pct > 0.5 ? "#ff5050" : pct > 0.25 ? "#ff8020" : "#ffaa00";
  } else {
    ctx.fillStyle = pct > 0.5 ? "#7fd650" : pct > 0.25 ? "#ff6b1a" : "#d63d3d";
  }
  ctx.fillRect(x - width / 2, y, width * pct, 3);
}

// ===== Airstrike target =====
export function drawAirstrikeTarget(ctx: CanvasRenderingContext2D, pos: Vec, radius: number, progress: number) {
  // Expanding rings
  ctx.strokeStyle = `rgba(255, 80, 30, ${0.5 - progress * 0.3})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * progress, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosshair
  ctx.strokeStyle = `rgba(255, 50, 20, ${0.6})`;
  ctx.lineWidth = 1;
  const cr = 15;
  ctx.beginPath();
  ctx.moveTo(pos.x - cr, pos.y); ctx.lineTo(pos.x + cr, pos.y);
  ctx.moveTo(pos.x, pos.y - cr); ctx.lineTo(pos.x, pos.y + cr);
  ctx.stroke();
}

// ===== Vignette =====
export function drawVignette(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ===== Time of day tint =====
export function drawTimeTint(ctx: CanvasRenderingContext2D, time: TimeOfDay) {
  const tints: Record<TimeOfDay, string> = {
    dawn: "rgba(255, 180, 100, 0.05)",
    day: "rgba(0,0,0,0)",
    dusk: "rgba(255, 80, 40, 0.08)",
    night: "rgba(15, 20, 60, 0.2)",
  };
  const tint = tints[time];
  if (tint !== "rgba(0,0,0,0)") {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
  }
}

// ===== Corner brackets =====
export function drawBrackets(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#3a5a30";
  const cl = 30, cw = 2;
  ctx.fillRect(0, 0, cl, cw); ctx.fillRect(0, 0, cw, cl);
  ctx.fillRect(W - cl, 0, cl, cw); ctx.fillRect(W - cw, 0, cw, cl);
  ctx.fillRect(0, H - cw, cl, cw); ctx.fillRect(0, H - cl, cw, cl);
  ctx.fillRect(W - cl, H - cw, cl, cw); ctx.fillRect(W - cw, H - cl, cw, cl);
}
