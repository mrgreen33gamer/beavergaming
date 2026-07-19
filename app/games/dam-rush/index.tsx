"use client";

import { useEffect, useRef, useState } from "react";
import { useCartridge } from "@/lib/platform/useCartridge";
import {
  initAudio, setMuted as setAudioMuted,
  sfxCatchSmall, sfxCatchBig, sfxFish, sfxBad, sfxPowerup, sfxCombo,
  sfxSplash, sfxSurge, sfxGameOver, sfxStageClear, sfxBreach, sfxStageStart,
  sfxLaneTick, startWater, stopWater,
} from "./sound";

// ===== Dimensions =====
const WIDTH = 640;
const HEIGHT = 480;

// Dam wall geometry
const DAM_X = 92;          // left of wall
const DAM_W = 46;          // wall thickness  (crest face at x=138)
const DAM_FACE = DAM_X + DAM_W;

// Catch line (where the beaver intercepts materials)
const CATCH_X = 184;
const CATCH_X_MIN = 164;
const CATCH_X_MAX = 202;
const CATCH_RADIUS = 22;

// Lanes (debris rows in the reservoir)
const LANE_SPACING = 46;
const LANE_BOTTOM = HEIGHT - 30;   // 450
const MAX_LANES = 8;
const LANE_TOP_LIMIT = 60;

// Heights measured from the bottom of the screen
const WATER_BASE = 250;
const DAM_BASE = 286;
const DAM_FLOOR = 150;
const GOAL_BASE = 392;
const GOAL_STEP = 12;
const GOAL_CAP = 442;
const LIVES_START = 3;

// ===== Per-stage tuning =====
const stageGoal = (s: number) => Math.min(GOAL_CAP, GOAL_BASE + (s - 1) * GOAL_STEP);
const stageWaterRise = (s: number) => 0.075 + (s - 1) * 0.032;        // px/frame
const stageSpawn = (s: number) => Math.max(28, 56 - (s - 1) * 2.5);   // frames between spawns
const stageHazard = (s: number) => Math.min(0.30, 0.05 + (s - 1) * 0.025);
const stageSpeed = (s: number) => 1.7 + (s - 1) * 0.22;               // px/frame leftward
const stageDamBase = (s: number) => DAM_BASE + (s - 1) * 3;
const stageTheme = (s: number) => (s - 1) % 4;                         // 0 morn 1 noon 2 sunset 3 storm
const STAGE_NAMES = ["MORNING CALM", "MIDDAY FLOW", "SUNSET SURGE", "STORM NIGHT"];

type MatKind =
  | "stick" | "branch" | "log" | "rock" | "fish"
  | "bomb" | "snag"
  | "pw_calm" | "pw_speed" | "pw_mega" | "pw_shield";

type Material = {
  kind: MatKind; x: number; y: number; laneY: number; vx: number;
  bob: number; rot: number; good: boolean; power: boolean; spin: number;
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; grav: number };
type Floater = { x: number; y: number; text: string; color: string; life: number; maxLife: number; vy: number; scale: number };

