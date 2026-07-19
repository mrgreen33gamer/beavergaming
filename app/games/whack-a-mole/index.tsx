"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  Mole, Mode, Particle, FloatingText, DeathStats,
} from "./types";
import {
  WIDTH, HEIGHT, HOLE_COLS, HOLE_ROWS,
  CLASSIC_DURATION_SEC,
  MOLE_SPECS, BOSS_FIRST_HIT_POINTS, BOSS_DEFEAT_POINTS,
  BOMB_PENALTY_FRAC, BOMB_PENALTY_FLOOR,
  COMBO_BASE_BONUS, FREEZE_DURATION_MS,
  HAMMER_SWING_MS, RISE_MS, FALL_MS, STUN_MS, SCORE_POP_MS,
  HIGHSCORE_KEY, MODE_DESCRIPTION,
} from "./constants";
import {
  getId, resetIdCounter, holeAt, difficultyT, spawnDelay,
  pickMoleType, pickDuration,
} from "./helpers";
import {
  drawBackground, drawHole, drawDirtMound, drawMole,
  drawHammer, drawImpactFlash, drawFreezeOverlay, drawScreenFlash,
  drawParticles, drawFloatingTexts, holeCenter,
} from "./drawing";
import { useCartridge } from "@/lib/platform/useCartridge";

const DEFAULT_DEATH: DeathStats = {
  mode: "classic", score: 0, hits: 0, misses: 0, accuracy: 0,
  maxCombo: 0, golden: 0, boss: 0, freezes: 0, bombs: 0, timeAliveSec: 0,
};

const N_HOLES = HOLE_COLS * HOLE_ROWS;

