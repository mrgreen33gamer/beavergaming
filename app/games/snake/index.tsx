"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  Point, Direction, Mode, Food, Powerup, Wall, Particle, FloatingText, DeathStats, SnakeSettings,
} from "./types";
import {
  GRID, COLS, ROWS, WIDTH, HEIGHT,
  BASE_TICK_MS, MIN_TICK_MS,
  BONUS_LIFESPAN_MS, BONUS_SPAWN_CHANCE,
  BASE_FOOD_POINTS, BONUS_POINTS,
  POISON_SPAWN_CHANCE, POISON_LIFESPAN_MS, POISON_SEGMENTS_LOST,
  POISON_SCORE_PENALTY, POISON_MIN_SNAKE_LENGTH,
  POWERUP_SPAWN_CHANCE, POWERUP_LIFESPAN_MS,
  SLOW_DURATION_MS, SLOW_TICK_MULTIPLIER, GHOST_DURATION_MS,
  MULTI_DURATION_MS, MULTI_FACTOR, SHRINK_SEGMENTS,
  SPEED_DURATION_MS, SPEED_TICK_MULTIPLIER,
  COMBO_WINDOW_MS, COMBO_MAX,
  OBSTACLE_LIFESPAN_MS, OBSTACLE_MIN_SNAKE_LENGTH,
  OBSTACLE_MAX_ACTIVE, OBSTACLE_SPAWN_INTERVAL_MS,
  MODE_MULTIPLIER, MODE_DESCRIPTION, HIGHSCORE_KEY,
  SPEED_TRAIL_MIN_LENGTH, SPEED_TRAIL_MAX,
  DIFFICULTY_RAMP,
} from "./constants";
import { dirVec, opposite, buildMazeWalls } from "./mazes";
import {
  getId, resetIdCounter, randomEmptyCell, spawnFood, spawnPoisonFood, spawnPowerup,
} from "./helpers";
import {
  drawBackground, drawWalls, drawFood, drawBonusFood, drawPoisonFood,
  drawPowerup, drawSnake, drawSpeedTrail, drawParticles, drawFloatingTexts,
} from "./drawing";
import {
  initAudio, setMuted as setAudioMuted,
  playEat, playBonusEat, playPoison, playDeath,
  playPowerUp, playComboUp, playSpeedBoost, playTick,
} from "./sound";

const DEFAULT_DEATH: DeathStats = {
  score: 0, length: 0, foodEaten: 0, maxCombo: 0,
  powerupsUsed: 0, timeAliveSec: 0, mode: "classic",
};

