"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  Obstacle, Pickup, Particle, Spark, Smoke, Mountain, RainDrop, Star,
  FloatingText, BiomeId, Difficulty, Asteroid, Jet, Bullet,
} from "./types";
import {
  WIDTH, HEIGHT, HELI_X, HELI_W, HELI_H,
  GRAVITY, LIFT, SCROLL_SPEED, SPEED_RAMP,
  OBSTACLE_WIDTH, OBSTACLE_SPACING,
  PICKUP_OFFSET_FROM_PILLAR, PICKUP_HITBOX,
  MAGNET_RADIUS, MAGNET_RADIUS_SQ, MAGNET_DURATION_MS,
  SLOWMO_DURATION_MS, SLOWMO_FACTOR, SHIELD_GRACE_MS,
  BLUE_GEM_POINTS, GREEN_GEM_POINTS, RED_GEM_POINTS, GOLD_GEM_POINTS,
  MAX_PARTICLES, SCRAPE_THRESHOLD, SCRAPE_COOLDOWN_MS,
  NEAR_MISS_POINTS, NEAR_MISS_COOLDOWN_MS,
  COMBO_TIMEOUT_MS,
  EASY_LIVES, EASY_GAP_BONUS, INVULN_AFTER_HIT_MS,
  HIGHSCORE_KEY,
  COIN_POINTS, COIN_PATCH_CHANCE, COIN_PATCH_SPACING, COIN_PATCH_OFFSET,
  SPACE_CLEAR_MS, SPACE_GAP_MIN, SPACE_GAP_MAX,
  ASTEROID_MIN_MS, ASTEROID_MAX_MS, JET_MIN_MS, JET_MAX_MS,
} from "./constants";
import { BIOMES, getBiomeIndex, pickObstacleType } from "./biomes";
import {
  addBurst, makeObstacle, makePickup, rollPickup,
  getId, resetIdCounter, getComboMultiplier,
  laserState, makeAsteroid, makeJet, makeBullet,
} from "./helpers";
import {
  drawBackground, drawStars, drawSun, drawRain, drawLightningFlash,
  drawMountains, drawObstacle, drawPickup, drawHeli, drawMagnetAura,
  drawSlowmoOverlay, drawSmoke, drawSparks, drawExplosion,
  drawAsteroid, drawJet, drawBullet, drawSpaceWarp, drawTornado,
} from "./drawing";
import {
  initAudio, setMuted as setAudioMuted,
  playGemCollect, playGoldGem, playGreenGem, playRedGem,
  playPowerUp, playCrash, playSawBuzz,
  playNearMiss, playBiomeTransition, playComboUp, playLifeLost,
  startRotor, stopRotor,
  setMusicForBiome, pauseMusic, resumeMusic, stopMusic,
} from "./sound";

const SPACE_IDX = BIOMES.findIndex((b) => b.id === "space");

