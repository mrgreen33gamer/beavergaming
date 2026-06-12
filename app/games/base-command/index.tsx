"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Building, Unit, Enemy, Bullet, Particle, FloatingText,
  Phase, Vec, EnemyType, BuildingType, Ability, AirstrikeTarget,
  GameStats, TimeOfDay,
} from "./types";
import {
  W, H, CENTER,
  BASE_SIZE, BASE_MAX_HP,
  BASE_TURRET_RANGE, BASE_TURRET_DAMAGE, BASE_TURRET_FIRE_RATE, BASE_TURRET_BULLET_SPEED,
  SLOT_RADIUS, SLOT_POSITIONS,
  STARTING_CURRENCY, WAVE_BONUS_BASE, WAVE_BONUS_PER_WAVE,
  MAX_PARTICLES, STATE_SYNC_INTERVAL, AGGRO_SPREAD_PENALTY_SQ,
  COMBO_WINDOW_MS, COMBO_MAX_MULT,
  AIRSTRIKE_COOLDOWN, AIRSTRIKE_DAMAGE, AIRSTRIKE_RADIUS, AIRSTRIKE_DELAY,
  REINFORCE_COOLDOWN, SHIELD_COOLDOWN, SHIELD_DURATION, SHIELD_RADIUS,
  BOSS_EVERY, RADAR_REVEAL_RANGE, REPAIR_RANGE, REPAIR_RATE,
  NIGHT_RANGE_MULT, NIGHT_REWARD_MULT, TIME_CYCLE,
} from "./constants";
import { BUILDING_SPECS, UPGRADE_MULT } from "./specs";
import { getWave, getWavePreview } from "./waves";
import {
  dist, distSq, shortestAngle, getId, resetIdCounter, clamp,
  addBurst, makeEnemy, makeUnit, spawnEdge,
  pickUnitTarget, pickEnemyTarget, getRadarPositions, isNearRadar,
} from "./helpers";
import {
  getTerrainCanvas, drawGrid, drawSupplyLines, drawRadarSweep, drawRepairRanges,
  drawBase, drawEmptySlot, drawBuilding as drawBuildingGfx,
  drawUnit as drawUnitGfx, drawEnemy as drawEnemyGfx,
  drawAirstrikeTarget, drawVignette, drawTimeTint, drawBrackets,
} from "./drawing";
import {
  playShoot, playExplosion, playBuild, playWaveStart,
  playAbility, playCombo, playGameOver,
} from "./sound";
import SlotMenu from "./SlotMenu";

const INIT_ABILITIES: Ability[] = [
  { type: "airstrike", label: "Airstrike", icon: "💥", cooldown: AIRSTRIKE_COOLDOWN, lastUsed: -99999, duration: 0, active: false },
  { type: "reinforce", label: "Reinforce", icon: "📢", cooldown: REINFORCE_COOLDOWN, lastUsed: -99999, duration: 0, active: false },
  { type: "shield", label: "Shield", icon: "🛡️", cooldown: SHIELD_COOLDOWN, lastUsed: -99999, duration: SHIELD_DURATION, active: false },
];

const INIT_STATS: GameStats = {
  kills: 0, damageDealt: 0, buildingsBuilt: 0, unitsSpawned: 0,
  longestStreak: 0, currentStreak: 0, lastKillTime: 0, comboMultiplier: 1,
};

function getTimeOfDay(wave: number): TimeOfDay {
  return TIME_CYCLE[wave % TIME_CYCLE.length];
}