export default function WhackAMole() {
  // Ref'd because endGame() runs inside the canvas loop, which closes over its
  // first render — reading `host` directly there would go stale.
  const { host } = useCartridge("whack-a-mole");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(CLASSIC_DURATION_SEC);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [deathStats, setDeathStats] = useState<DeathStats>(DEFAULT_DEATH);
  const [highScores, setHighScores] = useState<Record<Mode, number>>({
    classic: 0, endless: 0,
  });
  const [scorePop, setScorePop] = useState(false);

  const stateRef = useRef({
    mode: "classic" as Mode,
    running: false,
    // Game time (ms). Paused during freeze. All mole ages reference this.
    gameTime: 0,
    lastFrameRealTime: 0,
    nextSpawnGameTime: 0,
    // Real-time clocks
    startedAtRealTime: 0,
    freezeUntilRealTime: 0,

    // Entities
    moles: [] as Mole[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],

    // Stats
    score: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    golden: 0,
    boss: 0,
    freezes: 0,
    bombs: 0,
    powerupsUsed: 0,

    // Cursor / hammer
    cursor: { x: WIDTH / 2, y: HEIGHT / 2, inside: false },
    lastSwingAt: 0,
    lastImpact: { x: 0, y: 0, bornAt: 0 },

    // Visual flashes
    bombFlashUntil: 0,
    freezeFlashUntil: 0,
    scorePopUntil: 0,
  });

  // ===== Load high scores =====
  useEffect(() => {
    const hs: Record<Mode, number> = { classic: 0, endless: 0 };
    (Object.keys(HIGHSCORE_KEY) as Mode[]).forEach((m) => {
      const v = localStorage.getItem(HIGHSCORE_KEY[m]);
      if (v) hs[m] = parseInt(v, 10);
    });
    setHighScores(hs);
  }, []);

  // ===== Start game =====
  const startGame = useCallback((m: Mode) => {
    resetIdCounter();
    const s = stateRef.current;
    s.mode = m;
    s.running = true;
    s.gameTime = 0;
    s.lastFrameRealTime = performance.now();
    s.nextSpawnGameTime = 600;
    s.startedAtRealTime = Date.now();
    s.freezeUntilRealTime = 0;
    s.moles = [];
    s.particles = [];
    s.floatingTexts = [];
    s.score = 0;
    s.hits = 0;
    s.misses = 0;
    s.combo = 0;
    s.maxCombo = 0;
    s.golden = 0;
    s.boss = 0;
    s.freezes = 0;
    s.bombs = 0;
    s.powerupsUsed = 0;
    s.cursor.inside = false;
    s.lastSwingAt = 0;
    s.bombFlashUntil = 0;
    s.freezeFlashUntil = 0;
    s.scorePopUntil = 0;

    setMode(m);
    setScore(0);
    setTimeLeft(CLASSIC_DURATION_SEC);
    setCombo(0);
    setGameOver(false);
    setScorePop(false);
  }, []);

  const backToMenu = () => {
    stateRef.current.running = false;
    setMode(null);
    setGameOver(false);
  };

  // ===== Animation loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;

    const loop = () => {
      frame++;
      const now = Date.now();
      const realNow = performance.now();
      const s = stateRef.current;

      // ---- Advance game time (paused during freeze) ----
      const dt = Math.min(60, realNow - s.lastFrameRealTime);
      s.lastFrameRealTime = realNow;
      const frozen = s.freezeUntilRealTime > now;
      if (s.running && !frozen) {
        s.gameTime += dt;
      }

      // ---- Classic time-up check ----
      if (s.running && s.mode === "classic") {
        const remaining = CLASSIC_DURATION_SEC - s.gameTime / 1000;
        if (remaining <= 0) {
          endGame();
        }
      }

      // ---- Spawn new moles ----
      if (s.running && s.gameTime >= s.nextSpawnGameTime) {
        // Find free holes
        const occupied = new Set(s.moles.map((m) => m.index));
        const free: number[] = [];
        for (let i = 0; i < N_HOLES; i++) if (!occupied.has(i)) free.push(i);
        if (free.length > 0) {
          const idx = free[Math.floor(Math.random() * free.length)];
          const t = difficultyT(s.gameTime / 1000);
          const type = pickMoleType(t);
          const duration = pickDuration(type);
          const isBoss = type === "boss";
          s.moles.push({
            id: getId(),
            index: idx,
            type,
            spawnedGameTime: s.gameTime,
            duration,
            state: "alive",
            stateStartedAt: now,
            hitsLeft: isBoss ? 2 : 1,
          });
          // Dirt burst from hole as mole emerges
          spawnDirtBurst(s, idx, true);
        }
        const t2 = difficultyT(s.gameTime / 1000);
        s.nextSpawnGameTime = s.gameTime + spawnDelay(t2);
      }

      // ---- Update moles (expire / despawn) ----
      {
        let w = 0;
        for (let i = 0; i < s.moles.length; i++) {
          const m = s.moles[i];
          let keep = true;
          if (m.state === "stunned") {
            if (now - m.stateStartedAt > STUN_MS) {
              keep = false;
              // Dirt puff as it disappears
              spawnDirtBurst(s, m.index, false);
            }
          } else {
            const age = s.gameTime - m.spawnedGameTime;
            if (age > m.duration) {
              // Expired — non-bomb mole = miss
              if (m.type !== "bomb") {
                s.misses += 1;
                s.combo = 0;
              }
              spawnDirtBurst(s, m.index, false);
              keep = false;
            }
          }
          if (keep) {
            if (w !== i) s.moles[w] = m;
            w++;
          }
        }
        s.moles.length = w;
      }

      // ---- Update particles (always) ----
      {
        let w = 0;
        for (let i = 0; i < s.particles.length; i++) {
          const p = s.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.life--;
          if (p.life > 0) {
            if (w !== i) s.particles[w] = p;
            w++;
          }
        }
        s.particles.length = w;
      }

      // ---- Floating texts ----
      {
        let w = 0;
        for (let i = 0; i < s.floatingTexts.length; i++) {
          const ft = s.floatingTexts[i];
          ft.y += ft.vy;
          ft.vy *= 0.97;
          ft.life--;
          if (ft.life > 0) {
            if (w !== i) s.floatingTexts[w] = ft;
            w++;
          }
        }
        s.floatingTexts.length = w;
      }

      // ===================== DRAW =====================
      // Late-classic dim
      let dim = 0;
      if (s.mode === "classic" && s.running) {
        const remaining = CLASSIC_DURATION_SEC - s.gameTime / 1000;
        if (remaining < 8) dim = 1 - remaining / 8;
      }
      drawBackground(ctx, dim);

      // Draw all 9 holes
      for (let i = 0; i < N_HOLES; i++) drawHole(ctx, i);

      // Draw moles (above holes, below dirt mound)
      for (const m of s.moles) {
        const age = s.gameTime - m.spawnedGameTime;
        let rise: number;
        if (m.state === "stunned") {
          // Stunned: stay popped for a moment then slip back
          const stunAge = now - m.stateStartedAt;
          rise = Math.max(0, 1 - stunAge / STUN_MS);
        } else if (age < RISE_MS) {
          rise = age / RISE_MS;
        } else if (age > m.duration - FALL_MS) {
          rise = 1 - (age - (m.duration - FALL_MS)) / FALL_MS;
        } else {
          rise = 1;
        }
        rise = Math.max(0, Math.min(1, rise));
        const stunProgress =
          m.state === "stunned"
            ? Math.min(1, (now - m.stateStartedAt) / STUN_MS)
            : 0;
        drawMole(ctx, m, rise, stunProgress, frame);
      }

      // Dirt mounds on top so they cover mole's lower body
      for (let i = 0; i < N_HOLES; i++) drawDirtMound(ctx, i);

      // Particles & floating texts
      drawParticles(ctx, s.particles);
      drawFloatingTexts(ctx, s.floatingTexts);

      // Impact flash
      const impactAge = now - s.lastImpact.bornAt;
      if (impactAge < 220) {
        drawImpactFlash(ctx, s.lastImpact.x, s.lastImpact.y, impactAge, 220);
      }

      // Screen flashes
      if (now < s.bombFlashUntil) {
        const intensity = (s.bombFlashUntil - now) / 200;
        drawScreenFlash(ctx, "rgba(255, 50, 50, ALPHA)", intensity);
      }
      if (now < s.freezeFlashUntil) {
        const intensity = (s.freezeFlashUntil - now) / 200;
        drawScreenFlash(ctx, "rgba(220, 240, 255, ALPHA)", intensity);
      }

      // Freeze overlay (active for FREEZE_DURATION_MS)
      if (frozen) {
        const remaining = s.freezeUntilRealTime - now;
        const intensity = Math.min(1, remaining / FREEZE_DURATION_MS + 0.3);
        drawFreezeOverlay(ctx, intensity, frame);
      }

      // Hammer cursor (drawn last, on top of everything)
      // Stays visible if cursor is on canvas, OR a swing is mid-animation
      // (so taps on mobile show the swing animation even after touch-end).
      const swingActive = now - s.lastSwingAt < HAMMER_SWING_MS;
      if (s.cursor.inside || swingActive) {
        const swingT = Math.min(1, (now - s.lastSwingAt) / HAMMER_SWING_MS);
        drawHammer(ctx, s.cursor.x, s.cursor.y, swingT);
      }

      // HUD sync (throttled)
      if (s.running && frame % 4 === 0) {
        setScore(s.score);
        setCombo(s.combo);
        if (s.mode === "classic") {
          const remaining = Math.max(0, Math.ceil(CLASSIC_DURATION_SEC - s.gameTime / 1000));
          setTimeLeft(remaining);
        }
        setScorePop(s.scorePopUntil > now);
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
   
  }, []);

  // ===== Whack a mole / handle a click =====
  const handleHit = (x: number, y: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    const now = Date.now();
    s.lastSwingAt = now;
    s.lastImpact = { x, y, bornAt: now };

    const idx = holeAt(x, y);
    if (idx < 0) return;

    const mole = s.moles.find((m) => m.index === idx && m.state === "alive");
    if (!mole) return;

    const spec = MOLE_SPECS[mole.type];

    if (mole.type === "bomb") {
      // Hit a bomb
      s.bombs += 1;
      s.bombFlashUntil = now + 200;
      s.combo = 0;
      s.hits += 1;
      mole.state = "stunned";
      mole.stateStartedAt = now;

      const c = holeCenter(idx);
      // Big explosion
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 5;
        s.particles.push({
          x: c.x, y: c.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
          life: 50, maxLife: 50,
          color: i % 3 === 0 ? "#ff6b1a" : i % 3 === 1 ? "#ffd060" : "#1a1a1a",
          size: 3, gravity: 0.15,
        });
      }

      if (s.mode === "endless") {
        // Instant game over
        floatText(s, c.x, c.y - 20, "BOOM!", "#ff5050", 60, 1.4);
        endGame();
      } else {
        // Classic: lose a chunk of score
        const loss = Math.max(BOMB_PENALTY_FLOOR, Math.floor(s.score * BOMB_PENALTY_FRAC));
        s.score = Math.max(0, s.score - loss);
        floatText(s, c.x, c.y - 20, `-${loss}`, "#ff5050", 50, 1.4);
        s.scorePopUntil = now + SCORE_POP_MS;
      }
      return;
    }

    // Non-bomb hit
    // Boss: first hit doesn't defeat; second does
    if (mole.type === "boss" && mole.hitsLeft > 1) {
      mole.hitsLeft -= 1;
      // Partial points, no combo change, no defeat
      const pts = BOSS_FIRST_HIT_POINTS;
      s.score += pts;
      s.scorePopUntil = now + SCORE_POP_MS;
      const c = holeCenter(idx);
      floatText(s, c.x, c.y - 26, `+${pts}`, "#c0c0c8", 36, 1.0);
      // Helmet shatter particles
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3.5;
        s.particles.push({
          x: c.x, y: c.y - 18,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
          life: 32, maxLife: 32,
          color: i % 2 === 0 ? "#aaaaaa" : "#666666",
          size: 3, gravity: 0.2,
        });
      }
      s.hits += 1;
      return;
    }

    // Defeat the mole
    mole.state = "stunned";
    mole.stateStartedAt = now;
    s.hits += 1;
    if (mole.type === "golden") s.golden += 1;
    if (mole.type === "boss") s.boss += 1;
    if (mole.type === "freeze") s.freezes += 1;

    // Combo
    s.combo += 1;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;

    // Score: base + combo bonus
    let basePts = spec.points;
    if (mole.type === "boss") basePts = BOSS_DEFEAT_POINTS;
    const comboBonus = Math.min(s.combo, 10) * COMBO_BASE_BONUS;
    const total = basePts + comboBonus;
    s.score += total;
    s.scorePopUntil = now + SCORE_POP_MS;

    const c = holeCenter(idx);
    const color =
      mole.type === "golden" ? "#ffd060" :
      mole.type === "freeze" ? "#a8e8f8" :
      mole.type === "boss"   ? "#c0c0c8" :
      mole.type === "speedy" ? "#ffaa55" :
      "#7fd650";
    const text = s.combo > 1 ? `+${total} ${s.combo}×` : `+${total}`;
    floatText(s, c.x, c.y - 26, text, color, 44, s.combo >= 5 ? 1.4 : 1.0);

    // Particles
    const count = mole.type === "golden" ? 18 : 12;
    const partColors =
      mole.type === "golden" ? ["#ffd060", "#fff5d0", "#ff8a3d"] :
      mole.type === "freeze" ? ["#a8e8f8", "#5fc8e0", "#ffffff"] :
      mole.type === "boss"   ? ["#5a4028", "#8a6040", "#c0c0c8"] :
      mole.type === "speedy" ? ["#e89a55", "#c8783a", "#ffaa55"] :
      ["#a06030", "#6a4020", "#8a5a30"];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      s.particles.push({
        x: c.x, y: c.y - 10,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        life: 32, maxLife: 32,
        color: partColors[Math.floor(Math.random() * partColors.length)],
        size: 3, gravity: 0.18,
      });
    }

    // Freeze effect: trigger global freeze
    if (mole.type === "freeze") {
      s.freezeUntilRealTime = now + FREEZE_DURATION_MS;
      s.freezeFlashUntil = now + 200;
    }
  };

  // ===== End game / save high score =====
  const endGame = () => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    const elapsed = (Date.now() - s.startedAtRealTime) / 1000;
    const total = s.hits + s.misses;
    const accuracy = total === 0 ? 0 : s.hits / total;
    const stats: DeathStats = {
      mode: s.mode,
      score: s.score,
      hits: s.hits,
      misses: s.misses,
      accuracy,
      maxCombo: s.maxCombo,
      golden: s.golden,
      boss: s.boss,
      freezes: s.freezes,
      bombs: s.bombs,
      timeAliveSec: elapsed,
    };
    setDeathStats(stats);
    setGameOver(true);
    setScore(s.score);
    // Save high score
    const stored = parseInt(localStorage.getItem(HIGHSCORE_KEY[s.mode]) || "0", 10);
    if (s.score > stored) {
      localStorage.setItem(HIGHSCORE_KEY[s.mode], String(s.score));
      setHighScores((prev) => ({ ...prev, [s.mode]: s.score }));
    }
    hostRef.current.reportScore(s.score);
  };

  // ===== Helper: spawn a floating text =====
  const floatText = (
    s: typeof stateRef.current,
    x: number, y: number, text: string, color: string,
    life: number, scale: number
  ) => {
    s.floatingTexts.push({
      id: getId(), x, y, text, color,
      life, maxLife: life, vy: -1.6, scale,
    });
  };

  // ===== Helper: dirt burst =====
  const spawnDirtBurst = (
    s: typeof stateRef.current,
    holeIdx: number,
    pop: boolean
  ) => {
    const c = holeCenter(holeIdx);
    const count = pop ? 8 : 4;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI + Math.random() * Math.PI;  // upper half
      const sp = pop ? 2 + Math.random() * 3 : 1 + Math.random() * 2;
      s.particles.push({
        x: c.x + (Math.random() - 0.5) * 20,
        y: c.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (pop ? 1 : 0.5),
        life: 26 + Math.random() * 10,
        maxLife: 36,
        color: Math.random() < 0.5 ? "#5a3a25" : "#3a2218",
        size: 3 + Math.random() * 1.5,
        gravity: 0.25,
      });
    }
  };

  // ===== Mouse / touch handlers =====
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const onMove = (e: React.MouseEvent) => {
    const pt = getCanvasCoords(e);
    stateRef.current.cursor.x = pt.x;
    stateRef.current.cursor.y = pt.y;
    stateRef.current.cursor.inside = true;
  };

  const onLeave = () => {
    stateRef.current.cursor.inside = false;
  };

  const onClick = (e: React.MouseEvent) => {
    const pt = getCanvasCoords(e);
    handleHit(pt.x, pt.y);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const pt = getCanvasCoords(e);
    stateRef.current.cursor.x = pt.x;
    stateRef.current.cursor.y = pt.y;
    stateRef.current.cursor.inside = true;
    handleHit(pt.x, pt.y);
  };

  // ===== Render: mode select =====
  if (!mode) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">
          PICK A MODE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-[600px]">
          {(["classic", "endless"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => startGame(m)}
              className="pixel-edge px-5 py-4 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] text-left min-w-[220px]"
            >
              <div className="font-[family-name:var(--font-display)] text-sm text-[var(--crt-green)] mb-2 uppercase">
                {m}
              </div>
              <div className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-2 leading-snug">
                {MODE_DESCRIPTION[m]}
              </div>
              <div className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)]">
                Best: {highScores[m] || "—"}
              </div>
            </button>
          ))}
        </div>
        <div className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] max-w-md text-center leading-relaxed">
          <p>🦫 normal (+10) &middot; 🟠 speedy (+20) &middot; ✨ golden (+30)</p>
          <p>💣 bomb (avoid!) &middot; 🛡️ boss (2 hits, +60) &middot; ❄️ freeze (freezes the field)</p>
        </div>
      </div>
    );
  }

  // ===== Render: game =====
  const elapsed = stateRef.current.gameTime / 1000;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[500px] font-[family-name:var(--font-mono)] text-xl flex-wrap gap-2">
        <span>
          <span className="text-[var(--muted)]">SCORE </span>
          <span
            className={`text-[var(--crt-green)] inline-block transition-transform duration-150 ${scorePop ? "scale-125" : "scale-100"}`}
          >
            {String(score).padStart(4, "0")}
          </span>
        </span>
        {mode === "classic" && (
          <span>
            <span className="text-[var(--muted)]">TIME </span>
            <span
              className={timeLeft <= 5 ? "text-[var(--danger)] flicker" : "text-[var(--accent)]"}
            >
              {timeLeft}s
            </span>
          </span>
        )}
        {mode === "endless" && (
          <span>
            <span className="text-[var(--muted)]">TIME </span>
            <span className="text-[var(--accent)]">{formatTime(elapsed)}</span>
          </span>
        )}
        <span>
          <span className="text-[var(--muted)]">BEST </span>
          <span className="text-[var(--foreground)]">{highScores[mode] || 0}</span>
        </span>
      </div>

      {/* Combo banner that grows with combo */}
      {combo > 2 && (
        <div
          className="font-[family-name:var(--font-display)] text-[var(--accent-hot)] flicker"
          style={{
            fontSize: combo >= 10 ? "1.6rem" : combo >= 5 ? "1.2rem" : "1rem",
            textShadow: combo >= 10
              ? "0 0 12px rgba(255,107,26,0.7)"
              : combo >= 5
              ? "0 0 6px rgba(255,107,26,0.5)"
              : undefined,
          }}
        >
          {combo}× COMBO!
        </div>
      )}

      <div
        className="relative w-full max-w-[500px]"
        style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)]"
          style={{ cursor: "none" }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          onClick={onClick}
          onTouchStart={onTouchStart}
        />

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              {mode === "classic" ? "TIME'S UP!" : "BOOM!"}
            </h2>
            <div className="font-[family-name:var(--font-mono)] text-base text-[var(--foreground)] mb-3 min-w-[260px]">
              <Row label="MODE" value={mode.toUpperCase()} />
              <Row label="HITS" value={`${deathStats.hits}`} />
              <Row label="MISSES" value={`${deathStats.misses}`} />
              <Row label="ACCURACY" value={`${Math.round(deathStats.accuracy * 100)}%`} />
              <Row label="MAX COMBO" value={`${deathStats.maxCombo}×`} />
              {deathStats.golden > 0 && <Row label="GOLDEN" value={String(deathStats.golden)} />}
              {deathStats.boss > 0 && <Row label="BOSSES" value={String(deathStats.boss)} />}
              {deathStats.freezes > 0 && <Row label="FREEZES" value={String(deathStats.freezes)} />}
              {deathStats.bombs > 0 && <Row label="BOMBS HIT" value={String(deathStats.bombs)} />}
              <Row label="TIME" value={formatTime(deathStats.timeAliveSec)} />
              <div className="border-t border-[var(--border)] mt-2 pt-2 flex justify-between">
                <span className="text-[var(--muted)]">SCORE</span>
                <span className="text-2xl text-[var(--accent)]">{deathStats.score}</span>
              </div>
              {deathStats.score > 0 && deathStats.score >= (highScores[mode] ?? 0) && (
                <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mt-2 flicker text-center">
                  ★ NEW RECORD ★
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => startGame(mode)}
                className="pixel-edge px-4 py-2 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
              >
                PLAY AGAIN
              </button>
              <button
                onClick={backToMenu}
                className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] text-[var(--foreground)] font-[family-name:var(--font-display)] text-xs"
              >
                MENU
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={backToMenu}
        className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] hover:text-[var(--foreground)] mt-1"
      >
        ← back to mode select
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatTime(sec: number): string {
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