const DEFAULT_SETTINGS: SnakeSettings = { sound: true, particles: true };

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(3);
  const [combo, setCombo] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [deathStats, setDeathStats] = useState<DeathStats>(DEFAULT_DEATH);
  const [highScores, setHighScores] = useState<Record<Mode, number>>({
    classic: 0, wrap: 0, maze: 0,
  });
  const [slowMs, setSlowMs] = useState(0);
  const [ghostMs, setGhostMs] = useState(0);
  const [multiMs, setMultiMs] = useState(0);
  const [speedMs, setSpeedMs] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettingsState] = useState<SnakeSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS);

  // Load settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem("snake-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        settingsRef.current = merged;
        setSettingsState(merged);
        if (!merged.sound) setAudioMuted(true);
      }
    } catch { /* ignore */ }
  }, []);

  const updateSetting = <K extends keyof SnakeSettings>(key: K, value: SnakeSettings[K]) => {
    setSettingsState(prev => {
      const next = { ...prev, [key]: value };
      settingsRef.current = next;
      localStorage.setItem("snake-settings", JSON.stringify(next));
      if (key === "sound") setAudioMuted(!value);
      return next;
    });
  };

  const stateRef = useRef({
    mode: "classic" as Mode,
    snake: [{ x: 15, y: 10 }] as Point[],
    direction: "right" as Direction,
    nextDirection: "right" as Direction,
    food: { x: 20, y: 10, kind: "normal" } as Food,
    bonusFood: null as Food | null,
    poisonFood: null as Food | null,
    powerup: null as Powerup | null,
    walls: [] as Wall[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    speedTrail: [] as Point[],
    running: false,
    paused: false,
    lastTick: 0,
    tickMs: BASE_TICK_MS,
    score: 0,
    slowUntil: 0,
    ghostUntil: 0,
    multiUntil: 0,
    speedUntil: 0,
    combo: 1,
    lastFoodAt: 0,
    maxCombo: 1,
    foodEaten: 0,
    powerupsUsed: 0,
    startedAt: 0,
    tongueAt: 0,
    lastObstacleSpawnAt: 0,
    lastHudSyncFrame: 0,
    tickCount: 0,
  });

  // Load high scores
  useEffect(() => {
    const hs: Record<Mode, number> = { classic: 0, wrap: 0, maze: 0 };
    (Object.keys(HIGHSCORE_KEY) as Mode[]).forEach((m) => {
      const v = localStorage.getItem(HIGHSCORE_KEY[m]);
      if (v) hs[m] = parseInt(v, 10);
    });
    setHighScores(hs);
  }, []);

  const startGame = useCallback((m: Mode) => {
    resetIdCounter();
    initAudio();
    const s = stateRef.current;
    const initialSnake: Point[] = [
      { x: 15, y: 10 },
      { x: 14, y: 10 },
      { x: 13, y: 10 },
    ];
    s.mode = m;
    s.snake = initialSnake;
    s.direction = "right";
    s.nextDirection = "right";
    s.walls = m === "maze" ? buildMazeWalls() : [];
    const initFood = spawnFood(initialSnake, s.walls);
    s.food = initFood ?? { x: 20, y: 10, kind: "normal" };
    s.bonusFood = null;
    s.poisonFood = null;
    s.powerup = null;
    s.particles = [];
    s.floatingTexts = [];
    s.speedTrail = [];
    s.running = true;
    s.paused = false;
    s.lastTick = Date.now();
    s.tickMs = BASE_TICK_MS;
    s.score = 0;
    s.slowUntil = 0;
    s.ghostUntil = 0;
    s.multiUntil = 0;
    s.speedUntil = 0;
    s.combo = 1;
    s.lastFoodAt = 0;
    s.maxCombo = 1;
    s.foodEaten = 0;
    s.powerupsUsed = 0;
    s.startedAt = Date.now();
    s.tongueAt = 0;
    s.lastObstacleSpawnAt = Date.now();
    s.lastHudSyncFrame = 0;
    s.tickCount = 0;

    setMode(m);
    setScore(0);
    setLength(initialSnake.length);
    setCombo(1);
    setGameOver(false);
    setPaused(false);
    setSlowMs(0);
    setGhostMs(0);
    setMultiMs(0);
    setSpeedMs(0);
  }, []);

  const backToMenu = () => {
    stateRef.current.running = false;
    stateRef.current.paused = false;
    setMode(null);
    setGameOver(false);
    setPaused(false);
  };

  // Compute current tick rate: length + time ramp + effects
  const computeTickMs = (snakeLen: number, slowActive: boolean, speedActive: boolean, elapsed: number, gameMode: Mode) => {
    const timeRamp = elapsed * DIFFICULTY_RAMP[gameMode];
    const base = Math.max(MIN_TICK_MS, BASE_TICK_MS - snakeLen * 1.4 - timeRamp);
    if (slowActive) return base * SLOW_TICK_MULTIPLIER;
    if (speedActive) return base * SPEED_TICK_MULTIPLIER;
    return base;
  };

  // ===== Tick game state =====
  const tickGame = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.paused) return;
    const now = Date.now();

    if (s.nextDirection !== opposite[s.direction]) {
      s.direction = s.nextDirection;
    }
    const head = s.snake[0];
    const v = dirVec[s.direction];
    let newHead: Point = { x: head.x + v.x, y: head.y + v.y };

    const ghostActive = s.ghostUntil > now;

    // Wall behavior
    if (s.mode === "wrap") {
      if (newHead.x < 0) newHead.x = COLS - 1;
      else if (newHead.x >= COLS) newHead.x = 0;
      if (newHead.y < 0) newHead.y = ROWS - 1;
      else if (newHead.y >= ROWS) newHead.y = 0;
    } else {
      const oob = newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS;
      if (oob) {
        if (ghostActive) {
          if (newHead.x < 0) newHead.x = COLS - 1;
          else if (newHead.x >= COLS) newHead.x = 0;
          if (newHead.y < 0) newHead.y = ROWS - 1;
          else if (newHead.y >= ROWS) newHead.y = 0;
        } else {
          die(s);
          return;
        }
      }
    }

    // Wall collision
    if (!ghostActive) {
      for (const w of s.walls) {
        if (w.x === newHead.x && w.y === newHead.y) { die(s); return; }
      }
    }

    // Self collision
    if (!ghostActive) {
      for (const seg of s.snake) {
        if (seg.x === newHead.x && seg.y === newHead.y) { die(s); return; }
      }
    }

    s.snake.unshift(newHead);
    let ate = false;

    // Poison food
    if (s.poisonFood && newHead.x === s.poisonFood.x && newHead.y === s.poisonFood.y) {
      consumePoison(s, newHead.x, newHead.y);
      s.poisonFood = null;
      ate = false; // poison doesn't grow
      s.snake.pop(); // still pop since we unshifted
    }

    // Bonus food
    if (s.bonusFood && newHead.x === s.bonusFood.x && newHead.y === s.bonusFood.y) {
      consumeFood(s, "bonus", newHead.x, newHead.y);
      s.bonusFood = null;
      ate = true;
    }

    // Regular food
    if (!ate && newHead.x === s.food.x && newHead.y === s.food.y) {
      consumeFood(s, "normal", newHead.x, newHead.y);
      const next = spawnFood(s.snake, s.walls, [s.bonusFood, s.poisonFood, s.powerup]);
      if (next) s.food = next;
      // Maybe spawn bonus
      if (!s.bonusFood && Math.random() < BONUS_SPAWN_CHANCE) {
        const bf = spawnFood(s.snake, s.walls, [s.food, s.poisonFood, s.powerup]);
        if (bf) s.bonusFood = { ...bf, kind: "bonus", spawnedAt: Date.now() };
      }
      // Maybe spawn poison
      if (!s.poisonFood && s.snake.length >= POISON_MIN_SNAKE_LENGTH && Math.random() < POISON_SPAWN_CHANCE) {
        const pf = spawnPoisonFood(s.snake, s.walls, [s.food, s.bonusFood, s.powerup]);
        if (pf) s.poisonFood = pf;
      }
      // Maybe spawn power-up
      if (!s.powerup && Math.random() < POWERUP_SPAWN_CHANCE) {
        const pu = spawnPowerup(s.snake, s.walls, [s.food, s.bonusFood, s.poisonFood]);
        if (pu) s.powerup = pu;
      }
      ate = true;
    }

    // Power-up pickup
    if (s.powerup && newHead.x === s.powerup.x && newHead.y === s.powerup.y) {
      applyPowerup(s, s.powerup, now);
      s.powerup = null;
    }

    if (!ate) s.snake.pop();

    // Expire old items
    if (s.bonusFood && s.bonusFood.spawnedAt && now - s.bonusFood.spawnedAt > BONUS_LIFESPAN_MS) {
      s.bonusFood = null;
    }
    if (s.poisonFood && s.poisonFood.spawnedAt && now - s.poisonFood.spawnedAt > POISON_LIFESPAN_MS) {
      s.poisonFood = null;
    }
    if (s.powerup && now - s.powerup.spawnedAt > POWERUP_LIFESPAN_MS) {
      s.powerup = null;
    }

    // Expire obstacles
    {
      let w = 0;
      for (let i = 0; i < s.walls.length; i++) {
        const wl = s.walls[i];
        if (wl.expiresAt !== null && now > wl.expiresAt) continue;
        if (w !== i) s.walls[w] = wl;
        w++;
      }
      s.walls.length = w;
    }
    // Spawn obstacles (Classic)
    if (
      s.mode === "classic" &&
      s.snake.length >= OBSTACLE_MIN_SNAKE_LENGTH &&
      now - s.lastObstacleSpawnAt > OBSTACLE_SPAWN_INTERVAL_MS
    ) {
      const active = s.walls.filter((w) => w.expiresAt !== null).length;
      if (active < OBSTACLE_MAX_ACTIVE) {
        const pt = randomEmptyCell(s.snake, [...s.walls, s.food, s.bonusFood, s.poisonFood, s.powerup]);
        if (pt) {
          s.walls.push({ x: pt.x, y: pt.y, spawnedAt: now, expiresAt: now + OBSTACLE_LIFESPAN_MS });
          s.lastObstacleSpawnAt = now;
        }
      }
    }

    // Combo timeout
    if (s.combo > 1 && now - s.lastFoodAt > COMBO_WINDOW_MS) s.combo = 1;

    // Speed trail
    if (s.snake.length >= SPEED_TRAIL_MIN_LENGTH) {
      s.speedTrail.push({ x: newHead.x, y: newHead.y });
      if (s.speedTrail.length > SPEED_TRAIL_MAX) s.speedTrail.shift();
    } else if (s.speedTrail.length) {
      s.speedTrail.length = 0;
    }

    // Update tick rate with progressive difficulty
    const elapsed = (now - s.startedAt) / 1000;
    s.tickMs = computeTickMs(s.snake.length, s.slowUntil > now, s.speedUntil > now, elapsed, s.mode);
    s.tickCount++;

    // Movement tick sound (every 3 ticks)
    if (s.tickCount % 3 === 0) playTick();
  }, []);

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
      const s = stateRef.current;

      if (s.running && !s.paused && now - s.lastTick >= s.tickMs) {
        s.lastTick = now;
        tickGame();
      }

      // Particles
      if (settingsRef.current.particles) {
        let w = 0;
        for (let i = 0; i < s.particles.length; i++) {
          const p = s.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.life--;
          if (p.life > 0) { if (w !== i) s.particles[w] = p; w++; }
        }
        s.particles.length = w;
      }

      // Floating texts
      {
        let w = 0;
        for (let i = 0; i < s.floatingTexts.length; i++) {
          const ft = s.floatingTexts[i];
          ft.y += ft.vy;
          ft.vy *= 0.96;
          ft.life--;
          if (ft.life > 0) { if (w !== i) s.floatingTexts[w] = ft; w++; }
        }
        s.floatingTexts.length = w;
      }

      // ===== DRAW =====
      drawBackground(ctx, frame);
      drawWalls(ctx, s.walls, now);
      if (s.speedTrail.length) drawSpeedTrail(ctx, s.speedTrail);
      drawFood(ctx, s.food, frame);
      if (s.bonusFood) drawBonusFood(ctx, s.bonusFood, frame, now);
      if (s.poisonFood) drawPoisonFood(ctx, s.poisonFood, frame, now);
      if (s.powerup) drawPowerup(ctx, s.powerup, frame, now);
      drawSnake(ctx, s.snake, s.direction, frame, s.ghostUntil > now, s.tongueAt, now, s.running);
      if (settingsRef.current.particles) drawParticles(ctx, s.particles);
      drawFloatingTexts(ctx, s.floatingTexts);

      // Speed boost overlay
      if (s.speedUntil > now) {
        ctx.fillStyle = "rgba(80, 200, 255, 0.08)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      // Pause overlay
      if (s.paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#7fd650";
        ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2 - 10);
        ctx.font = "16px monospace";
        ctx.fillStyle = "#b8a088";
        ctx.fillText("Press P or ESC to resume", WIDTH / 2, HEIGHT / 2 + 20);
        ctx.textAlign = "start";
      }

      // HUD sync
      if (s.running && frame - s.lastHudSyncFrame >= 4) {
        s.lastHudSyncFrame = frame;
        setScore(s.score);
        setLength(s.snake.length);
        setCombo(s.combo);
        setSlowMs(s.slowUntil > now ? s.slowUntil - now : 0);
        setGhostMs(s.ghostUntil > now ? s.ghostUntil - now : 0);
        setMultiMs(s.multiUntil > now ? s.multiUntil - now : 0);
        setSpeedMs(s.speedUntil > now ? s.speedUntil - now : 0);
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [tickGame, mode]);

  // ===== Eat food =====
  const consumeFood = (
    s: typeof stateRef.current,
    kind: "normal" | "bonus",
    fx: number, fy: number
  ) => {
    const now = Date.now();
    if (s.lastFoodAt > 0 && now - s.lastFoodAt < COMBO_WINDOW_MS) {
      s.combo = Math.min(s.combo + 1, COMBO_MAX);
      if (s.combo >= 3) playComboUp();
    } else {
      s.combo = 1;
    }
    s.lastFoodAt = now;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;

    const base = kind === "bonus" ? BONUS_POINTS : BASE_FOOD_POINTS;
    const modeMult = MODE_MULTIPLIER[s.mode];
    const xMult = s.multiUntil > now ? MULTI_FACTOR : 1;
    const points = Math.floor(base * s.combo * modeMult * xMult);
    s.score += points;
    s.foodEaten += 1;

    const cx = fx * GRID + GRID / 2;
    const cy = fy * GRID + GRID / 2;
    const color = kind === "bonus" ? "#ffd060" : "#d63d3d";
    if (settingsRef.current.particles) {
      const count = kind === "bonus" ? 16 : 10;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        s.particles.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 22, maxLife: 22, color: i % 2 === 0 ? color : "#ff8a3d", size: 3,
        });
      }
    }
    s.floatingTexts.push({
      id: getId(), x: cx, y: cy - 10,
      text: s.combo > 1 ? `+${points} ${s.combo}×` : `+${points}`,
      color: kind === "bonus" ? "#ffd060" : (s.combo >= 3 ? "#ff8a3d" : "#7fd650"),
      life: 36, maxLife: 36, vy: -1.2,
      scale: s.combo >= 5 ? 1.4 : 1.0,
    });
    s.tongueAt = now;
    if (kind === "bonus") playBonusEat(); else playEat();
  };

  // ===== Eat poison =====
  const consumePoison = (s: typeof stateRef.current, fx: number, fy: number) => {
    const cx = fx * GRID + GRID / 2;
    const cy = fy * GRID + GRID / 2;
    // Lose segments
    const drop = Math.min(POISON_SEGMENTS_LOST, s.snake.length - 1);
    for (let i = 0; i < drop; i++) {
      const tail = s.snake.pop();
      if (tail && settingsRef.current.particles) {
        for (let k = 0; k < 3; k++) {
          s.particles.push({
            x: tail.x * GRID + GRID / 2, y: tail.y * GRID + GRID / 2,
            vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
            life: 24, maxLife: 24, color: "#9040c0", size: 3,
          });
        }
      }
    }
    // Score penalty
    s.score = Math.max(0, s.score - POISON_SCORE_PENALTY);
    // Reset combo
    s.combo = 1;
    s.floatingTexts.push({
      id: getId(), x: cx, y: cy - 10,
      text: `POISON! -${POISON_SCORE_PENALTY}`,
      color: "#9040c0", life: 50, maxLife: 50, vy: -1.4, scale: 1.2,
    });
    // Purple burst
    if (settingsRef.current.particles) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        s.particles.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 28, maxLife: 28, color: i % 2 === 0 ? "#9040c0" : "#d0b0e0", size: 3,
        });
      }
    }
    playPoison();
  };

  // ===== Apply power-up =====
  const applyPowerup = (s: typeof stateRef.current, pu: Powerup, now: number) => {
    s.powerupsUsed += 1;
    const cx = pu.x * GRID + GRID / 2;
    const cy = pu.y * GRID + GRID / 2;
    const color =
      pu.type === "slow" ? "#8c6edc" :
      pu.type === "ghost" ? "#ffffff" :
      pu.type === "shrink" ? "#ff8a3d" :
      pu.type === "speed" ? "#50c8ff" :
      "#ffd060";
    if (settingsRef.current.particles) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3.5;
        s.particles.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 28, maxLife: 28, color, size: 3,
        });
      }
    }
    const labelText =
      pu.type === "slow" ? "SLOW" :
      pu.type === "ghost" ? "GHOST" :
      pu.type === "shrink" ? "SHRINK!" :
      pu.type === "speed" ? "SPEED!" :
      "×2 SCORE";
    s.floatingTexts.push({
      id: getId(), x: cx, y: cy - 12,
      text: labelText, color, life: 50, maxLife: 50, vy: -1.2, scale: 1.2,
    });

    if (pu.type === "slow") {
      s.slowUntil = now + SLOW_DURATION_MS;
    } else if (pu.type === "ghost") {
      s.ghostUntil = now + GHOST_DURATION_MS;
    } else if (pu.type === "multi") {
      s.multiUntil = now + MULTI_DURATION_MS;
    } else if (pu.type === "speed") {
      s.speedUntil = now + SPEED_DURATION_MS;
      playSpeedBoost();
      return;
    } else if (pu.type === "shrink") {
      const drop = Math.min(SHRINK_SEGMENTS, s.snake.length - 1);
      for (let i = 0; i < drop; i++) {
        const tail = s.snake.pop();
        if (tail && settingsRef.current.particles) {
          for (let k = 0; k < 3; k++) {
            s.particles.push({
              x: tail.x * GRID + GRID / 2, y: tail.y * GRID + GRID / 2,
              vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
              life: 24, maxLife: 24, color: "#ff8a3d", size: 3,
            });
          }
        }
      }
    }
    playPowerUp();
  };

  // ===== Die =====
  const die = (s: typeof stateRef.current) => {
    s.running = false;
    if (settingsRef.current.particles) {
      for (const seg of s.snake) {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 1 + Math.random() * 3;
          s.particles.push({
            x: seg.x * GRID + GRID / 2, y: seg.y * GRID + GRID / 2,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 40, maxLife: 40,
            color: i % 2 === 0 ? "#7fd650" : "#5fb030", size: 4,
          });
        }
      }
    }
    playDeath();
    const elapsed = (Date.now() - s.startedAt) / 1000;
    const stats: DeathStats = {
      score: s.score, length: s.snake.length, foodEaten: s.foodEaten,
      maxCombo: s.maxCombo, powerupsUsed: s.powerupsUsed,
      timeAliveSec: elapsed, mode: s.mode,
    };
    setDeathStats(stats);
    setGameOver(true);
    const stored = parseInt(localStorage.getItem(HIGHSCORE_KEY[s.mode]) || "0", 10);
    if (s.score > stored) {
      localStorage.setItem(HIGHSCORE_KEY[s.mode], String(s.score));
      setHighScores((prev) => ({ ...prev, [s.mode]: s.score }));
    }
  };

  // ===== Keyboard input =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Pause
      if ((key === "p" || e.code === "Escape") && mode && !gameOver) {
        e.preventDefault();
        const next = !stateRef.current.paused;
        stateRef.current.paused = next;
        setPaused(next);
        return;
      }

      const dirMap: Record<string, Direction> = {
        arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      if (key in dirMap) {
        e.preventDefault();
        if (!mode || gameOver || stateRef.current.paused) return;
        stateRef.current.nextDirection = dirMap[key];
      } else if (key === " " || key === "enter") {
        e.preventDefault();
        if (gameOver && mode) startGame(mode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, gameOver, startGame]);

  // Touch controls
  const setDir = (d: Direction) => {
    if (stateRef.current.paused) return;
    stateRef.current.nextDirection = d;
  };

  // ===== Mode select =====
  if (!mode) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">
          CHOOSE A MODE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {(["classic", "wrap", "maze"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => startGame(m)}
              className="pixel-edge px-5 py-4 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] text-left min-w-[200px]"
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
              <div className="font-[family-name:var(--font-mono)] text-sm text-[var(--accent-hot)] mt-1">
                ×{MODE_MULTIPLIER[m]} score
              </div>
            </button>
          ))}
        </div>
        <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mt-2 text-center max-w-md">
          Chain food fast for combos. Grab power-ups and avoid poison skulls.
          Speed ramps up the longer you survive.
        </p>
      </div>
    );
  }

  // ===== Game render =====
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-xl flex-wrap gap-2">
        <span>
          <span className="text-[var(--muted)]">SCORE </span>
          <span className="text-[var(--crt-green)]">{String(score).padStart(4, "0")}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">LEN </span>
          <span className="text-[var(--foreground)]">{length}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">MODE </span>
          <span className="text-[var(--foreground)] uppercase">{mode}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">BEST </span>
          <span className="text-[var(--accent)]">{highScores[mode] || 0}</span>
        </span>
      </div>

      {/* Combo + active power-ups */}
      <div className="flex flex-wrap gap-2 items-center justify-center min-h-[28px] font-[family-name:var(--font-mono)] text-base">
        {combo >= 2 && (
          <span className="px-2 py-0.5 rounded bg-[var(--accent-hot)]/30 text-[var(--accent-hot)] flicker">
            {combo}× COMBO
          </span>
        )}
        {slowMs > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#8c6edc22] text-[#c0a8f8]">
            ⌛ SLOW {Math.ceil(slowMs / 1000)}s
          </span>
        )}
        {ghostMs > 0 && (
          <span className="px-2 py-0.5 rounded bg-white/15 text-white">
            👻 GHOST {Math.ceil(ghostMs / 1000)}s
          </span>
        )}
        {multiMs > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#ffd06022] text-[#ffd060]">
            ×2 SCORE {Math.ceil(multiMs / 1000)}s
          </span>
        )}
        {speedMs > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#50c8ff22] text-[#50c8ff]">
            ⚡ SPEED {Math.ceil(speedMs / 1000)}s
          </span>
        )}
      </div>

      <div
        className="relative w-full max-w-[600px]"
        style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)]"
        />

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--crt-green)] mb-3">
              GAME OVER
            </h2>
            <div className="font-[family-name:var(--font-mono)] text-base text-[var(--foreground)] mb-3 min-w-[260px]">
              <Row label="MODE" value={mode.toUpperCase()} />
              <Row label="LENGTH" value={`${deathStats.length} segments`} />
              <Row label="FOOD" value={`${deathStats.foodEaten} eaten`} />
              <Row label="MAX COMBO" value={`${deathStats.maxCombo}×`} />
              <Row label="POWER-UPS" value={`${deathStats.powerupsUsed} used`} />
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
                className="pixel-edge px-4 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
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
            <p className="mt-2 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">
              SPACE or ENTER to play again
            </p>
          </div>
        )}
      </div>

      {/* Mobile touch controls */}
      <div className="sm:hidden grid grid-cols-3 gap-2 mt-2">
        <div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)]" onClick={() => setDir("up")}>▲</button>
        <div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)]" onClick={() => setDir("left")}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)]" onClick={() => setDir("down")}>▼</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded font-[family-name:var(--font-mono)]" onClick={() => setDir("right")}>▶</button>
      </div>

      {/* Settings bar */}
      <div className="relative flex items-center gap-2 w-full max-w-[600px]">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)] hover:text-[var(--accent)] transition-colors px-1"
          title="Settings"
        >
          ⚙
        </button>
        <button
          onClick={() => updateSetting("sound", !settings.sound)}
          className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
        >
          {settings.sound ? "🔊" : "🔇"}
        </button>
        <button
          onClick={backToMenu}
          className="ml-auto font-[family-name:var(--font-mono)] text-base text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← menu
        </button>

        {settingsOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#1a0e0a] border-2 border-[var(--border)] rounded p-4 z-30 min-w-[220px] shadow-lg shadow-black/40">
            <div className="font-[family-name:var(--font-display)] text-xs text-[var(--accent)] mb-3">
              SETTINGS
            </div>
            {([
              { key: "sound" as const, label: "Sound", on: settings.sound },
              { key: "particles" as const, label: "Particles", on: settings.particles },
            ]).map(({ key, label, on }) => (
              <button
                key={key}
                onClick={() => updateSetting(key, !on)}
                className="flex items-center justify-between w-full py-1.5 font-[family-name:var(--font-mono)] text-base text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
              >
                <span>{label}</span>
                <span className={on ? "text-[#7fd650]" : "text-[#5a3828]"}>
                  {on ? "ON" : "OFF"}
                </span>
              </button>
            ))}
            <button
              onClick={() => setSettingsOpen(false)}
              className="mt-2 w-full text-center font-[family-name:var(--font-mono)] text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
            >
              ✕ close
            </button>
          </div>
        )}
      </div>
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