export default function BaseCommand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currency, setCurrency] = useState(STARTING_CURRENCY);
  const [wave, setWave] = useState(0);
  const [baseHp, setBaseHp] = useState(BASE_MAX_HP);
  const [phase, setPhase] = useState<Phase>("building");
  const [gameStarted, setGameStarted] = useState(false);
  const [highestWave, setHighestWave] = useState(0);
  const [openMenuSlot, setOpenMenuSlot] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectingAirstrike, setSelectingAirstrike] = useState(false);
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
    abilities: INIT_ABILITIES.map(a => ({ ...a })),
    airstrikes: [] as AirstrikeTarget[],
    stats: { ...INIT_STATS },
    selectingAirstrike: false,
    shieldActive: false,
    shieldEnd: 0,
    lastSyncedCurrency: STARTING_CURRENCY,
    lastSyncedBaseHp: BASE_MAX_HP,
    lastSyncFrame: 0,
    canvasW: W,
    canvasH: H,
  });

  // ===== Responsive sizing =====
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Maintain aspect ratio
      const aspect = W / H;
      let cw = rect.width;
      let ch = cw / aspect;
      if (ch > rect.height) { ch = rect.height; cw = ch * aspect; }
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      stateRef.current.canvasW = cw;
      stateRef.current.canvasH = ch;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bc-best");
      if (saved) setHighestWave(parseInt(saved, 10));
    } catch { /* ignore */ }
  }, []);

  const showBanner = useCallback((text: string, ms = 2000) => {
    setBanner(text);
    setTimeout(() => setBanner(null), ms);
  }, []);

  // ===== Fullscreen =====
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ===== Reset =====
  const resetGame = useCallback(() => {
    resetIdCounter();
    stateRef.current = {
      buildings: [], units: [], enemies: [], bullets: [],
      particles: [], floatingTexts: [], pendingSpawns: [],
      shake: 0, baseLastShot: 0, baseHp: BASE_MAX_HP,
      currency: STARTING_CURRENCY, wave: 0, phase: "building",
      hoveredSlot: null,
      abilities: INIT_ABILITIES.map(a => ({ ...a })),
      airstrikes: [], stats: { ...INIT_STATS },
      selectingAirstrike: false, shieldActive: false, shieldEnd: 0,
      lastSyncedCurrency: STARTING_CURRENCY, lastSyncedBaseHp: BASE_MAX_HP,
      lastSyncFrame: 0, canvasW: stateRef.current.canvasW, canvasH: stateRef.current.canvasH,
    };
    setCurrency(STARTING_CURRENCY);
    setWave(0);
    setBaseHp(BASE_MAX_HP);
    setPhase("building");
    setGameStarted(true);
    setOpenMenuSlot(null);
    setBanner(null);
    setSelectingAirstrike(false);
  }, []);

  // ===== Start wave =====
  const startWave = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "building") return;
    const wn = s.wave;
    const enemies = getWave(wn);
    const hpScale = 1 + Math.max(0, wn - 5) * 0.15;
    const now = Date.now();
    s.pendingSpawns = enemies.map((type, i) => ({
      type, at: now + 500 + i * 600, hpScale,
    }));
    s.phase = "wave";
    setPhase("wave");
    setOpenMenuSlot(null);
    showBanner(`⚔ WAVE ${wn + 1}${(wn + 1) % BOSS_EVERY === 0 ? " — BOSS" : ""}`);
    playWaveStart();
  }, [showBanner]);

  // ===== Build / Upgrade / Sell =====
  const tryBuild = (slotIdx: number, type: BuildingType) => {
    const s = stateRef.current;
    const spec = BUILDING_SPECS[type];
    if (s.currency < spec.cost) return;
    if (s.buildings.some(b => b.slot === slotIdx)) return;
    s.currency -= spec.cost;
    setCurrency(s.currency);
    s.lastSyncedCurrency = s.currency;
    s.buildings.push({ slot: slotIdx, type, level: 1, pos: SLOT_POSITIONS[slotIdx], lastSpawn: Date.now() });
    s.stats.buildingsBuilt++;
    addBurst(s.particles, 16, () => {
      const a = Math.random() * Math.PI * 2;
      return {
        pos: { ...SLOT_POSITIONS[slotIdx] },
        vel: { x: Math.cos(a) * (1 + Math.random() * 3), y: Math.sin(a) * (1 + Math.random() * 3) - 1 },
        life: 28, maxLife: 28, color: spec.accent, size: 3, decay: 0.9,
      };
    });
    playBuild();
    setOpenMenuSlot(null);
  };

  const tryUpgrade = (slotIdx: number) => {
    const s = stateRef.current;
    const b = s.buildings.find(bb => bb.slot === slotIdx);
    if (!b || b.level >= 3) return;
    const spec = BUILDING_SPECS[b.type];
    const cost = spec.upgradeCosts[b.level - 1];
    if (s.currency < cost) return;
    s.currency -= cost;
    setCurrency(s.currency);
    s.lastSyncedCurrency = s.currency;
    b.level++;
    addBurst(s.particles, 20, () => {
      const a = Math.random() * Math.PI * 2;
      return {
        pos: { ...b.pos },
        vel: { x: Math.cos(a) * 2, y: Math.sin(a) * 2 - 1 },
        life: 30, maxLife: 30, color: b.level === 3 ? "#ffd700" : "#c0c0c0", size: 3, decay: 0.92,
      };
    });
    playBuild();
    setOpenMenuSlot(null);
  };

  const sellBuilding = (slotIdx: number) => {
    const s = stateRef.current;
    const b = s.buildings.find(bb => bb.slot === slotIdx);
    if (!b) return;
    const spec = BUILDING_SPECS[b.type];
    const totalInvested = spec.cost + spec.upgradeCosts.slice(0, b.level - 1).reduce((a, c) => a + c, 0);
    const refund = Math.floor(totalInvested / 2);
    s.currency += refund;
    setCurrency(s.currency);
    s.lastSyncedCurrency = s.currency;
    s.buildings = s.buildings.filter(bb => bb.slot !== slotIdx);
    s.floatingTexts.push({
      id: getId(), pos: { ...SLOT_POSITIONS[slotIdx] },
      text: `+$${refund}`, color: "#ffd060", vy: -1.2, life: 40, maxLife: 40,
    });
    playBuild();
    setOpenMenuSlot(null);
  };

  // ===== Abilities =====
  const useAbility = useCallback((type: string) => {
    const s = stateRef.current;
    const ab = s.abilities.find(a => a.type === type);
    if (!ab) return;
    const now = Date.now();
    if (now - ab.lastUsed < ab.cooldown) return;
    if (s.phase !== "wave") return;

    if (type === "airstrike") {
      s.selectingAirstrike = true;
      setSelectingAirstrike(true);
      return;
    }

    ab.lastUsed = now;
    playAbility();

    if (type === "reinforce") {
      for (const b of s.buildings) {
        const spec = BUILDING_SPECS[b.type];
        if (!spec.unitType) continue;
        for (let i = 0; i < 2; i++) {
          s.units.push(makeUnit(spec.unitType, b.pos, b));
          s.stats.unitsSpawned++;
        }
      }
      showBanner("📢 REINFORCEMENTS DEPLOYED", 1500);
    }

    if (type === "shield") {
      s.shieldActive = true;
      s.shieldEnd = now + SHIELD_DURATION;
      showBanner("🛡️ SHIELD ACTIVE", 1500);
    }
    setTick(t => t + 1);
  }, [showBanner]);

  // ===================== ANIMATION LOOP =====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    const aggroByEnemyId = new Map<number, number>();

    const loop = () => {
      frame++;
      const s = stateRef.current;
      const now = Date.now();
      const timeOfDay = getTimeOfDay(s.wave);
      const isNight = timeOfDay === "night" || timeOfDay === "dusk";
      const rangeMult = isNight ? NIGHT_RANGE_MULT : 1;
      const rewardMult = isNight ? NIGHT_REWARD_MULT : 1;
      const radarPositions = getRadarPositions(s.buildings);

      if (gameStarted && s.phase !== "gameover") {
        // ===== Shield expiry =====
        if (s.shieldActive && now >= s.shieldEnd) s.shieldActive = false;

        // ===== Spawn pending enemies =====
        {
          let w = 0;
          for (let i = 0; i < s.pendingSpawns.length; i++) {
            const sp = s.pendingSpawns[i];
            if (sp.at <= now) {
              const pos = spawnEdge();
              s.enemies.push(makeEnemy(sp.type, pos, sp.hpScale));
              addBurst(s.particles, 5, () => {
                const a = Math.random() * Math.PI * 2;
                return {
                  pos: { x: pos.x, y: pos.y },
                  vel: { x: Math.cos(a) * 3, y: Math.sin(a) * 3 },
                  life: 18, maxLife: 18, color: "#f5e8d0", size: 3, decay: 0.9,
                };
              });
            } else {
              if (w !== i) s.pendingSpawns[w] = sp;
              w++;
            }
          }
          s.pendingSpawns.length = w;
        }

        // ===== Building unit caps =====
        const capByType: Record<string, number> = {};
        const cntByType: Record<string, number> = {};
        for (const b of s.buildings) {
          const spec = BUILDING_SPECS[b.type];
          if (!spec.unitType) continue;
          const mult = UPGRADE_MULT[b.level] || UPGRADE_MULT[1];
          capByType[spec.unitType] = (capByType[spec.unitType] || 0) + spec.unitCap + mult.cap;
        }
        for (const u of s.units) cntByType[u.type] = (cntByType[u.type] || 0) + 1;

        // ===== Building spawns during wave =====
        if (s.phase === "wave") {
          for (const b of s.buildings) {
            const spec = BUILDING_SPECS[b.type];
            if (!spec.unitType) continue;
            const mult = UPGRADE_MULT[b.level] || UPGRADE_MULT[1];
            const interval = Math.round(spec.spawnInterval * mult.rate);
            const cap = (capByType[spec.unitType] || 0);
            const cur = (cntByType[spec.unitType] || 0);
            if (cur >= cap) continue;
            if (now - b.lastSpawn > interval) {
              b.lastSpawn = now;
              s.units.push(makeUnit(spec.unitType, b.pos, b));
              cntByType[spec.unitType] = (cntByType[spec.unitType] || 0) + 1;
              s.stats.unitsSpawned++;
              addBurst(s.particles, 4, () => {
                const a = Math.random() * Math.PI * 2;
                return {
                  pos: { ...b.pos }, vel: { x: Math.cos(a) * 2, y: Math.sin(a) * 2 },
                  life: 12, maxLife: 12, color: spec.accent, size: 2, decay: 0.88,
                };
              });
            }
          }
        }

        // ===== Radar reveal stealth =====
        for (const e of s.enemies) {
          if (e.spec.stealth) {
            const near = isNearRadar(e.pos, radarPositions, RADAR_REVEAL_RANGE);
            e.revealed = near;
            e.stealthAlpha = near ? 0.8 : 0.08 + Math.sin(now * 0.003 + e.id) * 0.04;
          }
        }

        // ===== Repair depots heal units =====
        for (const b of s.buildings) {
          if (b.type !== "repair-depot") continue;
          const r = REPAIR_RANGE * (1 + (b.level - 1) * 0.2);
          const rSq = r * r;
          for (const u of s.units) {
            if (u.hp >= u.maxHp) continue;
            if (distSq(u.pos, b.pos) < rSq) {
              u.hp = Math.min(u.maxHp, u.hp + REPAIR_RATE * b.level);
            }
          }
        }

        // ===== Build aggro map =====
        aggroByEnemyId.clear();
        for (const u of s.units) {
          if (u.target && u.target.hp <= 0) u.target = null;
          if (u.target) aggroByEnemyId.set(u.target.id, (aggroByEnemyId.get(u.target.id) || 0) + 1);
        }

        // ===== Player unit AI =====
        for (const u of s.units) {
          const effRange = u.spec.range * rangeMult;
          // Radar range boost
          let rangeBoost = 0;
          for (const rp of radarPositions) {
            if (distSq(u.pos, rp) < RADAR_REVEAL_RANGE * RADAR_REVEAL_RANGE) { rangeBoost = 30; break; }
          }
          const totalRange = effRange + rangeBoost;

          if (!u.target && s.enemies.length > 0) {
            const t = pickUnitTarget(u, s.enemies, aggroByEnemyId, radarPositions);
            if (t) {
              u.target = t;
              aggroByEnemyId.set(t.id, (aggroByEnemyId.get(t.id) || 0) + 1);
            }
          }

          if (u.target) {
            const t = u.target;
            const dx = t.pos.x - u.pos.x, dy = t.pos.y - u.pos.y;
            const dSq = dx * dx + dy * dy;
            const rangeSq = totalRange * totalRange;
            const ang = Math.atan2(dy, dx);
            const turn = shortestAngle(u.angle, ang);
            u.angle += Math.sign(turn) * Math.min(Math.abs(turn), 0.15);

            const moveThresh = totalRange * 0.82;
            if (dSq > moveThresh * moveThresh) {
              u.pos.x += Math.cos(ang) * u.spec.speed;
              u.pos.y += Math.sin(ang) * u.spec.speed;
            }

            if (dSq <= rangeSq && Math.abs(turn) < 0.35 && now - u.lastShot > u.spec.fireRate) {
              u.lastShot = now;
              const bx = u.pos.x + Math.cos(u.angle) * (u.spec.size + 2);
              const by = u.pos.y + Math.sin(u.angle) * (u.spec.size + 2);
              const inacc = (Math.random() - 0.5) * 0.1;
              const fa = u.angle + inacc;
              s.bullets.push({
                pos: { x: bx, y: by },
                vel: { x: Math.cos(fa) * u.spec.bulletSpeed, y: Math.sin(fa) * u.spec.bulletSpeed },
                fromPlayer: true, damage: u.spec.damage, life: 80,
                color: u.spec.bulletColor,
                splash: u.spec.splash, dot: u.spec.dot,
              });
              if (s.particles.length < MAX_PARTICLES) {
                s.particles.push({
                  pos: { x: bx, y: by },
                  vel: { x: Math.cos(fa) * 2, y: Math.sin(fa) * 2 },
                  life: 6, maxLife: 6, color: "#ffd060", size: 3, decay: 0.85,
                });
              }
            }
          } else if (u.rallyPoint) {
            const dx = u.rallyPoint.x - u.pos.x, dy = u.rallyPoint.y - u.pos.y;
            if (dx * dx + dy * dy > 100) {
              const a = Math.atan2(dy, dx);
              u.pos.x += Math.cos(a) * u.spec.speed * 0.5;
              u.pos.y += Math.sin(a) * u.spec.speed * 0.5;
            }
          }

          u.pos.x = clamp(u.pos.x, 8, W - 8);
          u.pos.y = clamp(u.pos.y, 8, H - 8);
          if (u.spec.isAircraft) u.hoverPhase += 0.1;
          if (u.burnTicks > 0) { u.hp -= 2; u.burnTicks--; }
        }

        // ===== Enemy AI =====
        for (const e of s.enemies) {
          const target = pickEnemyTarget(e, s.units, s.buildings);
          const dx = target.x - e.pos.x, dy = target.y - e.pos.y;
          const dSq = dx * dx + dy * dy;
          const ang = Math.atan2(dy, dx);

          const bturn = shortestAngle(e.bodyAngle, ang);
          e.bodyAngle += Math.sign(bturn) * Math.min(Math.abs(bturn), 0.06);
          const tturn = shortestAngle(e.turretAngle, ang);
          e.turretAngle += Math.sign(tturn) * Math.min(Math.abs(tturn), 0.08);

          const range = e.spec.range;
          if (dSq > (range * 0.85) ** 2) {
            e.pos.x += Math.cos(ang) * e.spec.speed;
            e.pos.y += Math.sin(ang) * e.spec.speed;
          }

          e.pos.x = clamp(e.pos.x, e.spec.size, W - e.spec.size);
          e.pos.y = clamp(e.pos.y, e.spec.size, H - e.spec.size);

          // Healer logic
          if (e.spec.healRate && now - e.lastHeal > 500) {
            e.lastHeal = now;
            for (const other of s.enemies) {
              if (other.id === e.id || other.hp >= other.maxHp) continue;
              if (distSq(other.pos, e.pos) < 100 * 100) {
                other.hp = Math.min(other.maxHp, other.hp + e.spec.healRate! * 10);
                if (s.particles.length < MAX_PARTICLES) {
                  s.particles.push({
                    pos: { ...other.pos },
                    vel: { x: 0, y: -1.5 }, life: 12, maxLife: 12,
                    color: "#80ff80", size: 3, decay: 0.9,
                  });
                }
              }
            }
          }

          // Shooting (not bombers — they deal damage on contact)
          if (e.spec.behavior !== "rush" && dSq <= range * range && Math.abs(tturn) < 0.3 && now - e.lastShot > e.spec.fireRate) {
            e.lastShot = now;
            const bx = e.pos.x + Math.cos(e.turretAngle) * (e.spec.size + 3);
            const by = e.pos.y + Math.sin(e.turretAngle) * (e.spec.size + 3);
            const inacc = (Math.random() - 0.5) * 0.15;
            const fa = e.turretAngle + inacc;
            s.bullets.push({
              pos: { x: bx, y: by },
              vel: { x: Math.cos(fa) * e.spec.bulletSpeed, y: Math.sin(fa) * e.spec.bulletSpeed },
              fromPlayer: false, damage: e.spec.damage, life: 90, color: e.spec.bulletColor,
            });
            if (s.particles.length < MAX_PARTICLES) {
              s.particles.push({
                pos: { x: bx, y: by },
                vel: { x: Math.cos(fa) * 2, y: Math.sin(fa) * 2 },
                life: 6, maxLife: 6, color: e.spec.bulletColor, size: 3, decay: 0.85,
              });
            }
          }

          // Bomber contact damage
          if (e.spec.behavior === "rush") {
            const baseDSq = distSq(e.pos, CENTER);
            if (baseDSq < (BASE_SIZE * 0.6) ** 2) {
              if (!s.shieldActive) {
                s.baseHp = Math.max(0, s.baseHp - e.spec.damage);
                if (s.shake < 12) s.shake = 12;
              }
              e.hp = 0; // bomber explodes on impact
              addBurst(s.particles, 20, (k) => {
                const a = Math.random() * Math.PI * 2;
                return {
                  pos: { ...e.pos }, vel: { x: Math.cos(a) * 5, y: Math.sin(a) * 5 },
                  life: 30, maxLife: 30, color: k % 2 ? "#ff6020" : "#ffd060", size: 4, decay: 0.93,
                };
              });
              playExplosion(true);
            }
          }
        }

        // ===== Base auto-turret =====
        if (s.enemies.length > 0 && now - s.baseLastShot > BASE_TURRET_FIRE_RATE) {
          let near: Enemy | null = null;
          let nearDSq = BASE_TURRET_RANGE * BASE_TURRET_RANGE;
          for (const en of s.enemies) {
            if (en.spec.stealth && !en.revealed) continue;
            const d = distSq(en.pos, CENTER);
            if (d < nearDSq) { nearDSq = d; near = en; }
          }
          if (near) {
            s.baseLastShot = now;
            const ang = Math.atan2(near.pos.y - CENTER.y, near.pos.x - CENTER.x);
            const half = BASE_SIZE / 2;
            s.bullets.push({
              pos: { x: CENTER.x + Math.cos(ang) * half, y: CENTER.y + Math.sin(ang) * half },
              vel: { x: Math.cos(ang) * BASE_TURRET_BULLET_SPEED, y: Math.sin(ang) * BASE_TURRET_BULLET_SPEED },
              fromPlayer: true, damage: BASE_TURRET_DAMAGE, life: 100, color: "#ffd060",
            });
          }
        }

        // ===== Airstrikes =====
        {
          let w = 0;
          for (let i = 0; i < s.airstrikes.length; i++) {
            const as_ = s.airstrikes[i];
            if (now - as_.time >= as_.delay) {
              // Detonate
              for (const e of s.enemies) {
                if (distSq(e.pos, as_.pos) < as_.radius * as_.radius) {
                  e.hp -= as_.damage;
                  s.stats.damageDealt += Math.min(e.hp + as_.damage, as_.damage);
                }
              }
              addBurst(s.particles, 40, (k) => {
                const a = Math.random() * Math.PI * 2;
                const sp = 2 + Math.random() * 8;
                return {
                  pos: { ...as_.pos }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
                  life: 50, maxLife: 50, color: k % 3 === 0 ? "#fff" : k % 3 === 1 ? "#ff6020" : "#ffd060",
                  size: 4 + Math.random() * 3, decay: 0.95,
                };
              });
              s.shake = Math.max(s.shake, 18);
              playExplosion(true);
            } else {
              if (w !== i) s.airstrikes[w] = as_;
              w++;
            }
          }
          s.airstrikes.length = w;
        }

        // ===== Bullets =====
        let triggerGameOver = false;
        {
          let w = 0;
          const halfBaseSq = (BASE_SIZE / 2) ** 2;
          for (let i = 0; i < s.bullets.length; i++) {
            const b = s.bullets[i];
            b.pos.x += b.vel.x;
            b.pos.y += b.vel.y;
            b.life--;
            let keep = true;
            if (b.life <= 0 || b.pos.x < -10 || b.pos.x > W + 10 || b.pos.y < -10 || b.pos.y > H + 10) {
              keep = false;
            } else if (b.fromPlayer) {
              for (const en of s.enemies) {
                if (en.spec.stealth && !en.revealed && en.stealthAlpha < 0.3) continue;
                if (distSq(b.pos, en.pos) < en.spec.size * en.spec.size) {
                  en.hp -= b.damage;
                  s.stats.damageDealt += b.damage;
                  if (b.dot) en.hp -= b.dot * 5; // DOT burst
                  // Splash
                  if (b.splash) {
                    for (const e2 of s.enemies) {
                      if (e2.id !== en.id && distSq(b.pos, e2.pos) < b.splash * b.splash) {
                        e2.hp -= Math.round(b.damage * 0.5);
                        s.stats.damageDealt += Math.round(b.damage * 0.5);
                      }
                    }
                    addBurst(s.particles, 8, () => {
                      const a = Math.random() * Math.PI * 2;
                      return {
                        pos: { ...b.pos }, vel: { x: Math.cos(a) * 3, y: Math.sin(a) * 3 },
                        life: 16, maxLife: 16, color: "#ff8030", size: 3, decay: 0.9,
                      };
                    });
                  }
                  addBurst(s.particles, 3, () => ({
                    pos: { ...b.pos },
                    vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
                    life: 12, maxLife: 12, color: "#ffaa30", size: 2.5, decay: 0.88,
                  }));
                  keep = false;
                  break;
                }
              }
            } else {
              // Enemy bullet hits
              let hit = false;
              for (const u of s.units) {
                if (distSq(b.pos, u.pos) < u.spec.size * u.spec.size) {
                  u.hp -= b.damage;
                  hit = true; keep = false;
                  break;
                }
              }
              if (!hit && distSq(b.pos, CENTER) < halfBaseSq) {
                if (!s.shieldActive) {
                  s.baseHp = Math.max(0, s.baseHp - b.damage);
                  if (s.shake < 8) s.shake = 8;
                  if (s.baseHp <= 0 && s.phase !== "gameover") {
                    addBurst(s.particles, 60, (k) => {
                      const a = Math.random() * Math.PI * 2;
                      const sp = 2 + Math.random() * 7;
                      return {
                        pos: { ...CENTER }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
                        life: 60, maxLife: 60, color: k % 2 ? "#ff6b1a" : "#ffd060", size: 5, decay: 0.95,
                      };
                    });
                    s.shake = 40;
                    s.phase = "gameover";
                    triggerGameOver = true;
                    playGameOver();
                  }
                }
                keep = false;
              }
            }
            if (keep) { if (w !== i) s.bullets[w] = b; w++; }
          }
          s.bullets.length = w;
        }

        if (triggerGameOver) {
          const cleared = s.wave;
          setTimeout(() => {
            setPhase("gameover");
            setBaseHp(s.baseHp);
            if (cleared > highestWave) {
              setHighestWave(cleared);
              try { localStorage.setItem("bc-best", String(cleared)); } catch { /* */ }
            }
          }, 800);
        }

        // ===== Dead units =====
        {
          let w = 0;
          for (let i = 0; i < s.units.length; i++) {
            const u = s.units[i];
            if (u.hp <= 0) {
              addBurst(s.particles, 10, (k) => {
                const a = Math.random() * Math.PI * 2;
                return {
                  pos: { ...u.pos }, vel: { x: Math.cos(a) * (1 + Math.random() * 4), y: Math.sin(a) * (1 + Math.random() * 4) },
                  life: 24, maxLife: 24, color: k % 2 ? "#ff6b1a" : u.spec.bodyColor, size: 3, decay: 0.92,
                };
              });
              playExplosion(false);
            } else { if (w !== i) s.units[w] = u; w++; }
          }
          s.units.length = w;
        }

        // ===== Dead enemies =====
        {
          let w = 0;
          for (let i = 0; i < s.enemies.length; i++) {
            const e = s.enemies[i];
            if (e.hp <= 0) {
              const reward = Math.round(e.spec.reward * rewardMult * s.stats.comboMultiplier);
              s.currency += reward;
              s.stats.kills++;
              s.stats.currentStreak++;
              s.stats.lastKillTime = now;
              if (s.stats.currentStreak > s.stats.longestStreak) s.stats.longestStreak = s.stats.currentStreak;
              // Combo
              if (s.stats.currentStreak >= 3 && s.stats.comboMultiplier < COMBO_MAX_MULT) {
                s.stats.comboMultiplier = Math.min(COMBO_MAX_MULT, 1 + Math.floor(s.stats.currentStreak / 3) * 0.5);
                if (s.stats.currentStreak % 3 === 0) playCombo();
              }
              s.floatingTexts.push({
                id: getId(), pos: { ...e.pos },
                text: s.stats.comboMultiplier > 1 ? `+$${reward} x${s.stats.comboMultiplier.toFixed(1)}` : `+$${reward}`,
                color: s.stats.comboMultiplier > 1 ? "#ffaa00" : "#ffd060",
                vy: -1.2, life: 40, maxLife: 40,
                scale: s.stats.comboMultiplier > 1 ? 1.3 : 1,
              });
              addBurst(s.particles, e.type === "boss" ? 40 : 12, (k) => {
                const a = Math.random() * Math.PI * 2;
                const sp = 1 + Math.random() * (e.type === "boss" ? 8 : 5);
                return {
                  pos: { ...e.pos }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
                  life: 30, maxLife: 30, color: k % 2 ? "#ff6b1a" : "#ffd060",
                  size: e.type === "boss" ? 5 : 3.5, decay: 0.93,
                };
              });
              playExplosion(e.type === "boss" || e.type === "heavy");
            } else { if (w !== i) s.enemies[w] = e; w++; }
          }
          s.enemies.length = w;
        }

        // ===== Combo decay =====
        if (now - s.stats.lastKillTime > COMBO_WINDOW_MS && s.stats.comboMultiplier > 1) {
          s.stats.currentStreak = 0;
          s.stats.comboMultiplier = 1;
        }

        // ===== Wave end =====
        if (s.phase === "wave" && s.pendingSpawns.length === 0 && s.enemies.length === 0) {
          const cleared = s.wave;
          const bonus = WAVE_BONUS_BASE + cleared * WAVE_BONUS_PER_WAVE;
          s.currency += bonus;
          s.floatingTexts.push({
            id: getId(), pos: { x: CENTER.x, y: CENTER.y - 40 },
            text: `WAVE BONUS +$${bonus}`, color: "#7fd650", vy: -0.7, life: 80, maxLife: 80,
          });
          showBanner(`✅ WAVE ${cleared + 1} CLEARED`, 2200);
          s.wave = cleared + 1;
          s.phase = "building";
          setWave(s.wave);
          setPhase("building");
          setCurrency(s.currency);
          s.lastSyncedCurrency = s.currency;
          setTick(t => t + 1);
        }

        // ===== Throttled state sync =====
        if (frame - s.lastSyncFrame >= STATE_SYNC_INTERVAL) {
          s.lastSyncFrame = frame;
          if (s.currency !== s.lastSyncedCurrency) { setCurrency(s.currency); s.lastSyncedCurrency = s.currency; }
          if (s.baseHp !== s.lastSyncedBaseHp) { setBaseHp(s.baseHp); s.lastSyncedBaseHp = s.baseHp; }
        }

        // ===== Floating texts =====
        {
          let w = 0;
          for (let i = 0; i < s.floatingTexts.length; i++) {
            const ft = s.floatingTexts[i];
            ft.pos.y += ft.vy; ft.vy *= 0.97; ft.life--;
            if (ft.life > 0) { if (w !== i) s.floatingTexts[w] = ft; w++; }
          }
          s.floatingTexts.length = w;
        }

        // ===== Particles =====
        {
          let w = 0;
          for (let i = 0; i < s.particles.length; i++) {
            const p = s.particles[i];
            p.pos.x += p.vel.x; p.pos.y += p.vel.y;
            p.vel.x *= p.decay; p.vel.y *= p.decay; p.life--;
            if (p.life > 0) { if (w !== i) s.particles[w] = p; w++; }
          }
          s.particles.length = w;
        }

        if (s.shake > 0) s.shake = Math.max(0, s.shake - 1);
      }

      // ===================== DRAW =====================
      const dpr = canvas.width / (s.canvasW || W);
      ctx.save();
      ctx.scale(dpr, dpr);
      // Scale to logical size
      const sx = (s.canvasW || W) / W;
      const sy = (s.canvasH || H) / H;
      ctx.scale(sx, sy);

      const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Terrain
      try { ctx.drawImage(getTerrainCanvas(), 0, 0); } catch {
        ctx.fillStyle = "#1a2418";
        ctx.fillRect(0, 0, W, H);
      }
      drawGrid(ctx);
      drawBrackets(ctx);

      // Supply lines
      drawSupplyLines(ctx, s.buildings, frame);

      // Radar + repair ranges
      drawRadarSweep(ctx, s.buildings, frame);
      drawRepairRanges(ctx, s.buildings, frame);

      // Base turret range hint in build phase
      if (s.phase === "building") {
        ctx.strokeStyle = "rgba(255, 208, 96, 0.1)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, BASE_TURRET_RANGE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Slots + buildings
      for (let i = 0; i < SLOT_POSITIONS.length; i++) {
        const b = s.buildings.find(bb => bb.slot === i);
        const active = s.hoveredSlot === i || openMenuSlot === i;
        if (!b) drawEmptySlot(ctx, SLOT_POSITIONS[i], frame, active);
        else drawBuildingGfx(ctx, b, frame, active);
      }

      // HQ
      drawBase(ctx, s.baseHp, frame, s.shieldActive);

      // Ground units
      for (const u of s.units) { if (!u.spec.isAircraft) drawUnitGfx(ctx, u); }
      // Enemies
      for (const e of s.enemies) drawEnemyGfx(ctx, e);
      // Air units
      for (const u of s.units) { if (u.spec.isAircraft) drawUnitGfx(ctx, u); }

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.pos.x - p.size / 2, p.pos.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Bullets
      for (const b of s.bullets) {
        ctx.fillStyle = b.color + "44";
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Airstrikes
      for (const as_ of s.airstrikes) {
        const progress = clamp((now - as_.time) / as_.delay, 0, 1);
        drawAirstrikeTarget(ctx, as_.pos, as_.radius, progress);
      }

      // Floating texts
      for (const ft of s.floatingTexts) {
        ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 2);
        const sz = Math.round(13 * (ft.scale || 1));
        ctx.font = `bold ${sz}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillText(ft.text, ft.pos.x + 1, ft.pos.y + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.pos.x, ft.pos.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";

      // Time of day tint
      drawTimeTint(ctx, timeOfDay);
      drawVignette(ctx);

      // Airstrike cursor
      if (s.selectingAirstrike) {
        ctx.strokeStyle = "rgba(255, 80, 30, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        if (s.hoveredSlot === null) {
          // Draw at mouse pos stored somewhere... for now skip
        }
        ctx.setLineDash([]);
      }

      ctx.restore(); // shake
      ctx.restore(); // scale + dpr
      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, [gameStarted, highestWave, showBanner, openMenuSlot]);

  // ===== Input handlers =====
  const getLogicalCoords = (clientX: number, clientY: number): Vec => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const findSlotAt = (pos: Vec): number | null => {
    for (let i = 0; i < SLOT_POSITIONS.length; i++) {
      if (dist(SLOT_POSITIONS[i], pos) < SLOT_RADIUS + 6) return i;
    }
    return null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pos = getLogicalCoords(e.clientX, e.clientY);
    stateRef.current.hoveredSlot = findSlotAt(pos);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (stateRef.current.phase === "gameover") return;
    const pos = getLogicalCoords(e.clientX, e.clientY);

    // Airstrike placement
    if (stateRef.current.selectingAirstrike) {
      const ab = stateRef.current.abilities.find(a => a.type === "airstrike");
      if (ab) {
        ab.lastUsed = Date.now();
        stateRef.current.airstrikes.push({
          pos: { ...pos }, radius: AIRSTRIKE_RADIUS, damage: AIRSTRIKE_DAMAGE,
          time: Date.now(), delay: AIRSTRIKE_DELAY,
        });
        stateRef.current.selectingAirstrike = false;
        setSelectingAirstrike(false);
        playAbility();
        setTick(t => t + 1);
      }
      return;
    }

    const slot = findSlotAt(pos);
    if (slot === null) {
      setOpenMenuSlot(null);
    } else {
      setOpenMenuSlot(slot === openMenuSlot ? null : slot);
    }
  };

  // ===== Wave preview =====
  const preview = phase === "building" ? getWavePreview(stateRef.current.wave) : null;
  const enemyIcons: Record<string, string> = {
    basic: "🔴", scout: "💜", heavy: "🟤", stealth: "👻",
    bomber: "💣", swarm: "🐜", healer: "💚", boss: "💀",
  };

  const currentBuildingAtMenu = openMenuSlot !== null
    ? stateRef.current.buildings.find(b => b.slot === openMenuSlot) ?? null
    : null;

  const stats = stateRef.current.stats;
  const abilityStates = stateRef.current.abilities;
  const now = Date.now();

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* HUD */}
      <div className="flex items-center justify-between w-full gap-2 font-[family-name:var(--font-mono)] text-lg sm:text-2xl flex-wrap px-1">
        <span>
          <span className="text-[#6a8a60]">$ </span>
          <span className="text-[#b0ffa0]">{currency}</span>
        </span>
        <span>
          <span className="text-[#6a8a60]">WAVE </span>
          <span className="text-[#ff8a3d]">{wave + 1}</span>
        </span>
        {stats.comboMultiplier > 1 && (
          <span className="text-[#ffaa00] flicker">x{stats.comboMultiplier.toFixed(1)}</span>
        )}
        <span>
          <span className="text-[#6a8a60]">KILLS </span>
          <span className="text-[#f5e8d0]">{stats.kills}</span>
        </span>
        <span>
          <span className="text-[#6a8a60]">BEST </span>
          <span className="text-[#f5e8d0]">{highestWave + 1}</span>
        </span>
        <button
          onClick={toggleFullscreen}
          className="text-sm px-2 py-1 rounded bg-[#2a3a22] hover:bg-[#3a5a30] text-[#8a9a78] transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? "⤓" : "⤢"}
        </button>
      </div>

      {/* HP bar */}
      <div className="w-full flex items-center gap-2 font-[family-name:var(--font-mono)] text-base px-1">
        <span className="text-[#6a8a60] text-sm">HQ</span>
        <div className="flex-1 h-3.5 bg-[#1a2a18] rounded border border-[#3a5a30] overflow-hidden">
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${Math.max(0, (baseHp / BASE_MAX_HP) * 100)}%`,
              background: baseHp > BASE_MAX_HP * 0.5 ? "#7fd650"
                : baseHp > BASE_MAX_HP * 0.25 ? "#ff6b1a" : "#d63d3d",
            }}
          />
        </div>
        <span className="text-[#b0c0a0] w-20 text-right text-sm">
          {Math.max(0, Math.round(baseHp))}/{BASE_MAX_HP}
        </span>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-[#2a3a22]"
        style={{ aspectRatio: `${W}/${H}`, maxHeight: isFullscreen ? "100vh" : "75vh" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          style={{ cursor: selectingAirstrike ? "crosshair" : "pointer" }}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onContextMenu={e => e.preventDefault()}
        />

        {openMenuSlot !== null && phase !== "gameover" && gameStarted && (
          <SlotMenu
            slot={openMenuSlot}
            building={currentBuildingAtMenu}
            currency={currency}
            isMobile={isMobile}
            onBuild={t => tryBuild(openMenuSlot, t)}
            onUpgrade={() => tryUpgrade(openMenuSlot)}
            onSell={() => sellBuilding(openMenuSlot)}
            onClose={() => setOpenMenuSlot(null)}
          />
        )}

        {banner && phase !== "gameover" && (
          <div className="absolute inset-x-0 top-1/3 flex items-center justify-center pointer-events-none z-20">
            <div className="font-[family-name:var(--font-display)] text-sm sm:text-xl text-[#ff8a3d] drop-shadow-[0_0_12px_rgba(255,107,26,0.6)] flicker text-center px-4">
              {banner}
            </div>
          </div>
        )}

        {gameStarted && phase === "building" && stateRef.current.buildings.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-[family-name:var(--font-mono)] text-sm text-[#8a9a78] bg-black/60 px-3 py-1 rounded pointer-events-none">
            tap a slot to build
          </div>
        )}

        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded z-30">
            <h2 className="font-[family-name:var(--font-display)] text-base sm:text-lg text-[#7fd650] mb-3">
              BASE COMMAND
            </h2>
            <div className="font-[family-name:var(--font-mono)] text-base sm:text-lg text-[#8a9a78] text-center mb-4 leading-snug max-w-lg px-4 space-y-1">
              <p>Defend HQ from waves of enemies.</p>
              <p>10 build slots · 10 building types · 8 unit classes</p>
              <p>Upgrade buildings to Lv3 for stronger units.</p>
              <p className="text-[#ff8a3d]">Use abilities. Chain kills for combo bonuses.</p>
            </div>
            <button
              onClick={resetGame}
              className="pixel-edge px-6 py-2.5 rounded bg-[#7fd650] text-[#1a2418] font-[family-name:var(--font-display)] text-xs hover:brightness-110 transition-all"
            >
              ▶ DEPLOY
            </button>
          </div>
        )}

        {phase === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded z-30">
            <h2 className="font-[family-name:var(--font-display)] text-base sm:text-lg text-[#d63d3d] mb-3">
              HQ DESTROYED
            </h2>
            <div className="font-[family-name:var(--font-mono)] text-lg text-[#f5e8d0] mb-1">
              Cleared {wave} {wave === 1 ? "wave" : "waves"}
            </div>
            {wave > 0 && wave >= highestWave && (
              <div className="font-[family-name:var(--font-mono)] text-base text-[#ff8a3d] mb-2 flicker">
                ★ NEW RECORD ★
              </div>
            )}
            <div className="font-[family-name:var(--font-mono)] text-sm text-[#8a9a78] space-y-0.5 mb-4 text-center">
              <p>Kills: {stats.kills} · Damage: {Math.round(stats.damageDealt)}</p>
              <p>Buildings: {stats.buildingsBuilt} · Units: {stats.unitsSpawned}</p>
              <p>Longest Streak: {stats.longestStreak}</p>
            </div>
            <button
              onClick={resetGame}
              className="pixel-edge px-6 py-2.5 rounded bg-[#ff6b1a] text-[#1a2418] font-[family-name:var(--font-display)] text-xs hover:brightness-110 transition-all"
            >
              REDEPLOY
            </button>
          </div>
        )}
      </div>

      {/* Abilities + Start Wave row */}
      {gameStarted && phase !== "gameover" && (
        <div className="w-full flex items-center justify-between gap-2 px-1 flex-wrap">
          <div className="flex gap-1.5">
            {abilityStates.map(ab => {
              const cd = Math.max(0, ab.cooldown - (now - ab.lastUsed));
              const ready = cd <= 0 && phase === "wave";
              const active = ab.type === "airstrike" && selectingAirstrike;
              return (
                <button
                  key={ab.type}
                  onClick={() => useAbility(ab.type)}
                  disabled={!ready && !active}
                  className={`relative px-2 sm:px-3 py-1.5 rounded font-[family-name:var(--font-mono)] text-sm transition-all ${
                    active ? "bg-[#ff6020] text-white ring-2 ring-[#ff8040]" :
                    ready ? "bg-[#2a3a22] hover:bg-[#3a5a30] text-[#b0ffa0] cursor-pointer" :
                    "bg-[#1a2418] text-[#4a5a40] cursor-not-allowed"
                  }`}
                >
                  <span className="text-base">{ab.icon}</span>
                  <span className="hidden sm:inline ml-1">{ab.label}</span>
                  {cd > 0 && (
                    <span className="ml-1 text-xs text-[#6a7a60]">{Math.ceil(cd / 1000)}s</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Wave preview */}
          {preview && phase === "building" && (
            <div className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-sm text-[#6a8a60]">
              <span className="text-xs">NEXT:</span>
              {Object.entries(preview).map(([type, count]) => (
                <span key={type} title={type}>
                  {enemyIcons[type] || "?"}{count > 1 ? `×${count}` : ""}
                </span>
              ))}
            </div>
          )}

          {phase === "building" && (
            <button
              onClick={startWave}
              className="pixel-edge px-4 py-2 rounded bg-[#7fd650] text-[#1a2418] font-[family-name:var(--font-display)] text-xs hover:brightness-110 transition-all"
            >
              ▶ START WAVE
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      {gameStarted && phase === "building" && (
        <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-0.5 font-[family-name:var(--font-mono)] text-xs text-[#6a8a60] px-1">
          {(["barracks", "sniper-nest", "tank-factory", "mech-bay", "hangar",
             "drone-hive", "artillery-post", "flame-bunker", "radar-tower", "repair-depot"] as BuildingType[]).map(t => {
            const sp = BUILDING_SPECS[t];
            return (
              <span key={t}>
                {sp.icon} {sp.label} <span className="text-[#8aaa70]">${sp.cost}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