const DAM_GAIN: Record<string, number> = { stick: 8, branch: 12, log: 20, rock: 15, fish: 0 };
const POINTS: Record<string, number> = { stick: 5, branch: 9, log: 16, rock: 11, fish: 28 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function activeLaneYs(waterLevel: number): number[] {
  const waterTopY = HEIGHT - waterLevel;
  const ys: number[] = [];
  for (let i = 0; i < MAX_LANES; i++) {
    const y = LANE_BOTTOM - i * LANE_SPACING;
    if (y > waterTopY + 14 && y > LANE_TOP_LIMIT) ys.push(y);
  }
  return ys; // index 0 = bottom-most
}

export default function DamRush() {
  // Ref'd because the death handler runs inside the canvas loop, which closes
  // over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("dam-rush");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stage, setStage] = useState(1);
  const [lives, setLives] = useState(LIVES_START);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [subBanner, setSubBanner] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);   // dam→goal %
  const [floodPct, setFloodPct] = useState(0);    // water→dam %
  const [powers, setPowers] = useState({ calm: 0, speed: 0, shield: 0 });

  const s = useRef({
    stage: 1,
    lives: LIVES_START,
    goal: GOAL_BASE,
    dam: DAM_BASE,
    water: WATER_BASE,
    by: HEIGHT - 80,
    targetY: HEIGHT - 80,
    laneIndex: 1,
    up: false, down: false, moveCd: 0,
    materials: [] as Material[],
    particles: [] as Particle[],
    floaters: [] as Floater[],
    chips: [] as Particle[],
    rain: [] as { x: number; y: number; sp: number; len: number }[],
    clouds: [] as { x: number; y: number; sp: number; sc: number }[],
    stars: [] as { x: number; y: number; tw: number }[],
    running: false,
    freeze: 0,
    draining: false,
    drainP: 0, drainFrames: 80,
    drainFromDam: 0, drainToDam: 0, drainFromWater: 0, drainToWater: 0,
    pending: null as null | { type: "next" | "restart"; stage: number },
    score: 0,
    combo: 0,
    lastCatchAt: 0,
    spawnTimer: 40,
    laneSpawnFrame: {} as Record<number, number>,
    t: 0,
    surgeWarnUntil: 0, surgePending: false, nextSurgeAt: 0, surgeFlash: 0,
    calmUntil: 0, speedUntil: 0, shieldCharges: 0,
    buildFlash: 0, buildFlashY: 0,
    carryKind: "" as MatKind | "", carryUntil: 0,
    shake: 0, lightning: 0,
    lastSync: 0,
  });

  useEffect(() => {
    const hs = localStorage.getItem("dam-rush-highscore");
    if (hs) setHighScore(parseInt(hs, 10));
    const m = localStorage.getItem("dam-rush-muted");
    if (m === "1") { setMutedState(true); setAudioMuted(true); }
    // precompute clouds & stars
    const st = s.current;
    for (let i = 0; i < 5; i++) st.clouds.push({ x: Math.random() * WIDTH, y: 30 + Math.random() * 90, sp: 0.15 + Math.random() * 0.25, sc: 0.7 + Math.random() * 0.6 });
    for (let i = 0; i < 40; i++) st.stars.push({ x: Math.random() * WIDTH, y: Math.random() * 200, tw: Math.random() * Math.PI * 2 });
  }, []);

  const showBanner = (text: string, sub: string | null, ms: number) => {
    setBanner(text); setSubBanner(sub);
    setTimeout(() => { setBanner((b) => (b === text ? null : b)); setSubBanner((sb) => (sb === sub ? null : sb)); }, ms);
  };

  // ===== Stage setup =====
  const setupStage = (n: number) => {
    const st = s.current;
    st.stage = n;
    st.goal = stageGoal(n);
    st.dam = stageDamBase(n);
    st.water = WATER_BASE;
    st.materials = [];
    st.spawnTimer = 30;
    st.laneSpawnFrame = {};
    st.surgePending = false;
    st.surgeWarnUntil = 0;
    st.nextSurgeAt = st.t + 60 * 14;
    st.draining = false;
    st.pending = null;
    st.running = true;
    st.freeze = 48;            // brief "get ready"
    st.laneIndex = 1;
    const ys = activeLaneYs(st.water);
    st.targetY = ys[Math.min(st.laneIndex, ys.length - 1)] ?? HEIGHT - 80;
    st.by = st.targetY;
    setStage(n);
    sfxStageStart();
    showBanner(`STAGE ${n}`, STAGE_NAMES[stageTheme(n)], 1700);
  };

  const reset = () => {
    const st = s.current;
    initAudio();
    st.stage = 1; st.lives = LIVES_START; st.score = 0; st.combo = 0;
    st.particles = []; st.floaters = []; st.chips = []; st.rain = [];
    st.calmUntil = 0; st.speedUntil = 0; st.shieldCharges = 0;
    st.t = 0; st.shake = 0; st.surgeFlash = 0; st.lightning = 0;
    st.buildFlash = 0; st.carryUntil = 0;
    setScore(0); setCombo(0); setLives(LIVES_START); setStage(1);
    setPowers({ calm: 0, speed: 0, shield: 0 });
    setGameOver(false); setStarted(true);
    startWater();
    setupStage(1);
  };

  // ===== Spawning =====
  const spawnMaterial = (st: typeof s.current) => {
    const ys = activeLaneYs(st.water);
    if (ys.length === 0) return;
    const N = st.stage;
    const hazardChance = stageHazard(N);
    const powerChance = 0.045;
    const r = Math.random();

    let kind: MatKind, good = true, power = false;
    if (r < powerChance) {
      const pr = Math.random();
      kind = pr < 0.3 ? "pw_calm" : pr < 0.55 ? "pw_speed" : pr < 0.8 ? "pw_shield" : "pw_mega";
      power = true;
    } else if (r < powerChance + hazardChance) {
      kind = Math.random() < 0.6 ? "bomb" : "snag";
      good = false;
    } else {
      const gr = Math.random();
      kind = gr < 0.4 ? "stick" : gr < 0.66 ? "branch" : gr < 0.82 ? "rock" : gr < 0.94 ? "log" : "fish";
    }

    // Pick a lane, avoiding one used very recently (anti-stacking) and,
    // for hazards, avoiding burying the only reachable good lane.
    const candidates = ys.map((_, i) => i).filter((i) => (st.t - (st.laneSpawnFrame[i] ?? -999)) > 24);
    const pool = candidates.length ? candidates : ys.map((_, i) => i);
    const laneIdx = pool[Math.floor(Math.random() * pool.length)];
    st.laneSpawnFrame[laneIdx] = st.t;
    const laneY = ys[laneIdx];

    const baseSpeed = stageSpeed(N) + Math.random() * 0.7;
    const speed = good || power ? baseSpeed : baseSpeed * 0.82; // hazards slower → dodgeable
    st.materials.push({
      kind, x: WIDTH + 26, y: laneY + (Math.random() - 0.5) * 5, laneY,
      vx: -speed, bob: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI * 2,
      good, power, spin: (Math.random() - 0.5) * 0.05,
    });
  };

  // ===== Catch =====
  const onCatch = (st: typeof s.current, m: Material, now: number) => {
    const cx = m.x, cy = m.y;
    if (m.power) {
      if (m.kind === "pw_calm") { st.calmUntil = now + 6000; showBanner("CALM WATERS", null, 1200); }
      else if (m.kind === "pw_speed") { st.speedUntil = now + 6000; showBanner("SPEED PADDLE", null, 1200); }
      else if (m.kind === "pw_shield") { st.shieldCharges = Math.min(3, st.shieldCharges + 2); showBanner("REINFORCED", null, 1200); }
      else if (m.kind === "pw_mega") { addDam(st, 48); burst(st, cx, cy, "#ffd060", 22); showBanner("MEGA LOG!", null, 1300); }
      sfxPowerup(); sparkle(st, cx, cy, "#a0e8ff");
      st.carryKind = m.kind; st.carryUntil = now + 500;
      return;
    }
    if (!m.good) {
      if (st.shieldCharges > 0) {
        st.shieldCharges--; st.floaters.push(mkFloat(cx, cy, "BLOCKED", "#5fc8e0", 1.1));
        burst(st, cx, cy, "#5fc8e0", 12); sfxCatchSmall(); return;
      }
      const loss = m.kind === "bomb" ? 26 : 16;
      st.dam = Math.max(DAM_FLOOR, st.dam - loss);
      st.combo = 0; st.shake = 16;
      burst(st, cx, cy, "#d63d3d", 20);
      st.floaters.push(mkFloat(cx, cy, `-${loss}`, "#ff5050", 1.2));
      sfxBad();
      return;
    }
    // Good catch
    const within = now - st.lastCatchAt < 2200;
    st.combo = within ? Math.min(20, st.combo + 1) : 1;
    st.lastCatchAt = now;
    const mult = 1 + Math.floor(st.combo / 4);
    if (st.combo > 1 && st.combo % 4 === 0) { sfxCombo(); st.floaters.push(mkFloat(CATCH_X, st.by - 32, `COMBO x${mult}`, "#ff8a3d", 1.1)); }

    const gain = DAM_GAIN[m.kind] ?? 0;
    if (gain > 0) { addDam(st, gain); chipsToDam(st, cx, cy); }
    const pts = (POINTS[m.kind] ?? 0) * mult;
    st.score += pts;
    st.carryKind = m.kind; st.carryUntil = now + 350;

    if (m.kind === "fish") { sfxFish(); sparkle(st, cx, cy, "#ff8a3d"); }
    else if (m.kind === "log" || m.kind === "rock") sfxCatchBig();
    else sfxCatchSmall();

    st.floaters.push(mkFloat(cx, cy, `+${pts}`, m.kind === "fish" ? "#ffd060" : "#7fd650", m.kind === "log" ? 1.2 : 1.0));
    burst(st, cx, cy, "#6fc0e8", 7);
  };

  const addDam = (st: typeof s.current, amount: number) => {
    st.dam = Math.min(st.goal + 4, st.dam + amount);
    st.buildFlash = 1; st.buildFlashY = HEIGHT - st.dam;
    sfxSplash();
  };

  // fx helpers
  const mkFloat = (x: number, y: number, text: string, color: string, scale: number): Floater => ({ x, y, text, color, life: 44, maxLife: 44, vy: -1.4, scale });
  const burst = (st: typeof s.current, x: number, y: number, color: string, n: number) => {
    if (st.particles.length > 260) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.4;
      st.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 26, maxLife: 26, color, size: 2 + Math.random() * 2, grav: 0.18 });
    }
  };
  const sparkle = (st: typeof s.current, x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; st.particles.push({ x, y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, life: 24, maxLife: 24, color, size: 2.4, grav: 0 }); }
  };
  const chipsToDam = (st: typeof s.current, x: number, y: number) => {
    const tx = DAM_FACE - 6, ty = HEIGHT - st.dam;
    for (let i = 0; i < 5; i++) {
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      const sp = 5 + Math.random() * 2;
      st.chips.push({ x, y, vx: (dx / d) * sp + (Math.random() - 0.5), vy: (dy / d) * sp + (Math.random() - 0.5), life: 16, maxLife: 16, color: "#9a7a4a", size: 2.5, grav: 0 });
    }
  };
  const fireworks = (st: typeof s.current) => {
    const cx = WIDTH * (0.4 + Math.random() * 0.4), cy = 80 + Math.random() * 120;
    const col = ["#ffd060", "#ff8a3d", "#7fd650", "#5fc8e0", "#ff5050"][Math.floor(Math.random() * 5)];
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, sp = 2 + Math.random() * 2.5; st.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 40, maxLife: 40, color: col, size: 2.5, grav: 0.04 }); }
  };

  // ===== Stage transitions =====
  const stageClear = (st: typeof s.current) => {
    st.running = false;
    st.score += 120 * st.stage;
    sfxStageClear();
    showBanner(`STAGE ${st.stage} CLEAR!`, "the flood recedes…", 1900);
    st.draining = true; st.drainP = 0; st.drainFrames = 90;
    st.drainFromDam = st.dam; st.drainFromWater = st.water;
    st.drainToDam = stageDamBase(st.stage + 1); st.drainToWater = WATER_BASE;
    st.pending = { type: "next", stage: st.stage + 1 };
  };
  const breach = (st: typeof s.current) => {
    st.lives -= 1; setLives(st.lives);
    st.shake = 22; sfxBreach();
    // flood spray over the dam
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI - Math.PI, sp = 2 + Math.random() * 5; st.particles.push({ x: DAM_FACE + Math.random() * 30, y: HEIGHT - st.dam, vx: -Math.abs(Math.cos(a) * sp), vy: Math.sin(a) * sp, life: 46, maxLife: 46, color: i % 2 ? "#5fc8e0" : "#a0e8ff", size: 3, grav: 0.2 }); }
    if (st.lives <= 0) { die(st); return; }
    st.running = false;
    showBanner("DAM BREACHED!", `${st.lives} ${st.lives === 1 ? "life" : "lives"} left`, 1600);
    st.draining = true; st.drainP = 0; st.drainFrames = 55;
    st.drainFromDam = st.dam; st.drainFromWater = st.water;
    st.drainToDam = stageDamBase(st.stage); st.drainToWater = WATER_BASE;
    st.pending = { type: "restart", stage: st.stage };
  };
  const die = (st: typeof s.current) => {
    st.running = false; st.draining = false; st.pending = null;
    stopWater(); sfxGameOver();
    const final = Math.floor(st.score);
    setScore(final);
    if (final > highScore) { setHighScore(final); localStorage.setItem("dam-rush-highscore", String(final)); }
    hostRef.current.reportScore(final);
    setTimeout(() => setGameOver(true), 700);
  };

  // ===== Main loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;
      const now = Date.now();
      st.t++;

      // ---------- DRAIN / TRANSITION ----------
      if (st.draining) {
        st.drainP = Math.min(1, st.drainP + 1 / st.drainFrames);
        const p = easeInOut(st.drainP);
        st.dam = lerp(st.drainFromDam, st.drainToDam, p);
        st.water = lerp(st.drainFromWater, st.drainToWater, p);
        if (st.pending?.type === "next" && Math.random() < 0.25) fireworks(st);
        if (st.drainP >= 1) {
          const pend = st.pending;
          st.draining = false; st.pending = null;
          if (pend) setupStage(pend.stage);
        }
      } else if (st.running) {
        // ---------- BEAVER LANE MOVEMENT ----------
        const ys = activeLaneYs(st.water);
        if (st.moveCd > 0) st.moveCd--;
        if ((st.up || st.down) && st.moveCd <= 0) {
          if (st.up) st.laneIndex = Math.min(ys.length - 1, st.laneIndex + 1);
          if (st.down) st.laneIndex = Math.max(0, st.laneIndex - 1);
          st.moveCd = st.speedUntil > now ? 6 : 9;
          sfxLaneTick();
        }
        st.laneIndex = Math.max(0, Math.min(ys.length - 1, st.laneIndex));
        const tY = ys[st.laneIndex] ?? st.targetY;
        st.targetY = tY;
        const ease = st.speedUntil > now ? 0.42 : 0.3;
        st.by += (st.targetY - st.by) * ease;

        // ---------- FREEZE (get-ready) ----------
        if (st.freeze > 0) {
          st.freeze--;
        } else {
          // ---------- WATER RISE ----------
          const calm = st.calmUntil > now;
          const rise = stageWaterRise(st.stage) * (calm ? 0.25 : 1);
          st.water += rise;

          // ---------- SURGE ----------
          if (!st.surgePending && st.t >= st.nextSurgeAt) {
            st.surgePending = true; st.surgeWarnUntil = now + 2200; sfxSurge();
            showBanner("⚠ FLOOD SURGE ⚠", null, 2000);
          }
          if (st.surgePending && now >= st.surgeWarnUntil) {
            st.surgePending = false;
            st.water += calm ? 12 : 34;
            st.surgeFlash = 1; st.shake = 14;
            st.nextSurgeAt = st.t + 60 * (13 + Math.random() * 7);
          }

          // ---------- SPAWNING ----------
          st.spawnTimer--;
          if (st.spawnTimer <= 0) { st.spawnTimer = stageSpawn(st.stage); spawnMaterial(st); }

          // ---------- WIN / LOSE ----------
          if (st.dam >= st.goal) { stageClear(st); }
          else if (st.water >= st.dam) { breach(st); }
        }

        // ---------- MATERIALS ----------
        for (const m of st.materials) { m.x += m.vx; m.bob += 0.08; m.rot += m.spin; }
        const remaining: Material[] = [];
        for (const m of st.materials) {
          const my = m.y + Math.sin(m.bob) * 2;
          if (m.x <= CATCH_X_MAX && m.x >= CATCH_X_MIN && Math.abs(my - st.by) < CATCH_RADIUS) { onCatch(st, m, now); continue; }
          if (m.x < DAM_FACE - 26) continue;
          remaining.push(m);
        }
        st.materials = remaining;

        // ---------- score over time + combo decay ----------
        st.score += 0.05 * (1 + Math.floor(st.combo / 4));
        if (st.combo > 0 && now - st.lastCatchAt > 2200) st.combo = 0;
      }

      // ---------- SURGE FLASH / FX decay ----------
      if (st.surgeFlash > 0) st.surgeFlash = Math.max(0, st.surgeFlash - 0.04);
      if (st.buildFlash > 0) st.buildFlash = Math.max(0, st.buildFlash - 0.06);
      if (st.shake > 0) st.shake = Math.max(0, st.shake - 1.4);
      if (st.lightning > 0) st.lightning = Math.max(0, st.lightning - 0.08);

      // ---------- WEATHER ----------
      const theme = stageTheme(st.stage);
      if (theme === 3 && (st.running || st.draining)) {
        if (st.rain.length < 80) for (let i = 0; i < 3; i++) st.rain.push({ x: Math.random() * (WIDTH + 80), y: Math.random() * -60, sp: 9 + Math.random() * 4, len: 9 + Math.random() * 6 });
        for (const r of st.rain) { r.x -= 2.2; r.y += r.sp; }
        st.rain = st.rain.filter((r) => r.y < HEIGHT + 20 && r.x > -30);
        if (Math.random() < 0.004) st.lightning = 1;
      } else if (st.rain.length) st.rain.length = 0;
      for (const c of st.clouds) { c.x -= c.sp; if (c.x < -80) c.x = WIDTH + 60; }

      // ---------- particles / chips / floaters ----------
      stepParticles(st.particles);
      stepParticles(st.chips);
      {
        let w = 0;
        for (let i = 0; i < st.floaters.length; i++) { const f = st.floaters[i]; f.y += f.vy; f.vy *= 0.97; f.life--; if (f.life > 0) { if (w !== i) st.floaters[w] = f; w++; } }
        st.floaters.length = w;
      }

      // ---------- HUD sync ----------
      if (st.t - st.lastSync >= 4) {
        st.lastSync = st.t;
        setScore(Math.floor(st.score));
        setCombo(st.combo);
        const base = stageDamBase(st.stage);
        setProgress(Math.max(0, Math.min(100, Math.round(((st.dam - base) / Math.max(1, st.goal - base)) * 100))));
        setFloodPct(Math.max(0, Math.min(100, Math.round((st.water / st.dam) * 100))));
        setPowers({
          calm: st.calmUntil > now ? Math.ceil((st.calmUntil - now) / 1000) : 0,
          speed: st.speedUntil > now ? Math.ceil((st.speedUntil - now) / 1000) : 0,
          shield: st.shieldCharges,
        });
      }

      render(ctx, st, now);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Rendering =====
  const render = (ctx: CanvasRenderingContext2D, st: typeof s.current, now: number) => {
    const theme = stageTheme(st.stage);
    const sky = SKIES[theme];
    const shx = st.shake > 0 ? (Math.random() - 0.5) * st.shake : 0;
    const shy = st.shake > 0 ? (Math.random() - 0.5) * st.shake : 0;

    ctx.save();
    ctx.translate(shx, shy);

    // Sky
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, sky[0]); g.addColorStop(0.55, sky[1]); g.addColorStop(1, sky[2]);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60);

    // Stars (night)
    if (theme === 3) {
      for (const stt of st.stars) { const a = 0.4 + Math.abs(Math.sin(now * 0.002 + stt.tw)) * 0.5; ctx.fillStyle = `rgba(220,225,255,${a})`; ctx.fillRect(stt.x, stt.y, 1.5, 1.5); }
    }
    // Sun / moon with glow
    const orb = theme === 2 ? { x: 540, y: 130, c: "#ff8a3d" } : theme === 3 ? { x: 540, y: 80, c: "#dfe4ff" } : { x: 540, y: 96, c: "#ffe27a" };
    const og = ctx.createRadialGradient(orb.x, orb.y, 4, orb.x, orb.y, 60);
    og.addColorStop(0, orb.c); og.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(orb.x, orb.y, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = orb.c; ctx.beginPath(); ctx.arc(orb.x, orb.y, theme === 3 ? 18 : 24, 0, Math.PI * 2); ctx.fill();

    // Clouds
    for (const c of st.clouds) drawCloud(ctx, c.x, c.y, c.sc, theme >= 2 ? "rgba(40,40,60,0.5)" : "rgba(255,255,255,0.7)");

    // Distant hills
    ctx.fillStyle = theme === 3 ? "#10182a" : theme === 2 ? "#3a2a3a" : "#2e4226";
    for (let i = 0; i < 5; i++) { const hx = i * 150 - 40; ctx.beginPath(); ctx.moveTo(hx, HEIGHT * 0.52); ctx.quadraticCurveTo(hx + 75, HEIGHT * 0.32, hx + 150, HEIGHT * 0.52); ctx.lineTo(hx + 150, HEIGHT); ctx.lineTo(hx, HEIGHT); ctx.closePath(); ctx.fill(); }

    // Ground (protected left side)
    ctx.fillStyle = theme === 3 ? "#16203a" : "#3a2a18";
    ctx.fillRect(-30, HEIGHT - 26, WIDTH + 60, 60);

    const waterTopY = HEIGHT - st.water;
    const damTopY = HEIGHT - st.dam;
    const goalY = HEIGHT - st.goal;

    // Water
    drawWater(ctx, st, waterTopY, damTopY, now);

    // Rain
    if (st.rain.length) { ctx.strokeStyle = "rgba(170,195,235,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (const r of st.rain) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 2, r.y + r.len); } ctx.stroke(); }

    // Faint lane guides (structure cue)
    if (st.running && !st.draining) {
      const ys = activeLaneYs(st.water);
      ctx.strokeStyle = "rgba(200,230,255,0.06)"; ctx.lineWidth = 1; ctx.setLineDash([3, 9]);
      for (const ly of ys) { ctx.beginPath(); ctx.moveTo(DAM_FACE, ly); ctx.lineTo(WIDTH, ly); ctx.stroke(); }
      ctx.setLineDash([]);
    }

    // GOAL line
    drawGoalLine(ctx, goalY, now, st.dam >= st.goal);

    // Materials
    for (const m of st.materials) drawMaterial(ctx, m, now);

    // Chips flying to dam
    for (const p of st.chips) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;

    // Lodge + dam
    drawLodge(ctx, st);
    drawDam(ctx, damTopY, waterTopY, st.buildFlash, st.buildFlashY);

    // Beaver
    if (st.running || st.draining || st.particles.length > 0) {
      drawBeaver(ctx, CATCH_X, st.by, st.t, st.shieldCharges > 0, st.carryUntil > now ? st.carryKind : "");
    }

    // Particles
    for (const p of st.particles) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;

    // Floaters
    for (const f of st.floaters) {
      ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 2);
      ctx.font = `bold ${Math.floor(13 * f.scale)}px monospace`; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = "start";

    // Lightning flash
    if (st.lightning > 0) { ctx.fillStyle = `rgba(220,230,255,${st.lightning * 0.5})`; ctx.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60); }
    // Surge red flash + border
    if (st.surgeFlash > 0) { ctx.fillStyle = `rgba(214,61,61,${st.surgeFlash * 0.32})`; ctx.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60); }
    if (st.surgePending) { const pulse = 0.2 + Math.abs(Math.sin(now * 0.01)) * 0.25; ctx.strokeStyle = `rgba(255,80,80,${pulse})`; ctx.lineWidth = 10; ctx.strokeRect(5, 5, WIDTH - 10, HEIGHT - 10); }

    // On-canvas top gauge
    drawGauge(ctx, st);

    ctx.restore();
  };

  // ===== Input =====
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); if (!s.current.up) { s.current.up = true; s.current.moveCd = 0; } }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); if (!s.current.down) { s.current.down = true; s.current.moveCd = 0; } }
      if (e.code === "Space" || e.code === "Enter") { if (!started || gameOver) { e.preventDefault(); reset(); } }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") s.current.up = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") s.current.down = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  // pointer / touch → snap to nearest active lane
  const pointerLane = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = s.current;
    if (!st.running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const py = (e.clientY - rect.top) * (HEIGHT / rect.height);
    const ys = activeLaneYs(st.water);
    if (!ys.length) return;
    let best = 0, bd = Infinity;
    ys.forEach((ly, i) => { const d = Math.abs(ly - py); if (d < bd) { bd = d; best = i; } });
    if (best !== st.laneIndex) { st.laneIndex = best; sfxLaneTick(); }
  };

  const toggleMute = () => { const n = !muted; setMutedState(n); setAudioMuted(n); localStorage.setItem("dam-rush-muted", n ? "1" : "0"); };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[640px] font-[family-name:var(--font-mono)] text-base flex-wrap gap-x-3 gap-y-1">
        <span><span className="text-[var(--muted)]">STAGE </span><span className="text-[var(--crt-green)] text-lg">{stage}</span></span>
        <span className="text-[#7fd650]">{"🦫".repeat(Math.max(0, lives))}<span className="text-[#3a2818]">{"🦫".repeat(Math.max(0, LIVES_START - lives))}</span></span>
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--foreground)] text-lg">{String(score).padStart(5, "0")}</span></span>
        {combo > 1 && <span className="px-2 py-0.5 rounded bg-[var(--accent-hot)]/25 text-[var(--accent-hot)] flicker">x{1 + Math.floor(combo / 4)}</span>}
        <span className="flex items-center gap-1">
          {powers.calm > 0 && <span className="px-1.5 py-0.5 rounded bg-[#5fc8e022] text-[#a0e8ff]">🌊{powers.calm}</span>}
          {powers.speed > 0 && <span className="px-1.5 py-0.5 rounded bg-[#ffd06022] text-[#ffd060]">⚡{powers.speed}</span>}
          {powers.shield > 0 && <span className="px-1.5 py-0.5 rounded bg-[#7fd65022] text-[#7fd650]">🛡{powers.shield}</span>}
        </span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[640px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas
          ref={canvasRef} width={WIDTH} height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-ns-resize touch-none"
          onPointerMove={pointerLane} onPointerDown={pointerLane}
        />

        {banner && (
          <div className="absolute inset-x-0 top-[28%] flex flex-col items-center pointer-events-none z-20 px-4 text-center">
            <div className="font-[family-name:var(--font-display)] text-base sm:text-xl text-[var(--accent)] drop-shadow-[0_0_12px_rgba(255,107,26,0.7)] flicker">{banner}</div>
            {subBanner && <div className="font-[family-name:var(--font-mono)] text-base text-[var(--foreground)] mt-2">{subBanner}</div>}
          </div>
        )}

        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-1">🦫 DAM RUSH</h2>
            {!gameOver ? (
              <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-3 max-w-sm leading-snug">
                Race your dam up to the <span className="text-[var(--accent-hot)]">GOAL line</span> before the rising
                water tops it. Catch logs &amp; rocks to build — dodge the bombs. Clear the stage, then brace for the next surge!
              </p>
            ) : (
              <>
                <p className="font-[family-name:var(--font-mono)] text-2xl text-[var(--foreground)] mb-1">SCORE <span className="text-[var(--accent)]">{score}</span></p>
                <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-1">reached stage {stage}</p>
                {score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
              </>
            )}
            <button onClick={reset} className="pixel-edge px-6 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {gameOver ? "BUILD AGAIN" : "START BUILDING"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">↑ ↓ / W S / mouse / tap a lane · SPACE to start</p>
          </div>
        )}
      </div>

      {/* Footer: progress + flood + mute */}
      <div className="flex items-center gap-3 w-full max-w-[640px] font-[family-name:var(--font-mono)] text-sm">
        <button onClick={toggleMute} className="text-lg text-[var(--muted)] hover:text-[var(--accent)] transition-colors" title="Sound">{muted ? "🔇" : "🔊"}</button>
        {started && !gameOver && (
          <>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[#7fd650]">DAM</span>
              <div className="flex-1 h-3 rounded bg-[var(--surface-2)] overflow-hidden border border-[var(--border)]">
                <div className="h-full bg-[#7fd650] transition-all duration-150" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[var(--muted)] w-8">{progress}%</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[#5fc8e0]">FLOOD</span>
              <div className="flex-1 h-3 rounded bg-[var(--surface-2)] overflow-hidden border border-[var(--border)]">
                <div className="h-full transition-all duration-150" style={{ width: `${floodPct}%`, background: floodPct > 85 ? "#d63d3d" : floodPct > 65 ? "#ffd060" : "#5fc8e0" }} />
              </div>
              <span className="w-8" style={{ color: floodPct > 85 ? "#d63d3d" : "#b8a088" }}>{floodPct}%</span>
            </div>
          </>
        )}
      </div>

      {/* Mobile controls */}
      <div className="sm:hidden flex gap-3 mt-1">
        <button className="pixel-edge px-8 py-4 bg-[var(--surface-2)] rounded text-2xl" onTouchStart={() => { s.current.up = true; s.current.moveCd = 0; }} onTouchEnd={() => (s.current.up = false)}>▲</button>
        <button className="pixel-edge px-8 py-4 bg-[var(--surface-2)] rounded text-2xl" onTouchStart={() => { s.current.down = true; s.current.moveCd = 0; }} onTouchEnd={() => (s.current.down = false)}>▼</button>
      </div>
    </div>
  );
}