export default function HelicopterGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [biomeBanner, setBiomeBanner] = useState<string | null>(null);
  const [gemsCollected, setGemsCollected] = useState(0);
  const [gemPoints, setGemPoints] = useState(0);
  const [bestBiomeId, setBestBiomeId] = useState<BiomeId>("cave");
  const [activeShield, setActiveShield] = useState(false);
  const [slowmoRemaining, setSlowmoRemaining] = useState(0);
  const [magnetRemaining, setMagnetRemaining] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [lives, setLives] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettingsState] = useState({
    sound: true,
    screenShake: true,
    weather: true,
    particles: true,
  });
  const settingsRef = useRef(settings);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("heli-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...settingsRef.current, ...parsed };
        settingsRef.current = merged;
        setSettingsState(merged);
        if (!merged.sound) setAudioMuted(true);
      }
    } catch { /* ignore parse errors */ }
    // Stop audio if the user navigates away from the game.
    return () => {
      stopMusic();
      stopRotor();
    };
  }, []);

  // Register the music service worker so once a track has played online, it
  // remains available offline on subsequent visits. No upfront preload — each
  // track streams when its biome arrives. Failures are silent (offline cache
  // simply unavailable on this device).
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
    }
  }, []);

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettingsState(prev => {
      const next = { ...prev, [key]: value };
      settingsRef.current = next;
      localStorage.setItem("heli-settings", JSON.stringify(next));
      if (key === "sound") setAudioMuted(!value);
      return next;
    });
  };

  const stateRef = useRef({
    // Heli
    y: HEIGHT / 2,
    vy: 0,
    holding: false,
    invulnUntil: 0,
    shieldActive: false,
    // World
    obstacles: [] as Obstacle[],
    pickups: [] as Pickup[],
    smoke: [] as Smoke[],
    particles: [] as Particle[],
    sparks: [] as Spark[],
    rain: [] as RainDrop[],
    stars: [] as Star[],
    farMountains: [] as Mountain[],
    nearMountains: [] as Mountain[],
    floatingTexts: [] as FloatingText[],
    // Space biome flyers
    asteroids: [] as Asteroid[],
    jets: [] as Jet[],
    bullets: [] as Bullet[],
    spaceClearUntil: 0,   // while now < this, no pillars spawn (open void)
    spaceEntered: false,  // guards one-time space intro
    nextAsteroidAt: 0,
    nextJetAt: 0,
    // Game state
    distance: 0,
    speed: SCROLL_SPEED,
    running: false,
    paused: false,
    shake: 0,
    score: 0,
    gemPoints: 0,
    gemsCollected: 0,
    // Effects
    slowMoUntil: 0,
    magnetUntil: 0,
    lightning: 0,
    nextLightningAt: 0,
    // Storm tornado parallax bg
    tornadoX: WIDTH * 0.7,
    tornadoPhase: 0,
    lastScrapeAt: 0,
    lastNearMissAt: 0,
    // Biome tracking
    biomeIdx: 0,
    bestBiomeIdx: 0,
    // Score sync throttle
    lastScoreSyncFrame: 0,
    // Difficulty & lives
    difficulty: "hard" as Difficulty,
    lives: 0,
    gapBonus: 0,
    // Combo
    comboCount: 0,
    comboMultiplier: 1,
    lastGemAt: 0,
    // Explosion animation
    explosionActive: false,
    explosionX: 0,
    explosionY: 0,
    explosionFrame: 0,
  });

  // Load high scores for current difficulty
  useEffect(() => {
    if (!difficulty) return;
    const saved = localStorage.getItem(HIGHSCORE_KEY[difficulty]);
    if (saved) setHighScore(parseInt(saved, 10));
    else setHighScore(0);
  }, [difficulty]);

  const rebuildStars = useCallback((biomeIdx: number) => {
    const biome = BIOMES[biomeIdx];
    const stars: Star[] = [];
    for (let i = 0; i < biome.starCount; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * (HEIGHT * 0.7),
        size: Math.random() < 0.2 ? 2 : 1,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    stateRef.current.stars = stars;
  }, []);

  const resetGame = useCallback((diff: Difficulty) => {
    resetIdCounter();
    initAudio();
    const gapBonus = diff === "easy" ? EASY_GAP_BONUS : 0;
    const far: Mountain[] = [];
    for (let i = 0; i < 12; i++) {
      far.push({ x: i * 90, height: 60 + Math.random() * 50 });
    }
    const near: Mountain[] = [];
    for (let i = 0; i < 10; i++) {
      near.push({ x: i * 110, height: 40 + Math.random() * 70 });
    }
    const obstacles: Obstacle[] = [];
    // Start obstacles well off-screen so the player has ~2s clear space to get ready
    const startOffset = WIDTH + 450;
    for (let i = 0; i < 5; i++) {
      obstacles.push(
        makeObstacle("static", startOffset + i * OBSTACLE_SPACING, HEIGHT / 2 + (i - 1) * 30, gapBonus)
      );
    }
    const startLives = diff === "easy" ? EASY_LIVES : 1;
    stateRef.current = {
      y: HEIGHT / 2,
      vy: 0,
      holding: false,
      invulnUntil: 0,
      shieldActive: false,
      obstacles,
      pickups: [],
      smoke: [],
      particles: [],
      sparks: [],
      rain: [],
      stars: [],
      farMountains: far,
      nearMountains: near,
      floatingTexts: [],
      asteroids: [],
      jets: [],
      bullets: [],
      spaceClearUntil: 0,
      spaceEntered: false,
      nextAsteroidAt: 0,
      nextJetAt: 0,
      distance: 0,
      speed: SCROLL_SPEED,
      running: true,
      paused: false,
      shake: 0,
      score: 0,
      gemPoints: 0,
      gemsCollected: 0,
      slowMoUntil: 0,
      magnetUntil: 0,
      lightning: 0,
      nextLightningAt: 0,
      tornadoX: WIDTH * (0.5 + Math.random() * 0.5),
      tornadoPhase: Math.random() * Math.PI * 2,
      lastScrapeAt: 0,
      lastNearMissAt: 0,
      biomeIdx: 0,
      bestBiomeIdx: 0,
      lastScoreSyncFrame: 0,
      difficulty: diff,
      lives: startLives,
      gapBonus,
      comboCount: 0,
      comboMultiplier: 1,
      lastGemAt: 0,
      explosionActive: false,
      explosionX: 0,
      explosionY: 0,
      explosionFrame: 0,
    };
    rebuildStars(0);
    setScore(0);
    setGemsCollected(0);
    setGemPoints(0);
    setBestBiomeId("cave");
    setActiveShield(false);
    setSlowmoRemaining(0);
    setMagnetRemaining(0);
    setDifficulty(diff);
    setLives(startLives);
    setComboCount(0);
    setComboMultiplier(1);
    setGameOver(false);
    setStarted(true);
    setPaused(false);
    setBiomeBanner(null);
    startRotor();
    setMusicForBiome(0);
  }, [rebuildStars]);

  const showBanner = (text: string, ms = 1800) => {
    setBiomeBanner(text);
    setTimeout(() => setBiomeBanner(null), ms);
  };

  // After a shield pop or a life loss, the heli is often still geometrically
  // inside the pillar/floor that triggered it. If we leave it there, the grace
  // period expires while still overlapping and the player takes an unfair
  // second hit. This nudges the heli into clear air (into the current gap,
  // off the floor/ceiling) and gives a small upward bounce so it recovers.
  const escapeToSafety = (s: typeof stateRef.current) => {
    for (const o of s.obstacles) {
      if (o.type === "sawblade" || o.type === "laser") continue;
      const xOverlap =
        HELI_X + HELI_W / 2 > o.x && HELI_X - HELI_W / 2 < o.x + OBSTACLE_WIDTH;
      if (!xOverlap) continue;
      const half = o.gap / 2;
      const topInner = o.gapY - half + HELI_H / 2 + 3;
      const botInner = o.gapY + half - HELI_H / 2 - 3;
      if (topInner <= botInner) {
        s.y = Math.max(topInner, Math.min(botInner, s.y));
      } else {
        s.y = o.gapY; // gap smaller than heli (shouldn't happen) — centre it
      }
      break;
    }
    const margin = HELI_H / 2 + 4;
    s.y = Math.max(margin, Math.min(HEIGHT - margin, s.y));
    s.vy = -2.5; // gentle lift so the player isn't immediately dragged back down
  };

  // Drop a 3x3 grid of spinning coins centred on a gap corridor.
  const spawnCoinPatch = (s: typeof stateRef.current, centerX: number, gapY: number) => {
    const sp = COIN_PATCH_SPACING;
    const cy = Math.max(60, Math.min(HEIGHT - 60, gapY));
    for (let row = -1; row <= 1; row++) {
      for (let col = 0; col < 3; col++) {
        const py = cy + row * sp;
        if (py < 28 || py > HEIGHT - 28) continue;
        s.pickups.push(makePickup("coin", centerX + col * sp, py));
      }
    }
  };

  // Spawn / move / despawn the deep-space flyers (asteroids, jets, bullets).
  const updateSpaceFlyers = (s: typeof stateRef.current, now: number) => {
    if (now >= s.nextAsteroidAt && s.asteroids.length < 5) {
      s.asteroids.push(makeAsteroid());
      s.nextAsteroidAt = now + ASTEROID_MIN_MS + Math.random() * (ASTEROID_MAX_MS - ASTEROID_MIN_MS);
    }
    if (now >= s.nextJetAt && s.jets.length < 2) {
      s.jets.push(makeJet(now));
      s.nextJetAt = now + JET_MIN_MS + Math.random() * (JET_MAX_MS - JET_MIN_MS);
    }

    // Asteroids
    let aw = 0;
    for (let i = 0; i < s.asteroids.length; i++) {
      const a = s.asteroids[i];
      a.x += a.vx; a.y += a.vy; a.angle += a.spin;
      if (a.y < a.r || a.y > HEIGHT - a.r) a.vy *= -1;
      if (a.x > -a.r * 2 - 10) { if (aw !== i) s.asteroids[aw] = a; aw++; }
    }
    s.asteroids.length = aw;

    // Jets (fire forward while on screen)
    let jw = 0;
    for (let i = 0; i < s.jets.length; i++) {
      const j = s.jets[i];
      j.x += j.vx; j.y += j.vy;
      if (j.y < 40 || j.y > HEIGHT - 40) j.vy *= -1;
      if (now >= j.fireAt && j.x > 40 && j.x < WIDTH + 20) {
        s.bullets.push(makeBullet(j.x - 18, j.y));
        j.fireAt = now + 750 + Math.random() * 500;
      }
      if (j.x > -50) { if (jw !== i) s.jets[jw] = j; jw++; }
    }
    s.jets.length = jw;

    // Bullets
    let bw = 0;
    for (let i = 0; i < s.bullets.length; i++) {
      const b = s.bullets[i];
      b.x += b.vx;
      if (b.x > -20) { if (bw !== i) s.bullets[bw] = b; bw++; }
    }
    s.bullets.length = bw;
  };

  // ===== Main game loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;

    const draw = () => {
      try {
        const s = stateRef.current;
        frame++;
        const now = Date.now();

        const slowMoActive = s.slowMoUntil > now;
        const magnetActive = s.magnetUntil > now;
      const timeScale = slowMoActive ? SLOWMO_FACTOR : 1;
      const currentBiome = BIOMES[s.biomeIdx];

      if (s.running && !s.paused) {
        // ---- Combo timeout check ----
        if (s.comboCount > 0 && now - s.lastGemAt > COMBO_TIMEOUT_MS) {
          s.comboCount = 0;
          s.comboMultiplier = 1;
          setComboCount(0);
          setComboMultiplier(1);
        }

        // ---- Heli physics ----
        s.vy += GRAVITY * timeScale;
        if (s.holding) s.vy += LIFT * timeScale;
        s.vy = Math.max(-8, Math.min(8, s.vy));
        s.y += s.vy * timeScale;

        // ---- World scroll ----
        const effSpeed = s.speed * timeScale;
        s.speed += SPEED_RAMP * timeScale;
        s.distance += effSpeed;

        const newScore = Math.floor(s.distance / 10);
        s.score = newScore + s.gemPoints;

        // Biome transition
        const newBiomeIdx = getBiomeIndex(newScore);
        if (newBiomeIdx > s.biomeIdx) {
          s.biomeIdx = newBiomeIdx;
          if (newBiomeIdx > s.bestBiomeIdx) {
            s.bestBiomeIdx = newBiomeIdx;
            setBestBiomeId(BIOMES[newBiomeIdx].id);
          }
          rebuildStars(newBiomeIdx);
          showBanner(BIOMES[newBiomeIdx].name, 1800);
          playBiomeTransition();
          setMusicForBiome(newBiomeIdx);

          // Entering deep space: clear all pillars for an open void, then
          // columns return later with wide "room" spacing alongside flyers.
          if (newBiomeIdx === SPACE_IDX && !s.spaceEntered) {
            s.spaceEntered = true;
            s.spaceClearUntil = now + SPACE_CLEAR_MS;
            s.obstacles.length = 0;
            // Drop any gems still sitting in the old pillar corridors
            s.pickups.length = 0;
            // Start flyers almost immediately so the void isn't empty
            s.nextAsteroidAt = now + 600;
            s.nextJetAt = now + 2600;
          }
        }

        // ---- Scroll obstacles ----
        for (const o of s.obstacles) {
          o.x -= effSpeed;
          if (o.type === "moving") {
            o.movePhase += 0.025 * timeScale;
            o.gapY = o.baseGapY + Math.sin(o.movePhase) * 50;
            const half = o.gap / 2;
            if (o.gapY < 80 + half) o.gapY = 80 + half;
            if (o.gapY > HEIGHT - 80 - half) o.gapY = HEIGHT - 80 - half;
          }
          if (o.type === "sawblade") {
            o.sawAngle += 0.18 * timeScale;
            // Extend/retract: oscillate sawY around its base position
            o.movePhase += 0.02 * timeScale;
            const amplitude = 55;
            o.sawY = o.baseGapY + Math.sin(o.movePhase) * amplitude;
            // Clamp to original side so pole never flips ceiling↔floor
            const mid = HEIGHT / 2;
            if (o.baseGapY < mid) {
              o.sawY = Math.max(40, Math.min(mid - 30, o.sawY));
            } else {
              o.sawY = Math.max(mid + 30, Math.min(HEIGHT - 40, o.sawY));
            }
            // Buzz when heli is nearby
            if (Math.abs(o.x + OBSTACLE_WIDTH / 2 - HELI_X) < 180 && frame % 30 === 0) {
              playSawBuzz();
            }
          }
          if (o.type === "laser") {
            // Advance the cycle (frames). Buzz briefly as either beam fires.
            const prev = laserState(o.movePhase);
            o.movePhase += timeScale;
            const next = laserState(o.movePhase);
            const becameLive =
              (next === "top_on" && prev !== "top_on") ||
              (next === "bot_on" && prev !== "bot_on");
            if (becameLive && Math.abs(o.x + OBSTACLE_WIDTH / 2 - HELI_X) < 220) {
              playSawBuzz();
            }
          }
        }
        // ---- Recycle off-screen pillars (all biomes) ----
        if (s.obstacles[0] && s.obstacles[0].x + OBSTACLE_WIDTH < 0) {
          s.obstacles.shift();
          // Space uses its own room spawner below; other biomes chain here.
          if (currentBiome.id !== "space" && s.obstacles.length > 0) {
            const lastX = s.obstacles[s.obstacles.length - 1].x;
            const nextX = lastX + OBSTACLE_SPACING;
            const type = pickObstacleType(currentBiome.id);
            // Clamp gapY so consecutive pillars don't require impossible swings
            const prevGapY = s.obstacles[s.obstacles.length - 1].gapY;
            const maxDelta = 110;
            const minGapY = Math.max(90, prevGapY - maxDelta);
            const maxGapY = Math.min(HEIGHT - 90, prevGapY + maxDelta);
            const gapY = minGapY + Math.random() * (maxGapY - minGapY);
            s.obstacles.push(makeObstacle(type, nextX, gapY, s.gapBonus));

            const pickupType = rollPickup();
            if (pickupType) {
              let py: number;
              if (Math.random() < 0.25) {
                const edgeOffset = (Math.random() < 0.5 ? -1 : 1) * 30;
                py = gapY + edgeOffset;
              } else {
                py = gapY + (Math.random() - 0.5) * 30;
              }
              py = Math.max(60, Math.min(HEIGHT - 60, py));
              s.pickups.push(makePickup(pickupType, nextX + PICKUP_OFFSET_FROM_PILLAR, py));
            } else if (type === "static" && Math.random() < COIN_PATCH_CHANCE) {
              // 3x3 spinning-coin patch tucked in the corridor past a still pillar
              spawnCoinPatch(s, nextX + COIN_PATCH_OFFSET, gapY);
            }
          }
        }

        // ---- Space: open-room pillar spawner (after the clearing void) ----
        if (currentBiome.id === "space" && now >= s.spaceClearUntil) {
          const last = s.obstacles[s.obstacles.length - 1];
          const roomGap = SPACE_GAP_MIN + Math.random() * (SPACE_GAP_MAX - SPACE_GAP_MIN);
          if (!last || last.x < WIDTH - roomGap) {
            const spawnX = last ? last.x + roomGap : WIDTH + 120;
            const type = pickObstacleType("space");
            const prevGapY = last ? last.gapY : HEIGHT / 2;
            const maxDelta = 130;
            const minGapY = Math.max(90, prevGapY - maxDelta);
            const maxGapY = Math.min(HEIGHT - 90, prevGapY + maxDelta);
            const gapY = minGapY + Math.random() * (maxGapY - minGapY);
            // Roomier gaps in space
            const o = makeObstacle(type, spawnX, gapY, s.gapBonus + 24);
            s.obstacles.push(o);

            const pickupType = rollPickup();
            if (pickupType) {
              const py = Math.max(60, Math.min(HEIGHT - 60, gapY + (Math.random() - 0.5) * 40));
              s.pickups.push(makePickup(pickupType, spawnX + PICKUP_OFFSET_FROM_PILLAR, py));
            } else if (Math.random() < COIN_PATCH_CHANCE * 0.8) {
              spawnCoinPatch(s, spawnX + COIN_PATCH_OFFSET, gapY);
            }
          }
        }

        // ---- Space flyers: spawn, move, despawn ----
        if (currentBiome.id === "space") {
          updateSpaceFlyers(s, now);
        }

        // ---- Scroll pickups (and magnet-pull) ----
        {
          let w = 0;
          for (let i = 0; i < s.pickups.length; i++) {
            const p = s.pickups[i];
            p.x -= effSpeed;
            p.spin += 0.04 * timeScale;
            p.bob += 0.08 * timeScale;

            if (magnetActive) {
              const dx = HELI_X - p.x;
              const dy = s.y - p.y;
              const dSq = dx * dx + dy * dy;
              if (dSq < MAGNET_RADIUS_SQ && dSq > 4) {
                const d = Math.sqrt(dSq);
                const strength = (1 - d / MAGNET_RADIUS) * 6;
                p.x += (dx / d) * strength;
                p.y += (dy / d) * strength;
              }
            }

            const dx = HELI_X - p.x;
            const dy = s.y - p.y;
            if (dx * dx + dy * dy < PICKUP_HITBOX * PICKUP_HITBOX) {
              collectPickup(s, p, now);
              continue;
            }
            if (p.x < -40) continue;
            if (w !== i) s.pickups[w] = p;
            w++;
          }
          s.pickups.length = w;
        }

        // ---- Scroll mountains ----
        for (const m of s.farMountains) m.x -= effSpeed * 0.2;
        for (const m of s.nearMountains) m.x -= effSpeed * 0.5;
        for (const m of s.farMountains) {
          if (m.x + 100 < 0) {
            let maxX = 0;
            for (const mm of s.farMountains) if (mm.x > maxX) maxX = mm.x;
            m.x = maxX + 90;
            m.height = 60 + Math.random() * 50;
          }
        }
        for (const m of s.nearMountains) {
          if (m.x + 120 < 0) {
            let maxX = 0;
            for (const mm of s.nearMountains) if (mm.x > maxX) maxX = mm.x;
            m.x = maxX + 110;
            m.height = 40 + Math.random() * 70;
          }
        }

        // ---- Emit smoke (respects particles setting) ----
        if (settingsRef.current.particles && frame % 2 === 0 && s.particles.length < MAX_PARTICLES) {
          s.smoke.push({
            x: HELI_X - 16,
            y: s.y + 4,
            life: 30, maxLife: 30,
            size: 4 + Math.random() * 4,
          });
        }
        {
          let w = 0;
          for (let i = 0; i < s.smoke.length; i++) {
            const sm = s.smoke[i];
            sm.x -= 1.5 * timeScale;
            sm.y -= 0.3 * timeScale;
            sm.life--;
            if (sm.life > 0) {
              if (w !== i) s.smoke[w] = sm;
              w++;
            }
          }
          s.smoke.length = w;
        }

        // ---- Rain (storm biome, respects weather setting) ----
        const weatherOn = settingsRef.current.weather;
        if (currentBiome.hasRain && weatherOn) {
          if (s.rain.length < 60) {
            for (let i = 0; i < 3; i++) {
              s.rain.push({
                x: Math.random() * (WIDTH + 80),
                y: Math.random() * -100,
                speed: 7 + Math.random() * 4,
                length: 6 + Math.random() * 4,
              });
            }
          }
          let w = 0;
          for (let i = 0; i < s.rain.length; i++) {
            const r = s.rain[i];
            r.x -= 2 * timeScale;
            r.y += r.speed * timeScale;
            if (r.y < HEIGHT + 20 && r.x > -20) {
              if (w !== i) s.rain[w] = r;
              w++;
            }
          }
          s.rain.length = w;
        } else if (s.rain.length) {
          s.rain.length = 0;
        }

        // ---- Tornado parallax (storm biome) ----
        // Scrolls slower than the near mountains so it sits in the deep
        // background. Respawns off the right when it leaves the left edge.
        if (currentBiome.id === "storm") {
          s.tornadoX -= effSpeed * 0.18;
          if (s.tornadoX < -120) {
            s.tornadoX = WIDTH + 120 + Math.random() * 200;
            s.tornadoPhase = Math.random() * Math.PI * 2;
          }
        }

        // ---- Lightning (storm biome) ----
        if (currentBiome.hasLightning && weatherOn) {
          if (s.nextLightningAt === 0) s.nextLightningAt = now + 3000 + Math.random() * 4000;
          if (now >= s.nextLightningAt) {
            s.lightning = 1;
            s.nextLightningAt = now + 3000 + Math.random() * 4000;
          }
        }
        if (s.lightning > 0) s.lightning = Math.max(0, s.lightning - 0.06);

        // ---- Sparks ----
        {
          let w = 0;
          for (let i = 0; i < s.sparks.length; i++) {
            const sp = s.sparks[i];
            sp.x += sp.vx * timeScale;
            sp.y += sp.vy * timeScale;
            sp.vy += 0.2 * timeScale;
            sp.life--;
            if (sp.life > 0) {
              if (w !== i) s.sparks[w] = sp;
              w++;
            }
          }
          s.sparks.length = w;
        }

        // ---- Collisions ----
        let crashed = false;

        if (s.y < HELI_H / 2 || s.y > HEIGHT - HELI_H / 2) crashed = true;

        if (!crashed) {
          for (const o of s.obstacles) {
            if (o.type === "sawblade") {
              const cx = o.x + OBSTACLE_WIDTH / 2;
              const dx = HELI_X - cx;
              const dy = s.y - o.sawY;
              if (dx * dx + dy * dy < 33 * 33) {
                crashed = true;
                break;
              }
              continue;
            }
            if (o.type === "laser") {
              // Only the firing HALF of the gap is deadly. The other half is
              // always safe to fly through. The pillars themselves still
              // collide via the generic logic below.
              const lx = HELI_X + HELI_W / 2 > o.x && HELI_X - HELI_W / 2 < o.x + OBSTACLE_WIDTH;
              if (lx) {
                const ls = laserState(o.movePhase);
                const heliCY = s.y;
                const halfGap = o.gap / 2;
                const gapTop = o.gapY - halfGap;
                const gapBot = o.gapY + halfGap;
                const mid = o.gapY;
                if (ls === "top_on" && heliCY < mid && heliCY > gapTop) {
                  crashed = true;
                  break;
                }
                if (ls === "bot_on" && heliCY > mid && heliCY < gapBot) {
                  crashed = true;
                  break;
                }
              }
            }
            const xOverlap = HELI_X + HELI_W / 2 > o.x && HELI_X - HELI_W / 2 < o.x + OBSTACLE_WIDTH;
            if (!xOverlap) continue;
            const half = o.gap / 2;
            const topEdge = o.gapY - half;
            const botEdge = o.gapY + half;
            const heliTop = s.y - HELI_H / 2;
            const heliBot = s.y + HELI_H / 2;
            if (heliTop < topEdge || heliBot > botEdge) {
              crashed = true;
              break;
            }
            // Wall scrape → near-miss bonus
            const topGap = heliTop - topEdge;
            const botGap = botEdge - heliBot;
            if ((topGap < SCRAPE_THRESHOLD || botGap < SCRAPE_THRESHOLD) &&
                now - s.lastScrapeAt > SCRAPE_COOLDOWN_MS) {
              s.lastScrapeAt = now;
              const sparkY = topGap < SCRAPE_THRESHOLD ? topEdge : botEdge;
              for (let k = 0; k < 4; k++) {
                if (s.sparks.length > 60) break;
                s.sparks.push({
                  x: HELI_X + HELI_W / 2 - 2 + Math.random() * 4,
                  y: sparkY,
                  vx: -1 - Math.random() * 2,
                  vy: (Math.random() - 0.5) * 3,
                  life: 14, maxLife: 14,
                });
              }
              // Near-miss bonus scoring (skip during invulnerability)
              if (now - s.lastNearMissAt > NEAR_MISS_COOLDOWN_MS && now > s.invulnUntil) {
                s.lastNearMissAt = now;
                const bonus = NEAR_MISS_POINTS * s.comboMultiplier;
                s.gemPoints += bonus;
                s.floatingTexts.push({
                  id: getId(), x: HELI_X + 30, y: s.y - 15,
                  text: `CLOSE CALL! +${bonus}`,
                  color: "#ffd060",
                  life: 40, maxLife: 40, vy: -1.8,
                });
                playNearMiss();
              }
            }
          }
        }

        // ---- Space flyer collisions ----
        if (!crashed && currentBiome.id === "space") {
          const heliR = 13;
          for (const a of s.asteroids) {
            const dx = HELI_X - a.x, dy = s.y - a.y;
            const rr = a.r + heliR - 3;
            if (dx * dx + dy * dy < rr * rr) { crashed = true; break; }
          }
          if (!crashed) {
            for (const j of s.jets) {
              if (Math.abs(j.x - HELI_X) < 16 + HELI_W / 2 - 6 &&
                  Math.abs(j.y - s.y) < 10 + HELI_H / 2) { crashed = true; break; }
            }
          }
          if (!crashed) {
            for (const b of s.bullets) {
              const dx = HELI_X - b.x, dy = s.y - b.y;
              if (dx * dx + dy * dy < 13 * 13) { crashed = true; break; }
            }
          }
        }

        // Shield or invuln check
        if (crashed && now < s.invulnUntil) {
          crashed = false;
        }
        if (crashed && s.shieldActive) {
          s.shieldActive = false;
          setActiveShield(false);
          s.invulnUntil = now + SHIELD_GRACE_MS;
          escapeToSafety(s);
          addBurst(s.particles, 28, (i) => {
            const a = Math.random() * Math.PI * 2;
            const sp = 1 + Math.random() * 4;
            return {
              x: HELI_X, y: s.y,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
              life: 36, maxLife: 36,
              color: i % 2 === 0 ? "#5fc8e0" : "#a8e8f8",
              size: 3, gravity: 0.1,
            };
          });
          s.shake = 14;
          crashed = false;
        }

        // Lives system
        if (crashed) {
          s.lives--;
          setLives(s.lives);

          if (s.lives > 0) {
            // Lost a life but not dead — brief invulnerability
            s.invulnUntil = now + INVULN_AFTER_HIT_MS;
            s.shake = 18;
            escapeToSafety(s); // move clear of geometry so grace doesn't re-hit
            addBurst(s.particles, 20, (i) => {
              const a = Math.random() * Math.PI * 2;
              const sp = 1 + Math.random() * 4;
              return {
                x: HELI_X, y: s.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
                life: 30, maxLife: 30,
                color: i % 2 === 0 ? "#ff6b1a" : "#ffd060",
                size: 3, gravity: 0.12,
              };
            });
            s.floatingTexts.push({
              id: getId(), x: HELI_X, y: s.y - 30,
              text: `−1 LIFE`, color: "#d63d3d",
              life: 50, maxLife: 50, vy: -1.6,
            });
            playLifeLost();
            crashed = false;
          }
        }

        // Actual death
        if (crashed) {
          addBurst(s.particles, 38, (i) => {
            const a = Math.random() * Math.PI * 2;
            const sp = 1 + Math.random() * 6;
            return {
              x: HELI_X, y: s.y,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
              life: 50, maxLife: 50,
              color: i % 3 === 0 ? "#ff6b1a" : i % 3 === 1 ? "#ffd060" : "#d63d3d",
              size: 3 + Math.random() * 3, gravity: 0.15,
            };
          });
          // Trigger 6-pointed geometric explosion
          s.explosionActive = true;
          s.explosionX = HELI_X;
          s.explosionY = s.y;
          s.explosionFrame = frame;
          s.shake = 22;
          s.running = false;
          stopRotor();
          stopMusic();
          playCrash();
          const finalScore = s.score;
          setScore(finalScore);
          if (finalScore > highScore) {
            setHighScore(finalScore);
            localStorage.setItem(HIGHSCORE_KEY[s.difficulty], String(finalScore));
          }
          setTimeout(() => setGameOver(true), 600);
        } else if (frame - s.lastScoreSyncFrame >= 4) {
          s.lastScoreSyncFrame = frame;
          setScore(s.score);
          setSlowmoRemaining(slowMoActive ? s.slowMoUntil - now : 0);
          setMagnetRemaining(magnetActive ? s.magnetUntil - now : 0);
        }
      }

      // ---- Particles always update (even paused for visual continuity of existing ones) ----
      if (!s.paused) {
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

      // Floating texts
      if (!s.paused) {
        let w = 0;
        for (let i = 0; i < s.floatingTexts.length; i++) {
          const ft = s.floatingTexts[i];
          ft.y += ft.vy;
          ft.vy *= 0.96;
          ft.life--;
          if (ft.life > 0) {
            if (w !== i) s.floatingTexts[w] = ft;
            w++;
          }
        }
        s.floatingTexts.length = w;
      }

      if (s.shake > 0) s.shake = Math.max(0, s.shake - 1.5);

      // ============ DRAW ============
      const shakeOn = settingsRef.current.screenShake;
      const shakeX = shakeOn && s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      const shakeY = shakeOn && s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      drawBackground(ctx, currentBiome, frame);
      drawSun(ctx, currentBiome);
      drawStars(ctx, s.stars, currentBiome, frame);
      if (currentBiome.id === "space") drawSpaceWarp(ctx, frame);
      if (currentBiome.id === "storm") drawTornado(ctx, s.tornadoX, frame, s.tornadoPhase);
      drawMountains(ctx, s.farMountains, s.nearMountains, currentBiome);
      drawRain(ctx, s.rain);

      for (const o of s.obstacles) drawObstacle(ctx, o, currentBiome);
      for (const p of s.pickups) drawPickup(ctx, p, frame);
      // Space flyers render above pillars/pickups so hazards read clearly
      if (currentBiome.id === "space") {
        for (const a of s.asteroids) drawAsteroid(ctx, a);
        for (const j of s.jets) drawJet(ctx, j, frame);
        for (const b of s.bullets) drawBullet(ctx, b);
      }
      drawSmoke(ctx, s.smoke);

      if (magnetActive) drawMagnetAura(ctx, HELI_X, s.y, frame);

      if (s.running || (!s.running && s.particles.length > 0)) {
        // Flash heli during invulnerability
        const showHeli = s.running && (s.invulnUntil <= Date.now() || Math.floor(frame / 4) % 2 === 0);
        if (showHeli) {
          drawHeli(
            ctx, HELI_X, s.y, s.vy, frame,
            s.shieldActive, Math.max(0, s.invulnUntil - Date.now())
          );
        }
      }

      drawSparks(ctx, s.sparks);

      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // 6-pointed geometric explosion animation
      if (s.explosionActive) {
        const EXPLOSION_DURATION = 70; // frames
        const elapsed = frame - s.explosionFrame;
        const progress = elapsed / EXPLOSION_DURATION;
        if (elapsed >= 0 && progress < 1) {
          drawExplosion(ctx, s.explosionX, s.explosionY, progress, frame);
        } else {
          // finished, or the loop restarted and reset the frame counter
          s.explosionActive = false;
        }
      }

      for (const ft of s.floatingTexts) {
        ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 2);
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";

      if (currentBiome.hasLightning && s.lightning > 0) {
        drawLightningFlash(ctx, s.lightning);
      }

      if (slowMoActive) {
        const remaining = (s.slowMoUntil - Date.now()) / SLOWMO_DURATION_MS;
        drawSlowmoOverlay(ctx, Math.min(1, remaining + 0.3));
      }

      // ---- Paused overlay on canvas ----
      if (s.paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff6b1a";
        ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2 - 10);
        ctx.font = "16px monospace";
        ctx.fillStyle = "#b8a088";
        ctx.fillText("Press P or ESC to resume", WIDTH / 2, HEIGHT / 2 + 20);
        ctx.textAlign = "start";
      }

      ctx.restore();
      } catch (err) {
        // Defence in depth: any uncaught error inside a frame must NOT kill
        // the whole loop. Log it and keep going on the next frame.
        // eslint-disable-next-line no-console
        console.warn("[helicopter loop] frame error (recovering):", err);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highScore, rebuildStars]);

  // Pickup collection
  const collectPickup = (s: typeof stateRef.current, p: Pickup, now: number) => {
    const isGem = p.type === "blue_gem" || p.type === "green_gem" || p.type === "red_gem" || p.type === "gold_gem" || p.type === "coin";

    if (isGem) {
      // Combo tracking
      s.comboCount++;
      s.lastGemAt = now;
      const newMult = getComboMultiplier(s.comboCount);
      if (newMult > s.comboMultiplier) {
        s.comboMultiplier = newMult;
        setComboMultiplier(newMult);
        s.floatingTexts.push({
          id: getId(), x: HELI_X, y: s.y - 30,
          text: `COMBO ×${newMult}!`, color: "#ff8a3d",
          life: 45, maxLife: 45, vy: -2,
        });
        playComboUp();
      }
      setComboCount(s.comboCount);
    }

    if (p.type === "blue_gem") {
      const pts = BLUE_GEM_POINTS * s.comboMultiplier;
      s.gemPoints += pts;
      s.gemsCollected += 1;
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: `+${pts}`, color: "#5fc8e0",
        life: 36, maxLife: 36, vy: -1.5,
      });
      addBurst(s.particles, 8, () => {
        const a = Math.random() * Math.PI * 2;
        return {
          x: p.x, y: p.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2,
          life: 22, maxLife: 22, color: "#5fc8e0", size: 2, gravity: 0,
        };
      });
      setGemsCollected(s.gemsCollected);
      setGemPoints(s.gemPoints);
      playGemCollect();
    } else if (p.type === "green_gem") {
      const pts = GREEN_GEM_POINTS * s.comboMultiplier;
      s.gemPoints += pts;
      s.gemsCollected += 1;
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: `+${pts}`, color: "#40c870",
        life: 40, maxLife: 40, vy: -1.6,
      });
      addBurst(s.particles, 10, (i) => {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2.5;
        return {
          x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5,
          life: 25, maxLife: 25,
          color: i % 2 === 0 ? "#40c870" : "#90f0a8",
          size: 2.5, gravity: 0,
        };
      });
      setGemsCollected(s.gemsCollected);
      setGemPoints(s.gemPoints);
      playGreenGem();
    } else if (p.type === "red_gem") {
      const pts = RED_GEM_POINTS * s.comboMultiplier;
      s.gemPoints += pts;
      s.gemsCollected += 1;
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: `+${pts}`, color: "#e04050",
        life: 44, maxLife: 44, vy: -1.6,
      });
      addBurst(s.particles, 12, (i) => {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        return {
          x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
          life: 28, maxLife: 28,
          color: i % 2 === 0 ? "#e04050" : "#ff8898",
          size: 2.5, gravity: 0.03,
        };
      });
      setGemsCollected(s.gemsCollected);
      setGemPoints(s.gemPoints);
      playRedGem();
    } else if (p.type === "gold_gem") {
      const pts = GOLD_GEM_POINTS * s.comboMultiplier;
      s.gemPoints += pts;
      s.gemsCollected += 1;
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: `+${pts}!`, color: "#ffd060",
        life: 50, maxLife: 50, vy: -1.7,
      });
      addBurst(s.particles, 16, (i) => {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        return {
          x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
          life: 30, maxLife: 30,
          color: i % 2 === 0 ? "#ffd060" : "#ff8a3d",
          size: 3, gravity: 0.05,
        };
      });
      setGemsCollected(s.gemsCollected);
      setGemPoints(s.gemPoints);
      playGoldGem();
    } else if (p.type === "coin") {
      const pts = COIN_POINTS * s.comboMultiplier;
      s.gemPoints += pts;
      s.gemsCollected += 1;
      // No floating text — a full patch would spam the screen; burst + blip is enough.
      addBurst(s.particles, 5, () => {
        const a = Math.random() * Math.PI * 2;
        return {
          x: p.x, y: p.y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6,
          life: 16, maxLife: 16, color: "#ffd060", size: 2, gravity: 0,
        };
      });
      setGemsCollected(s.gemsCollected);
      setGemPoints(s.gemPoints);
      playGemCollect();
    } else if (p.type === "shield") {
      s.shieldActive = true;
      setActiveShield(true);
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: "SHIELD", color: "#5fc8e0",
        life: 50, maxLife: 50, vy: -1.5,
      });
      playPowerUp();
    } else if (p.type === "slowmo") {
      s.slowMoUntil = now + SLOWMO_DURATION_MS;
      setSlowmoRemaining(SLOWMO_DURATION_MS);
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: "SLOW-MO", color: "#8c6edc",
        life: 50, maxLife: 50, vy: -1.5,
      });
      playPowerUp();
    } else if (p.type === "magnet") {
      s.magnetUntil = now + MAGNET_DURATION_MS;
      setMagnetRemaining(MAGNET_DURATION_MS);
      s.floatingTexts.push({
        id: getId(), x: p.x, y: p.y,
        text: "MAGNET", color: "#d63d3d",
        life: 50, maxLife: 50, vy: -1.5,
      });
      playPowerUp();
    }
  };

  // ===== Input =====
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Pause toggle
      if ((e.code === "KeyP" || e.code === "Escape") && started && !gameOver) {
        e.preventDefault();
        const newPaused = !stateRef.current.paused;
        stateRef.current.paused = newPaused;
        setPaused(newPaused);
        if (newPaused) pauseMusic(); else resumeMusic();
        return;
      }
      if (e.code !== "Space") return;
      e.preventDefault();
      if (stateRef.current.paused) return;
      // Spacebar starts / restarts the game
      if (!started || gameOver) {
        resetGame(difficulty ?? "easy");
        return;
      }
      stateRef.current.holding = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      stateRef.current.holding = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [started, gameOver, difficulty, resetGame]);

  const distanceMeters = Math.floor(stateRef.current.distance / 10);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* HUD row */}
      <div className="flex items-center justify-between w-full max-w-[800px] font-[family-name:var(--font-mono)] text-2xl">
        <span>
          <span className="text-[var(--muted)]">SCORE </span>
          <span className="text-[var(--crt-green)]">
            {String(score).padStart(5, "0")}
          </span>
        </span>
        <div className="flex items-center gap-3">
          {/* Lives */}
          {started && difficulty === "easy" && (
            <span className="text-base">
              {Array.from({ length: lives }, (_, i) => (
                <span key={i} className="text-[#d63d3d]">♥</span>
              ))}
              {Array.from({ length: EASY_LIVES - lives }, (_, i) => (
                <span key={i} className="text-[#3a2218]">♥</span>
              ))}
            </span>
          )}
          {/* Combo */}
          {comboMultiplier > 1 && (
            <span className="text-base px-2 py-0.5 rounded bg-[#ff8a3d22] text-[#ff8a3d]">
              ×{comboMultiplier}
            </span>
          )}
          <span>
            <span className="text-[var(--muted)]">BEST </span>
            <span className="text-[var(--accent)]">
              {String(highScore).padStart(5, "0")}
            </span>
          </span>
        </div>
      </div>

      {/* Active power-up indicators */}
      {(activeShield || slowmoRemaining > 0 || magnetRemaining > 0) && (
        <div className="flex gap-3 font-[family-name:var(--font-mono)] text-base">
          {activeShield && (
            <span className="px-2 py-1 rounded bg-[#5fc8e022] text-[#a8e8f8]">
              🛡 SHIELD
            </span>
          )}
          {slowmoRemaining > 0 && (
            <span className="px-2 py-1 rounded bg-[#8c6edc22] text-[#c0a8f8]">
              ⏳ {Math.ceil(slowmoRemaining / 1000)}s
            </span>
          )}
          {magnetRemaining > 0 && (
            <span className="px-2 py-1 rounded bg-[#d63d3d22] text-[#f8a8a8]">
              🧲 {Math.ceil(magnetRemaining / 1000)}s
            </span>
          )}
        </div>
      )}

      <div
        className="relative w-full max-w-[800px]"
        style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
        onMouseDown={() => {
          if (stateRef.current.paused) return;
          if (!started || gameOver) return;
          stateRef.current.holding = true;
        }}
        onMouseUp={() => (stateRef.current.holding = false)}
        onMouseLeave={() => (stateRef.current.holding = false)}
        onTouchStart={(e) => {
          e.preventDefault();
          if (stateRef.current.paused) return;
          if (!started || gameOver) return;
          stateRef.current.holding = true;
        }}
        onTouchEnd={() => (stateRef.current.holding = false)}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-pointer"
        />

        {/* Biome banner */}
        {biomeBanner && (
          <div className="absolute inset-x-0 top-1/3 flex items-center justify-center pointer-events-none z-20">
            <div className="font-[family-name:var(--font-display)] text-lg sm:text-2xl text-[var(--accent)] drop-shadow-[0_0_12px_rgba(255,107,26,0.6)] flicker text-center px-4">
              ▼ {biomeBanner} ▼
            </div>
          </div>
        )}

        {/* Start / Game Over overlay */}
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              {gameOver ? "CRASHED" : "HELICOPTER"}
            </h2>
            {gameOver && (
              <div className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-4 text-center leading-relaxed">
                <div className="flex justify-between gap-6 min-w-[260px]">
                  <span className="text-[var(--muted)]">DISTANCE</span>
                  <span>{distanceMeters}m</span>
                </div>
                <div className="flex justify-between gap-6 min-w-[260px]">
                  <span className="text-[var(--muted)]">GEMS</span>
                  <span>{gemsCollected} <span className="text-[var(--accent-hot)]">(+{gemPoints})</span></span>
                </div>
                <div className="flex justify-between gap-6 min-w-[260px]">
                  <span className="text-[var(--muted)]">REACHED</span>
                  <span className="text-[var(--crt-green)]">{BIOMES.find(b => b.id === bestBiomeId)?.name}</span>
                </div>
                {difficulty === "easy" && (
                  <div className="flex justify-between gap-6 min-w-[260px]">
                    <span className="text-[var(--muted)]">MODE</span>
                    <span className="text-[#7fd650]">EASY</span>
                  </div>
                )}
                <div className="flex justify-between gap-6 min-w-[260px] mt-2 pt-2 border-t border-[var(--border)]">
                  <span className="text-[var(--muted)]">TOTAL</span>
                  <span className="text-2xl text-[var(--accent)]">{score}</span>
                </div>
                {score > 0 && score >= highScore && (
                  <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mt-3 flicker">
                    ★ NEW RECORD ★
                  </p>
                )}
              </div>
            )}
            {/* Difficulty buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => resetGame("easy")}
                className="pixel-edge px-4 py-2 rounded bg-[#7fd650] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
              >
                EASY
              </button>
              <button
                onClick={() => resetGame("hard")}
                className="pixel-edge px-4 py-2 rounded bg-[#d63d3d] text-[var(--foreground)] font-[family-name:var(--font-display)] text-xs"
              >
                HARD
              </button>
            </div>
            <div className="mt-2 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)] text-center">
              <span className="text-[#7fd650]">EASY</span> = 3 lives + wider gaps
              <span className="mx-2">·</span>
              <span className="text-[#d63d3d]">HARD</span> = one hit death
            </div>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">
              hold SPACE or tap to fly · SPACE to {gameOver ? "restart" : "start"}<br />
              <span className="text-xs">P to pause · grab gems · collect power-ups · reach new biomes</span>
            </p>
          </div>
        )}
      </div>

      {/* Settings bar */}
      <div className="relative flex items-center gap-2 w-full max-w-[800px]">
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
        {started && !gameOver && (
          <span className="ml-auto font-[family-name:var(--font-mono)] text-base text-[var(--muted)]">
            {distanceMeters}m · {BIOMES[stateRef.current.biomeIdx]?.name}
          </span>
        )}

        {/* Settings panel */}
        {settingsOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#1a0e0a] border-2 border-[var(--border)] rounded p-4 z-30 min-w-[240px] shadow-lg shadow-black/40">
            <div className="font-[family-name:var(--font-display)] text-xs text-[var(--accent)] mb-3">
              SETTINGS
            </div>
            {[
              { key: "sound" as const, label: "Sound", on: settings.sound },
              { key: "screenShake" as const, label: "Screen Shake", on: settings.screenShake },
              { key: "weather" as const, label: "Weather FX", on: settings.weather },
              { key: "particles" as const, label: "Smoke & Particles", on: settings.particles },
            ].map(({ key, label, on }) => (
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
