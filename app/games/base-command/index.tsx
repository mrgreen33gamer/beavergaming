"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  Building, Unit, Enemy, Bullet, Particle, FloatingText,
  Phase, Vec, EnemyType, BuildingType,
} from "./types";
import {
  WIDTH, HEIGHT, CENTER,
  BASE_SIZE, BASE_MAX_HP,
  BASE_TURRET_RANGE, BASE_TURRET_DAMAGE,
  BASE_TURRET_FIRE_RATE, BASE_TURRET_BULLET_SPEED,
  SLOT_RADIUS, SLOT_POSITIONS,
  STARTING_CURRENCY, WAVE_BONUS_BASE, WAVE_BONUS_PER_WAVE,
  MAX_PARTICLES, STATE_SYNC_INTERVAL, AGGRO_SPREAD_PENALTY_SQ,
} from "./constants";
import { BUILDING_SPECS } from "./specs";
import { WAVES, getWave } from "./waves";
import {
  dist, shortestAngle, getId, resetIdCounter,
  addBurst, makeEnemy, makeUnit, spawnEdge,
} from "./helpers";
import {
  drawBase, drawBuilding, drawUnit, drawAircraft, drawEnemy,
} from "./drawing";
import SlotMenu from "./SlotMenu";

export default function BaseCommand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currency, setCurrency] = useState(STARTING_CURRENCY);
  const [wave, setWave] = useState(0);
  const [baseHp, setBaseHp] = useState(BASE_MAX_HP);
  const [phase, setPhase] = useState<Phase>("building");
  const [gameStarted, setGameStarted] = useState(false);
  const [highestWave, setHighestWave] = useState(0);
  const [openMenuSlot, setOpenMenuSlot] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  // Tick is used to force re-render of menu disabled state when needed.
  const [, setTick] = useState(0);

  const stateRef = useRef({
    buildings: [] as Building[],
    units: [] as Unit[],
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    pendingSpawns: [] as Array<{ type: EnemyType; at: number; hpScale: number }>,
    shake: 0,
    baseLastShot: 0,
    baseHp: BASE_MAX_HP,
    currency: STARTING_CURRENCY,
    wave: 0,
    phase: "building" as Phase,
    hoveredSlot: null as number | null,
    // Last-synced values, so we only call setState when something genuinely changed.
    lastSyncedCurrency: STARTING_CURRENCY,
    lastSyncedBaseHp: BASE_MAX_HP,
    lastSyncFrame: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("base-highest-wave");
    if (saved) setHighestWave(parseInt(saved, 10));
  }, []);

  const showBanner = useCallback((text: string, durationMs = 1800) => {
    setBanner(text);
    setTimeout(() => setBanner(null), durationMs);
  }, []);

  const resetGame = useCallback(() => {
    resetIdCounter();
    stateRef.current = {
      buildings: [],
      units: [],
      enemies: [],
      bullets: [],
      particles: [],
      floatingTexts: [],
      pendingSpawns: [],
      shake: 0,
      baseLastShot: 0,
      baseHp: BASE_MAX_HP,
      currency: STARTING_CURRENCY,
      wave: 0,
      phase: "building",
      hoveredSlot: null,
      lastSyncedCurrency: STARTING_CURRENCY,
      lastSyncedBaseHp: BASE_MAX_HP,
      lastSyncFrame: 0,
    };
    setCurrency(STARTING_CURRENCY);
    setWave(0);
    setBaseHp(BASE_MAX_HP);
    setPhase("building");
    setGameStarted(true);
    setOpenMenuSlot(null);
    setBanner(null);
  }, []);

  const startWave = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "building") return;
    const waveNum = s.wave;
    const enemies = getWave(waveNum);
    const hpScale = 1 + Math.max(0, waveNum - WAVES.length + 1) * 0.18;
    const now = Date.now();
    s.pendingSpawns = enemies.map((type, i) => ({
      type,
      at: now + 500 + i * 700,
      hpScale,
    }));
    s.phase = "wave";
    setPhase("wave");
    setOpenMenuSlot(null);
    showBanner(`WAVE ${waveNum + 1}`);
  }, [showBanner]);

  const tryBuild = (slotIdx: number, type: BuildingType) => {
    const s = stateRef.current;
    const spec = BUILDING_SPECS[type];
    if (s.currency < spec.cost) return;
    if (s.buildings.some((b) => b.slot === slotIdx)) return;
    s.currency -= spec.cost;
    setCurrency(s.currency);
    s.lastSyncedCurrency = s.currency;
    s.buildings.push({
      slot: slotIdx,
      type,
      pos: SLOT_POSITIONS[slotIdx],
      lastSpawn: Date.now() - spec.spawnInterval * 0.6,
    });
    for (let i = 0; i < 14; i++) {
      if (s.particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      s.particles.push({
        pos: { x: SLOT_POSITIONS[slotIdx].x, y: SLOT_POSITIONS[slotIdx].y },
        vel: { x: Math.cos(a) * (1 + Math.random() * 2), y: Math.sin(a) * (1 + Math.random() * 2) - 1 },
        life: 25, maxLife: 25, color: spec.accent, size: 3, decay: 0.9,
      });
    }
    setOpenMenuSlot(null);
  };

  const sellBuilding = (slotIdx: number) => {
    const s = stateRef.current;
    const b = s.buildings.find((bb) => bb.slot === slotIdx);
    if (!b) return;
    const refund = Math.floor(BUILDING_SPECS[b.type].cost / 2);
    s.currency += refund;
    setCurrency(s.currency);
    s.lastSyncedCurrency = s.currency;
    s.buildings = s.buildings.filter((bb) => bb.slot !== slotIdx);
    s.floatingTexts.push({
      id: getId(),
      pos: { x: SLOT_POSITIONS[slotIdx].x, y: SLOT_POSITIONS[slotIdx].y },
      text: `+$${refund}`,
      color: "#ffd060",
      vy: -1.2,
      life: 40, maxLife: 40,
    });
    for (let i = 0; i < 18; i++) {
      if (s.particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      s.particles.push({
        pos: { x: SLOT_POSITIONS[slotIdx].x, y: SLOT_POSITIONS[slotIdx].y },
        vel: { x: Math.cos(a) * (1 + Math.random() * 3), y: Math.sin(a) * (1 + Math.random() * 3) },
        life: 28, maxLife: 28, color: "#8a6a40", size: 3, decay: 0.9,
      });
    }
    setOpenMenuSlot(null);
  };

  // ===================== ANIMATION LOOP =====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;

    // Reused across frames to avoid GC churn. Map is cleared each frame.
    const aggroByEnemyId = new Map<number, number>();

    const loop = () => {
      frame++;
      const s = stateRef.current;
      const now = Date.now();

      if (gameStarted && s.phase !== "gameover") {
        // ===== Spawn pending enemies (in-place) =====
        {
          let w = 0;
          for (let i = 0; i < s.pendingSpawns.length; i++) {
            const sp = s.pendingSpawns[i];
            if (sp.at <= now) {
              const pos = spawnEdge();
              s.enemies.push(makeEnemy(sp.type, pos, sp.hpScale));
              addBurst(s.particles, 6, () => {
                const a = Math.random() * Math.PI * 2;
                return {
                  pos: { x: pos.x, y: pos.y },
                  vel: { x: Math.cos(a) * 3, y: Math.sin(a) * 3 },
                  life: 22, maxLife: 22, color: "#f5e8d0", size: 3, decay: 0.9,
                };
              });
            } else {
              if (w !== i) s.pendingSpawns[w] = sp;
              w++;
            }
          }
          s.pendingSpawns.length = w;
        }

        // ===== Pre-compute counts =====
        let capBar = 0, capFac = 0, capHan = 0;
        for (let i = 0; i < s.buildings.length; i++) {
          const t = s.buildings[i].type;
          if (t === "barracks") capBar += BUILDING_SPECS.barracks.unitCap;
          else if (t === "factory") capFac += BUILDING_SPECS.factory.unitCap;
          else capHan += BUILDING_SPECS.hangar.unitCap;
        }
        let cntInf = 0, cntTank = 0, cntAir = 0;
        for (let i = 0; i < s.units.length; i++) {
          const t = s.units[i].type;
          if (t === "infantry") cntInf++;
          else if (t === "tank") cntTank++;
          else cntAir++;
        }

        // ===== Buildings spawn units during waves =====
        if (s.phase === "wave") {
          for (let i = 0; i < s.buildings.length; i++) {
            const b = s.buildings[i];
            const spec = BUILDING_SPECS[b.type];
            const cap = b.type === "barracks" ? capBar : b.type === "factory" ? capFac : capHan;
            const cur = b.type === "barracks" ? cntInf : b.type === "factory" ? cntTank : cntAir;
            if (cur >= cap) continue;
            if (now - b.lastSpawn > spec.spawnInterval) {
              b.lastSpawn = now;
              s.units.push(makeUnit(spec.unitType, b.pos));
              if (b.type === "barracks") cntInf++;
              else if (b.type === "factory") cntTank++;
              else cntAir++;
              addBurst(s.particles, 4, () => {
                const a = Math.random() * Math.PI * 2;
                return {
                  pos: { x: b.pos.x, y: b.pos.y },
                  vel: { x: Math.cos(a) * 2, y: Math.sin(a) * 2 },
                  life: 14, maxLife: 14, color: spec.accent, size: 2, decay: 0.88,
                };
              });
            }
          }
        }

        // ===== Build aggro map from existing targets =====
        // Counts how many living units currently target each enemy. This drives
        // smart target acquisition below — new targets prefer less-attacked enemies.
        aggroByEnemyId.clear();
        for (let i = 0; i < s.units.length; i++) {
          const u = s.units[i];
          // Clear stale target reference if enemy died
          if (u.target && u.target.hp <= 0) u.target = null;
          if (u.target) {
            const id = u.target.id;
            aggroByEnemyId.set(id, (aggroByEnemyId.get(id) || 0) + 1);
          }
        }

        // ===== Player unit AI =====
        for (let ui = 0; ui < s.units.length; ui++) {
          const u = s.units[ui];

          // Smart target acquisition: score = squared distance + aggro penalty.
          // The penalty is squared so it can be added to squared distances directly.
          // Result: units pick the closest *underattacked* enemy, fanning out
          // naturally across the wave instead of dogpiling one target.
          if (!u.target && s.enemies.length > 0) {
            let best: Enemy | null = null;
            let bestScore = Infinity;
            for (let ei = 0; ei < s.enemies.length; ei++) {
              const e = s.enemies[ei];
              const dx = e.pos.x - u.pos.x;
              const dy = e.pos.y - u.pos.y;
              const dSq = dx * dx + dy * dy;
              const attackers = aggroByEnemyId.get(e.id) || 0;
              const score = dSq + attackers * AGGRO_SPREAD_PENALTY_SQ;
              if (score < bestScore) { bestScore = score; best = e; }
            }
            if (best) {
              u.target = best;
              // Update aggro count so subsequent units in this frame see it
              aggroByEnemyId.set(best.id, (aggroByEnemyId.get(best.id) || 0) + 1);
            }
          }

          if (u.target) {
            const target = u.target;
            const dx = target.pos.x - u.pos.x;
            const dy = target.pos.y - u.pos.y;
            const dSq = dx * dx + dy * dy;
            const range = u.spec.range;
            const rangeSq = range * range;
            const moveThresh = range * 0.85;
            const moveThreshSq = moveThresh * moveThresh;
            const ang = Math.atan2(dy, dx);
            const turn = shortestAngle(u.angle, ang);
            u.angle += Math.sign(turn) * Math.min(Math.abs(turn), 0.15);
            if (dSq > moveThreshSq) {
              u.pos.x += Math.cos(ang) * u.spec.speed;
              u.pos.y += Math.sin(ang) * u.spec.speed;
            }
            if (dSq <= rangeSq && Math.abs(turn) < 0.35 && now - u.lastShot > u.spec.fireRate) {
              u.lastShot = now;
              const bx = u.pos.x + Math.cos(u.angle) * (u.spec.size + 2);
              const by = u.pos.y + Math.sin(u.angle) * (u.spec.size + 2);
              const inacc = (Math.random() - 0.5) * 0.12;
              const fa = u.angle + inacc;
              s.bullets.push({
                pos: { x: bx, y: by },
                vel: { x: Math.cos(fa) * u.spec.bulletSpeed, y: Math.sin(fa) * u.spec.bulletSpeed },
                fromPlayer: true,
                damage: u.spec.damage,
                life: 80,
                color: u.spec.bulletColor,
              });
              if (s.particles.length < MAX_PARTICLES) {
                s.particles.push({
                  pos: { x: bx, y: by },
                  vel: { x: Math.cos(fa) * 2, y: Math.sin(fa) * 2 },
                  life: 8, maxLife: 8, color: "#ffd060", size: 3, decay: 0.85,
                });
              }
            }
          }

          if (u.pos.x < 8) u.pos.x = 8;
          else if (u.pos.x > WIDTH - 8) u.pos.x = WIDTH - 8;
          if (u.pos.y < 8) u.pos.y = 8;
          else if (u.pos.y > HEIGHT - 8) u.pos.y = HEIGHT - 8;
          if (u.type === "aircraft") u.hoverPhase += 0.1;
        }

        // ===== Enemy AI =====
        for (let ei = 0; ei < s.enemies.length; ei++) {
          const e = s.enemies[ei];
          let nearestU: Unit | null = null;
          let nearestUDSq = Infinity;
          for (let uj = 0; uj < s.units.length; uj++) {
            const u = s.units[uj];
            const dx = u.pos.x - e.pos.x;
            const dy = u.pos.y - e.pos.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < nearestUDSq) { nearestUDSq = dSq; nearestU = u; }
          }
          const baseDX = CENTER.x - e.pos.x;
          const baseDY = CENTER.y - e.pos.y;
          const baseDSq = baseDX * baseDX + baseDY * baseDY;
          const awarenessSq = e.spec.awarenessRange * e.spec.awarenessRange;
          let tx: number, ty: number;
          if (nearestU && nearestUDSq < baseDSq && nearestUDSq < awarenessSq) {
            tx = nearestU.pos.x;
            ty = nearestU.pos.y;
          } else {
            tx = CENTER.x;
            ty = CENTER.y;
          }
          const tdx = tx - e.pos.x;
          const tdy = ty - e.pos.y;
          const dSq = tdx * tdx + tdy * tdy;
          const ang = Math.atan2(tdy, tdx);

          const bturn = shortestAngle(e.bodyAngle, ang);
          e.bodyAngle += Math.sign(bturn) * Math.min(Math.abs(bturn), 0.06);
          const tturn = shortestAngle(e.turretAngle, ang);
          e.turretAngle += Math.sign(tturn) * Math.min(Math.abs(tturn), 0.08);

          const range = e.spec.range;
          const rangeSq = range * range;
          const moveThresh = range * 0.85;
          const moveThreshSq = moveThresh * moveThresh;
          if (dSq > moveThreshSq) {
            e.pos.x += Math.cos(ang) * e.spec.speed;
            e.pos.y += Math.sin(ang) * e.spec.speed;
          }

          const sz = e.spec.size;
          if (e.pos.x < sz) e.pos.x = sz;
          else if (e.pos.x > WIDTH - sz) e.pos.x = WIDTH - sz;
          if (e.pos.y < sz) e.pos.y = sz;
          else if (e.pos.y > HEIGHT - sz) e.pos.y = HEIGHT - sz;

          if (dSq <= rangeSq && Math.abs(tturn) < 0.3 && now - e.lastShot > e.spec.fireRate) {
            e.lastShot = now;
            const bx = e.pos.x + Math.cos(e.turretAngle) * (sz + 4);
            const by = e.pos.y + Math.sin(e.turretAngle) * (sz + 4);
            const inacc = (Math.random() - 0.5) * 0.18;
            const fa = e.turretAngle + inacc;
            s.bullets.push({
              pos: { x: bx, y: by },
              vel: { x: Math.cos(fa) * e.spec.bulletSpeed, y: Math.sin(fa) * e.spec.bulletSpeed },
              fromPlayer: false,
              damage: e.spec.damage,
              life: 90,
              color: e.spec.bulletColor,
            });
            if (s.particles.length < MAX_PARTICLES) {
              s.particles.push({
                pos: { x: bx, y: by },
                vel: { x: Math.cos(fa) * 2, y: Math.sin(fa) * 2 },
                life: 8, maxLife: 8, color: e.spec.bulletColor, size: 3, decay: 0.85,
              });
            }
          }
        }

        // ===== Base auto-turret =====
        if (s.enemies.length > 0 && now - s.baseLastShot > BASE_TURRET_FIRE_RATE) {
          let near: Enemy | null = null;
          let nearDSq = BASE_TURRET_RANGE * BASE_TURRET_RANGE;
          for (let i = 0; i < s.enemies.length; i++) {
            const en = s.enemies[i];
            const dx = en.pos.x - CENTER.x;
            const dy = en.pos.y - CENTER.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < nearDSq) { nearDSq = dSq; near = en; }
          }
          if (near) {
            s.baseLastShot = now;
            const ang = Math.atan2(near.pos.y - CENTER.y, near.pos.x - CENTER.x);
            const half = BASE_SIZE / 2;
            const mx = CENTER.x + Math.cos(ang) * half;
            const my = CENTER.y + Math.sin(ang) * half;
            s.bullets.push({
              pos: { x: mx, y: my },
              vel: { x: Math.cos(ang) * BASE_TURRET_BULLET_SPEED, y: Math.sin(ang) * BASE_TURRET_BULLET_SPEED },
              fromPlayer: true,
              damage: BASE_TURRET_DAMAGE,
              life: 100,
              color: "#ffd060",
            });
            addBurst(s.particles, 4, () => ({
              pos: { x: mx, y: my },
              vel: {
                x: Math.cos(ang) * 3 + (Math.random() - 0.5) * 2,
                y: Math.sin(ang) * 3 + (Math.random() - 0.5) * 2,
              },
              life: 10, maxLife: 10, color: "#ffd060", size: 3, decay: 0.85,
            }));
          }
        }

        // ===== Bullets (in-place + distSq collisions) =====
        let triggerGameOver = false;
        {
          let w = 0;
          const halfBase = BASE_SIZE / 2;
          const halfBaseSq = halfBase * halfBase;
          for (let i = 0; i < s.bullets.length; i++) {
            const b = s.bullets[i];
            b.pos.x += b.vel.x;
            b.pos.y += b.vel.y;
            b.life--;
            let keep = true;
            if (b.life <= 0) keep = false;
            else if (b.pos.x < 0 || b.pos.x > WIDTH || b.pos.y < 0 || b.pos.y > HEIGHT) keep = false;
            else if (b.fromPlayer) {
              for (let j = 0; j < s.enemies.length; j++) {
                const en = s.enemies[j];
                const dx = b.pos.x - en.pos.x;
                const dy = b.pos.y - en.pos.y;
                const sz = en.spec.size;
                if (dx * dx + dy * dy < sz * sz) {
                  en.hp -= b.damage;
                  for (let k = 0; k < 3; k++) {
                    if (s.particles.length >= MAX_PARTICLES) break;
                    s.particles.push({
                      pos: { x: b.pos.x, y: b.pos.y },
                      vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
                      life: 14, maxLife: 14, color: "#ffaa30", size: 2.5, decay: 0.88,
                    });
                  }
                  keep = false;
                  break;
                }
              }
            } else {
              let hit = false;
              for (let j = 0; j < s.units.length; j++) {
                const u = s.units[j];
                const dx = b.pos.x - u.pos.x;
                const dy = b.pos.y - u.pos.y;
                const sz = u.spec.size;
                if (dx * dx + dy * dy < sz * sz) {
                  u.hp -= b.damage;
                  for (let k = 0; k < 3; k++) {
                    if (s.particles.length >= MAX_PARTICLES) break;
                    s.particles.push({
                      pos: { x: b.pos.x, y: b.pos.y },
                      vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
                      life: 14, maxLife: 14, color: "#ff5050", size: 2.5, decay: 0.88,
                    });
                  }
                  hit = true;
                  keep = false;
                  break;
                }
              }
              if (!hit) {
                const bdx = b.pos.x - CENTER.x;
                const bdy = b.pos.y - CENTER.y;
                if (bdx * bdx + bdy * bdy < halfBaseSq) {
                  s.baseHp = Math.max(0, s.baseHp - b.damage);
                  if (s.shake < 10) s.shake = 10;
                  for (let k = 0; k < 5; k++) {
                    if (s.particles.length >= MAX_PARTICLES) break;
                    s.particles.push({
                      pos: { x: b.pos.x, y: b.pos.y },
                      vel: { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 },
                      life: 18, maxLife: 18, color: "#ff5050", size: 3, decay: 0.88,
                    });
                  }
                  if (s.baseHp <= 0 && s.phase !== "gameover") {
                    addBurst(s.particles, 60, (k) => {
                      const a = Math.random() * Math.PI * 2;
                      const sp = 2 + Math.random() * 7;
                      return {
                        pos: { x: CENTER.x, y: CENTER.y },
                        vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
                        life: 60, maxLife: 60,
                        color: k % 2 ? "#ff6b1a" : "#ffd060",
                        size: 5, decay: 0.95,
                      };
                    });
                    s.shake = 42;
                    s.phase = "gameover";
                    triggerGameOver = true;
                  }
                  keep = false;
                }
              }
            }
            if (keep) {
              if (w !== i) s.bullets[w] = b;
              w++;
            }
          }
          s.bullets.length = w;
        }

        if (triggerGameOver) {
          const clearedWaves = s.wave;
          setTimeout(() => {
            setPhase("gameover");
            setBaseHp(s.baseHp);
            if (clearedWaves > highestWave) {
              setHighestWave(clearedWaves);
              localStorage.setItem("base-highest-wave", String(clearedWaves));
            }
          }, 800);
        }

        // ===== Dead units (in-place) =====
        {
          let w = 0;
          for (let i = 0; i < s.units.length; i++) {
            const u = s.units[i];
            if (u.hp <= 0) {
              addBurst(s.particles, 10, (k) => {
                const a = Math.random() * Math.PI * 2;
                const sp = 1 + Math.random() * 4;
                return {
                  pos: { x: u.pos.x, y: u.pos.y },
                  vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
                  life: 24, maxLife: 24,
                  color: k % 2 ? "#ff6b1a" : "#5a8c5e",
                  size: 3, decay: 0.92,
                };
              });
            } else {
              if (w !== i) s.units[w] = u;
              w++;
            }
          }
          s.units.length = w;
        }

        // ===== Dead enemies (in-place) =====
        {
          let w = 0;
          for (let i = 0; i < s.enemies.length; i++) {
            const e = s.enemies[i];
            if (e.hp <= 0) {
              addBurst(s.particles, 12, (k) => {
                const a = Math.random() * Math.PI * 2;
                const sp = 1 + Math.random() * 5;
                return {
                  pos: { x: e.pos.x, y: e.pos.y },
                  vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
                  life: 26, maxLife: 26,
                  color: k % 2 ? "#ff6b1a" : "#ffd060",
                  size: 4, decay: 0.93,
                };
              });
              s.currency += e.spec.reward;
              s.floatingTexts.push({
                id: getId(),
                pos: { x: e.pos.x, y: e.pos.y },
                text: `+$${e.spec.reward}`,
                color: "#ffd060",
                vy: -1.2, life: 40, maxLife: 40,
              });
            } else {
              if (w !== i) s.enemies[w] = e;
              w++;
            }
          }
          s.enemies.length = w;
        }

        // ===== Wave end =====
        if (s.phase === "wave" && s.pendingSpawns.length === 0 && s.enemies.length === 0) {
          const cleared = s.wave;
          const bonus = WAVE_BONUS_BASE + cleared * WAVE_BONUS_PER_WAVE;
          s.currency += bonus;
          s.floatingTexts.push({
            id: getId(),
            pos: { x: CENTER.x, y: CENTER.y - 30 },
            text: `WAVE BONUS +$${bonus}`,
            color: "#7fd650",
            vy: -0.8, life: 90, maxLife: 90,
          });
          showBanner(`WAVE ${cleared + 1} CLEARED  •  +$${bonus}`, 2200);
          s.wave = cleared + 1;
          s.phase = "building";
          setWave(s.wave);
          setPhase("building");
          // Force sync on wave events (HUD should update immediately)
          setCurrency(s.currency);
          s.lastSyncedCurrency = s.currency;
          setTick((t) => t + 1);
        }

        // ===== Throttled state sync =====
        // Instead of calling setState every frame combat events fire one, we sync
        // at most every STATE_SYNC_INTERVAL frames. Drops React re-renders from
        // ~60Hz to ~15Hz during chaos. HUD updates feel instant either way.
        if (frame - s.lastSyncFrame >= STATE_SYNC_INTERVAL) {
          s.lastSyncFrame = frame;
          if (s.currency !== s.lastSyncedCurrency) {
            setCurrency(s.currency);
            s.lastSyncedCurrency = s.currency;
          }
          if (s.baseHp !== s.lastSyncedBaseHp) {
            setBaseHp(s.baseHp);
            s.lastSyncedBaseHp = s.baseHp;
          }
        }

        // ===== Floating texts (in-place) =====
        {
          let w = 0;
          for (let i = 0; i < s.floatingTexts.length; i++) {
            const ft = s.floatingTexts[i];
            ft.pos.y += ft.vy;
            ft.vy *= 0.97;
            ft.life--;
            if (ft.life > 0) {
              if (w !== i) s.floatingTexts[w] = ft;
              w++;
            }
          }
          s.floatingTexts.length = w;
        }

        // ===== Particles (in-place) =====
        {
          let w = 0;
          for (let i = 0; i < s.particles.length; i++) {
            const p = s.particles[i];
            p.pos.x += p.vel.x;
            p.pos.y += p.vel.y;
            p.vel.x *= p.decay;
            p.vel.y *= p.decay;
            p.life--;
            if (p.life > 0) {
              if (w !== i) s.particles[w] = p;
              w++;
            }
          }
          s.particles.length = w;
        }

        if (s.shake > 0) s.shake = Math.max(0, s.shake - 1);
      }

      // ===================== DRAW =====================
      const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Bg
      ctx.fillStyle = "#1a0e0a";
      ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);

      // Grid
      ctx.strokeStyle = "#2a1810";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= WIDTH; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); }
      for (let y = 0; y <= HEIGHT; y += 40) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
      ctx.stroke();

      // Corner brackets
      ctx.fillStyle = "#4a2e1f";
      const cl = 28, cw = 3;
      ctx.fillRect(0, 0, cl, cw); ctx.fillRect(0, 0, cw, cl);
      ctx.fillRect(WIDTH - cl, 0, cl, cw); ctx.fillRect(WIDTH - cw, 0, cw, cl);
      ctx.fillRect(0, HEIGHT - cw, cl, cw); ctx.fillRect(0, HEIGHT - cl, cw, cl);
      ctx.fillRect(WIDTH - cl, HEIGHT - cw, cl, cw); ctx.fillRect(WIDTH - cw, HEIGHT - cl, cw, cl);

      // HQ-to-slot lines
      for (const slotPos of SLOT_POSITIONS) {
        ctx.strokeStyle = "rgba(74, 46, 31, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CENTER.x, CENTER.y);
        ctx.lineTo(slotPos.x, slotPos.y);
        ctx.stroke();
      }

      // Base turret range hint during build phase
      if (s.phase === "building") {
        ctx.strokeStyle = "rgba(255, 208, 96, 0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, BASE_TURRET_RANGE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Slots
      SLOT_POSITIONS.forEach((slotPos, i) => {
        const b = s.buildings.find((bb) => bb.slot === i);
        const hovered = s.hoveredSlot === i;
        const menuOpen = openMenuSlot === i;
        if (!b) {
          ctx.save();
          ctx.translate(slotPos.x, slotPos.y);
          ctx.rotate(frame * 0.005);
          ctx.strokeStyle = hovered || menuOpen ? "#7fd650" : "#4a2e1f";
          ctx.lineWidth = hovered || menuOpen ? 2.5 : 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, SLOT_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          ctx.fillStyle = hovered || menuOpen ? "#7fd650" : "#5a3a25";
          ctx.fillRect(slotPos.x - 8, slotPos.y - 1.5, 16, 3);
          ctx.fillRect(slotPos.x - 1.5, slotPos.y - 8, 3, 16);
        } else {
          drawBuilding(ctx, b, frame, hovered || menuOpen);
        }
      });

      // HQ
      drawBase(ctx, s.baseHp, frame);

      // Ground units (under enemies)
      for (const u of s.units) {
        if (!u.spec.isAircraft) drawUnit(ctx, u);
      }
      // Enemies
      for (const e of s.enemies) {
        drawEnemy(ctx, e);
      }
      // Aircraft on top
      for (const u of s.units) {
        if (u.spec.isAircraft) drawAircraft(ctx, u);
      }

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.pos.x - p.size / 2, p.pos.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Bullets
      for (const b of s.bullets) {
        ctx.fillStyle = b.color + "55";
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating texts
      for (const ft of s.floatingTexts) {
        ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 2);
        ctx.font = "bold 13px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText(ft.text, ft.pos.x + 1, ft.pos.y + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.pos.x, ft.pos.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, [gameStarted, highestWave, showBanner, openMenuSlot]);

  // ===== Mouse handlers =====
  const getCanvasCoords = (e: React.MouseEvent): Vec => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const findSlotAt = (pos: Vec): number | null => {
    for (let i = 0; i < SLOT_POSITIONS.length; i++) {
      if (dist(SLOT_POSITIONS[i], pos) < SLOT_RADIUS + 4) return i;
    }
    return null;
  };

  const onCanvasMove = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);
    stateRef.current.hoveredSlot = findSlotAt(pos);
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (stateRef.current.phase === "gameover") return;
    const pos = getCanvasCoords(e);
    const slot = findSlotAt(pos);
    if (slot === null) {
      setOpenMenuSlot(null);
    } else {
      setOpenMenuSlot(slot === openMenuSlot ? null : slot);
    }
  };

  const currentBuildingAtMenu =
    openMenuSlot !== null
      ? stateRef.current.buildings.find((b) => b.slot === openMenuSlot) ?? null
      : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[800px] gap-4 font-[family-name:var(--font-mono)] text-2xl flex-wrap">
        <span>
          <span className="text-[var(--muted)]">$ </span>
          <span className="text-[var(--accent-hot)]">{currency}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">WAVE </span>
          <span className="text-[var(--accent)]">{wave + 1}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">BEST </span>
          <span className="text-[var(--foreground)]">{highestWave + 1}</span>
        </span>
      </div>

      {/* HQ HP bar */}
      <div className="w-full max-w-[800px] flex items-center gap-3 font-[family-name:var(--font-mono)] text-lg">
        <span className="text-[var(--muted)] uppercase">HQ</span>
        <div className="flex-1 h-4 bg-[var(--surface-2)] rounded border border-[var(--border)] overflow-hidden">
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${Math.max(0, (baseHp / BASE_MAX_HP) * 100)}%`,
              background:
                baseHp > BASE_MAX_HP * 0.5
                  ? "var(--crt-green)"
                  : baseHp > BASE_MAX_HP * 0.25
                  ? "var(--accent)"
                  : "var(--danger)",
            }}
          />
        </div>
        <span className="text-[var(--foreground)] w-16 text-right text-base">
          {Math.max(0, baseHp)}/{BASE_MAX_HP}
        </span>
      </div>

      {/* Canvas + overlays */}
      <div
        className="relative w-full max-w-[800px]"
        style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-pointer"
          onMouseMove={onCanvasMove}
          onClick={onCanvasClick}
          onContextMenu={(e) => e.preventDefault()}
        />

        {openMenuSlot !== null && phase !== "gameover" && gameStarted && (
          <SlotMenu
            slot={openMenuSlot}
            building={currentBuildingAtMenu}
            currency={currency}
            onBuild={(t) => tryBuild(openMenuSlot, t)}
            onSell={() => sellBuilding(openMenuSlot)}
            onClose={() => setOpenMenuSlot(null)}
          />
        )}

        {banner && phase !== "gameover" && (
          <div className="absolute inset-x-0 top-1/3 flex items-center justify-center pointer-events-none z-20">
            <div className="font-[family-name:var(--font-display)] text-lg sm:text-2xl text-[var(--accent)] drop-shadow-[0_0_12px_rgba(255,107,26,0.6)] flicker text-center px-4">
              {banner}
            </div>
          </div>
        )}

        {gameStarted && phase === "building" && (
          <button
            onClick={startWave}
            className="absolute bottom-3 right-3 pixel-edge px-4 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs hover:brightness-110 transition-all"
          >
            ▶ START WAVE
          </button>
        )}

        {gameStarted && phase === "building" && stateRef.current.buildings.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] bg-black/60 px-3 py-1 rounded pointer-events-none">
            ↓ click a slot to build
          </div>
        )}

        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--crt-green)] mb-3">
              BASE COMMAND
            </h2>
            <div className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)] text-center mb-4 leading-snug max-w-md px-4">
              <p>Defend your HQ. Click a slot to build.</p>
              <p>Three buildings, three units. Each auto-spawns during waves.</p>
              <p className="mt-2 text-[var(--accent-hot)]">Survive as long as you can.</p>
            </div>
            <button
              onClick={resetGame}
              className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
            >
              ▶ DEPLOY
            </button>
          </div>
        )}

        {phase === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--danger)] mb-3">
              HQ DESTROYED
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-2xl text-[var(--foreground)] mb-1">
              Cleared {wave} {wave === 1 ? "wave" : "waves"}
            </p>
            {wave > 0 && wave >= highestWave && (
              <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-3 flicker">
                ★ NEW RECORD ★
              </p>
            )}
            <button
              onClick={resetGame}
              className="pixel-edge px-5 py-2 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs mt-2"
            >
              REDEPLOY
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:gap-5 justify-center font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mt-1">
        <span><span style={{ color: BUILDING_SPECS.barracks.accent }}>🪖 Barracks $50</span> → Infantry</span>
        <span><span style={{ color: BUILDING_SPECS.factory.accent }}>🛡️ Factory $120</span> → Tanks</span>
        <span><span style={{ color: BUILDING_SPECS.hangar.accent }}>✈️ Hangar $180</span> → Aircraft</span>
      </div>
    </div>
  );
}