// ====================== module-scope helpers ======================

function stepParticles(arr: Particle[]) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) { const p = arr[i]; p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.life--; if (p.life > 0) { if (w !== i) arr[w] = p; w++; } }
  arr.length = w;
}

const SKIES: [string, string, string][] = [
  ["#86c5ee", "#aeddf2", "#dcedf8"], // morning
  ["#5aa6d4", "#8cc6e6", "#c4e4f0"], // noon
  ["#3a2850", "#a84860", "#e08038"], // sunset
  ["#080c1c", "#141d36", "#222d4c"], // storm night
];

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 14 * sc, 0, Math.PI * 2);
  ctx.arc(x + 16 * sc, y + 4 * sc, 18 * sc, 0, Math.PI * 2);
  ctx.arc(x + 36 * sc, y, 14 * sc, 0, Math.PI * 2);
  ctx.arc(x + 18 * sc, y - 8 * sc, 14 * sc, 0, Math.PI * 2);
  ctx.fill();
}

function drawWater(ctx: CanvasRenderingContext2D, st: { water: number; dam: number; t: number }, waterTopY: number, damTopY: number, now: number) {
  const left = DAM_FACE;
  const grad = ctx.createLinearGradient(0, waterTopY, 0, HEIGHT);
  grad.addColorStop(0, "rgba(86,168,214,0.82)");
  grad.addColorStop(0.5, "rgba(48,118,178,0.88)");
  grad.addColorStop(1, "rgba(20,58,104,0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(left, waterTopY, WIDTH - left, HEIGHT - waterTopY);

  // caustic shimmer
  ctx.fillStyle = "rgba(180,225,255,0.06)";
  for (let i = 0; i < 22; i++) {
    const x = left + ((i * 53 + now * 0.04) % (WIDTH - left));
    const y = waterTopY + 14 + ((i * 37) % Math.max(10, (HEIGHT - waterTopY - 20)));
    ctx.fillRect(x, y, 10, 2);
  }

  // wave layers
  for (let layer = 0; layer < 2; layer++) {
    ctx.beginPath(); ctx.moveTo(left, HEIGHT);
    const amp = layer === 0 ? 4 : 2.5, ph = now * (layer === 0 ? 0.003 : 0.005);
    for (let x = left; x <= WIDTH; x += 8) ctx.lineTo(x, waterTopY + Math.sin(x * 0.04 + ph + layer) * amp + layer * 3);
    ctx.lineTo(WIDTH, HEIGHT); ctx.closePath();
    ctx.fillStyle = layer === 0 ? "rgba(130,205,238,0.33)" : "rgba(96,176,220,0.3)"; ctx.fill();
  }
  // surface highlight
  ctx.strokeStyle = "rgba(205,238,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = left; x <= WIDTH; x += 8) { const y = waterTopY + Math.sin(x * 0.04 + now * 0.003) * 4; if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();

  // foam where water meets dam wall
  ctx.fillStyle = "rgba(235,250,255,0.5)";
  for (let i = 0; i < 6; i++) { const fy = waterTopY + Math.sin(now * 0.01 + i) * 3 + i * 2; ctx.beginPath(); ctx.arc(left + 2 + Math.random() * 4, fy, 2 + Math.random() * 2, 0, Math.PI * 2); ctx.fill(); }

  // danger glow when water near crest
  const margin = damTopY - waterTopY; // px gap
  if (margin < 26) {
    const a = (1 - Math.max(0, margin) / 26) * (0.3 + Math.abs(Math.sin(now * 0.012)) * 0.3);
    ctx.fillStyle = `rgba(214,61,61,${a})`;
    ctx.fillRect(left, waterTopY - 6, WIDTH - left, 10);
  }
}

function drawGoalLine(ctx: CanvasRenderingContext2D, goalY: number, now: number, reached: boolean) {
  const pulse = 0.5 + Math.abs(Math.sin(now * 0.005)) * 0.5;
  ctx.strokeStyle = reached ? `rgba(127,214,80,${pulse})` : `rgba(255,210,96,${pulse})`;
  ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(DAM_X - 4, goalY); ctx.lineTo(WIDTH, goalY); ctx.stroke();
  ctx.setLineDash([]);
  // tag
  ctx.fillStyle = reached ? "#7fd650" : "#ffd060";
  ctx.fillRect(WIDTH - 56, goalY - 9, 52, 16);
  ctx.fillStyle = "#1a0e0a"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
  ctx.fillText("GOAL", WIDTH - 30, goalY + 3); ctx.textAlign = "start";
}

function drawDam(ctx: CanvasRenderingContext2D, damTopY: number, waterTopY: number, buildFlash: number, buildFlashY: number) {
  const x0 = DAM_X, w = DAM_W;
  // courses of logs, alternating tone
  let course = 0;
  for (let y = HEIGHT - 4; y > damTopY; y -= 12, course++) {
    ctx.fillStyle = course % 2 === 0 ? "#6a4a28" : "#735030";
    ctx.fillRect(x0, y - 12, w, 12);
    ctx.fillStyle = "#7d5a32"; ctx.fillRect(x0, y - 12, w, 3);
    ctx.fillStyle = "#46301a"; ctx.fillRect(x0, y - 2, w, 2);
    // end-grain
    ctx.fillStyle = "#8a6a3a";
    ctx.beginPath(); ctx.arc(x0 + 7, y - 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x0 + w - 7, y - 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6a4a28";
    ctx.beginPath(); ctx.arc(x0 + 7, y - 6, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x0 + w - 7, y - 6, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  // wet stain near waterline (on the reservoir face)
  if (waterTopY < HEIGHT) {
    ctx.fillStyle = "rgba(30,60,90,0.3)";
    ctx.fillRect(x0 + w - 4, Math.max(damTopY, waterTopY), 4, HEIGHT - Math.max(damTopY, waterTopY));
  }
  // mossy crest cap
  ctx.fillStyle = "#5a7a3a"; ctx.fillRect(x0 - 3, damTopY - 5, w + 6, 6);
  ctx.fillStyle = "#6e9248"; ctx.fillRect(x0 - 3, damTopY - 5, w + 6, 2);
  // mud chinking sides
  ctx.fillStyle = "#3a2818"; ctx.fillRect(x0 - 3, damTopY, 3, HEIGHT - damTopY); ctx.fillRect(x0 + w, damTopY, 3, HEIGHT - damTopY);
  // build flash on new course
  if (buildFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${buildFlash * 0.6})`; ctx.fillRect(x0 - 3, buildFlashY - 6, w + 6, 14); }
}

function drawLodge(ctx: CanvasRenderingContext2D, st: { dam: number; water: number }) {
  const cx = 50, baseY = HEIGHT - 24;
  ctx.fillStyle = "#5a3e22";
  ctx.beginPath(); ctx.moveTo(cx - 42, baseY); ctx.quadraticCurveTo(cx, baseY - 66, cx + 42, baseY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#3a2614"; ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 9, baseY); ctx.lineTo(cx + i * 5, baseY - 46 + Math.abs(i) * 5); ctx.stroke(); }
  ctx.fillStyle = "#1a0e08"; ctx.beginPath(); ctx.ellipse(cx, baseY - 6, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = "15px serif"; ctx.textAlign = "center";
  ctx.fillText("🦫", cx - 6, baseY - 4); ctx.fillText("🦫", cx + 8, baseY - 2);
  if (st.water > st.dam * 0.82) { ctx.fillText("💦", cx, baseY - 54); }
  ctx.textAlign = "start";
}

function drawBeaver(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, shielded: boolean, carry: MatKind | "") {
  const paddle = Math.sin(t * 0.4) * 3;
  ctx.save(); ctx.translate(x, y);
  if (shielded) { ctx.strokeStyle = `rgba(127,214,80,${0.4 + Math.abs(Math.sin(t * 0.1)) * 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke(); }
  // tail
  ctx.fillStyle = "#5a3a22"; ctx.beginPath(); ctx.ellipse(-16, 6 + paddle * 0.5, 9, 6, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4a2e18"; ctx.fillRect(-22, 4 + paddle * 0.5, 12, 2);
  // body
  ctx.fillStyle = "#7a5230"; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8a6238"; ctx.beginPath(); ctx.ellipse(2, -2, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.fillStyle = "#7a5230"; ctx.beginPath(); ctx.arc(12, -2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5a3a22"; ctx.beginPath(); ctx.arc(9, -9, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9a7248"; ctx.beginPath(); ctx.arc(20, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a1810"; ctx.beginPath(); ctx.arc(23, -1, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillRect(21, 2, 3, 3);
  ctx.fillStyle = "#1a0e0a"; ctx.beginPath(); ctx.arc(13, -4, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5a3a22"; ctx.fillRect(6, 8 + paddle, 4, 6);
  // carried item bobbing above head
  if (carry) {
    ctx.save(); ctx.translate(12, -16 + Math.sin(t * 0.3) * 1.5);
    if (carry === "log") { ctx.fillStyle = "#6a4a28"; ctx.fillRect(-8, -3, 16, 6); }
    else if (carry === "rock") { ctx.fillStyle = "#8a8a92"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); }
    else if (carry === "fish") { ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (carry.startsWith("pw")) { ctx.fillStyle = "#ffd060"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = "#9a7248"; ctx.fillRect(-7, -2, 14, 4); }
    ctx.restore();
  }
  ctx.restore();
}

function drawMaterial(ctx: CanvasRenderingContext2D, m: Material, now: number) {
  const y = m.y + Math.sin(m.bob) * 2;
  ctx.save(); ctx.translate(m.x, y);

  // hazard danger aura
  if (!m.good && !m.power) {
    const a = 0.25 + Math.abs(Math.sin(now * 0.012)) * 0.3;
    ctx.fillStyle = `rgba(214,61,61,${a})`; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  }

  switch (m.kind) {
    case "stick":
      ctx.rotate(m.rot); ctx.fillStyle = "#9a7248"; ctx.fillRect(-10, -2, 20, 4); ctx.fillStyle = "#7a5a34"; ctx.fillRect(-10, -2, 20, 1.5); break;
    case "branch":
      ctx.rotate(m.rot * 0.5); ctx.fillStyle = "#8a6238"; ctx.fillRect(-14, -3, 28, 6); ctx.fillStyle = "#6a4a28"; ctx.fillRect(-14, 1, 28, 2); ctx.fillRect(4, -8, 3, 6); break;
    case "log":
      ctx.fillStyle = "#6a4a28"; ctx.fillRect(-18, -8, 36, 16); ctx.fillStyle = "#7d5a32"; ctx.fillRect(-18, -8, 36, 4);
      ctx.fillStyle = "#9a7a4a"; ctx.beginPath(); ctx.arc(-16, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(16, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6a4a28"; ctx.beginPath(); ctx.arc(16, 0, 2, 0, Math.PI * 2); ctx.fill(); break;
    case "rock":
      ctx.fillStyle = "#8a8a92"; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a0a0a8"; ctx.beginPath(); ctx.arc(-3, -3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6a6a72"; ctx.fillRect(-6, 4, 5, 3); break;
    case "fish":
      ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(16, -5); ctx.lineTo(16, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-5, -2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0e0a"; ctx.beginPath(); ctx.arc(-5, -2, 1, 0, Math.PI * 2); ctx.fill(); break;
    case "bomb":
      ctx.fillStyle = "#2a2a2e"; ctx.beginPath(); ctx.arc(0, 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a4a52"; ctx.beginPath(); ctx.arc(-3, -1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a6238"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(9, -13); ctx.stroke();
      ctx.fillStyle = Math.floor(now * 0.02) % 2 ? "#ff6b1a" : "#ffd060"; ctx.beginPath(); ctx.arc(10, -14, 2.5, 0, Math.PI * 2); ctx.fill(); break;
    case "snag":
      ctx.rotate(m.rot * 0.3); ctx.strokeStyle = "#3a2614"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(0, -8); ctx.lineTo(12, 4); ctx.moveTo(0, -8); ctx.lineTo(2, 8); ctx.stroke(); break;
    case "pw_calm": drawOrb(ctx, "#5fc8e0", "🌊", now); break;
    case "pw_speed": drawOrb(ctx, "#ffd060", "⚡", now); break;
    case "pw_shield": drawOrb(ctx, "#7fd650", "🛡", now); break;
    case "pw_mega": drawOrb(ctx, "#ff8a3d", "🪵", now); break;
  }
  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D, color: string, glyph: string, now: number) {
  const pulse = 1 + Math.abs(Math.sin(now * 0.006)) * 0.15;
  ctx.fillStyle = color + "44"; ctx.beginPath(); ctx.arc(0, 0, 17 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.font = "13px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(glyph, 0, 1);
  ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
}

function drawGauge(ctx: CanvasRenderingContext2D, st: { dam: number; water: number; goal: number; stage: number }) {
  // slim vertical tower at far right showing water vs dam vs goal
  const gx = WIDTH - 16, gy = 40, gh = HEIGHT - 90, gw = 8;
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
  const maxH = GOAL_CAP + 20;
  const toY = (h: number) => gy + gh - (h / maxH) * gh;
  // water fill
  ctx.fillStyle = "#3a76b2"; const wy = toY(st.water); ctx.fillRect(gx, wy, gw, gy + gh - wy);
  // dam marker
  const dy = toY(st.dam); ctx.fillStyle = "#7fd650"; ctx.fillRect(gx - 2, dy - 1, gw + 4, 3);
  // goal marker
  const goy = toY(st.goal); ctx.fillStyle = "#ffd060"; ctx.fillRect(gx - 3, goy - 1, gw + 6, 2);
  ctx.strokeStyle = "rgba(245,232,208,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
}
