"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

import type {
  Arrow, Apple, AppleChunk, JuiceParticle, FloatingText, GrassBlade, Mood,
} from "./types";
import {
  WIDTH, HEIGHT, GROUND_Y, ARCHER_X, ARCHER_Y, APPLE_RADIUS, BULLSEYE_RADIUS,
  GRAVITY, APPLE_HIT_POINTS, BULLSEYE_POINTS, SAVED_ARROW_BONUS,
  SPEED_BONUS_FAST_MS, SPEED_BONUS_OK_MS, SPEED_BONUS_FAST_PTS, SPEED_BONUS_OK_PTS,
  PRO_MODE_MULT, FLINCH_DURATION_MS, CHEER_DURATION_MS, PANIC_DURATION_MS,
  NEAR_MISS_RADIUS_SQ, FLINCH_COOLDOWN_MS, ARROW_TRAIL_LIFE, ARROW_TRAIL_MAX,
  PREVIEW_FRAMES, SHAKE_HIT, SHAKE_BULLSEYE, SHAKE_FRIEND_HIT, SHAKE_NEAR_MISS,
} from "./constants";
import { getLevelConfig } from "./levels";
import {
  syncApplePositions, makeApples,
  makeAppleChunks, makeJuiceSplatter, makeGrass,
  getId, resetIdCounter,
} from "./helpers";
import {
  drawSky, drawMoon, drawClouds, drawGround, drawGrass, drawWindIndicator,
  drawArcher, drawFriend, drawApple, drawChunks, drawJuice, drawArrow,
  drawTrajectoryPreview,
} from "./drawing";

export default function AppleShooter() {
  // Ref'd because the death handler runs inside the canvas loop, which closes
  // over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("apple-shooter");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const [shots, setShots] = useState(3);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [proMode, setProMode] = useState(false);

  const stateRef = useRef({
    // Input
    aiming: false,
    aimStart: { x: 0, y: 0 },
    aimCurrent: { x: 0, y: 0 },

    // Arrow & apples
    arrow: null as Arrow | null,
    apples: [] as Apple[],

    // Friend
    friendBaseX: 600,
    friendX: 600,
    moves: false,
    moveSpeed: 0,
    moveRange: 0,
    moveStartTime: 0,
    mood: "worried" as Mood,
    moodUntil: 0,

    // Wind
    wind: 0,

    // Per-level state
    levelStartedAt: 0,
    levelArrowsUsed: 0,
    levelMissed: false,

    // Run state
    score: 0,
    proMode: false,

    // Effects
    chunks: [] as AppleChunk[],
    juice: [] as JuiceParticle[],
    floatingTexts: [] as FloatingText[],
    grass: [] as GrassBlade[],
    shake: 0,
    cloudOffset: 0,

    // Misc
    lastFlinchAt: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("apple-shooter-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const setMood = (m: Mood, durationMs: number) => {
    const s = stateRef.current;
    s.mood = m;
    s.moodUntil = Date.now() + durationMs;
  };

  const setupLevel = useCallback((lvl: number) => {
    const cfg = getLevelConfig(lvl);
    const s = stateRef.current;
    s.friendBaseX = cfg.targetBaseX;
    s.friendX = cfg.targetBaseX;
    s.moves = cfg.moves;
    s.moveSpeed = cfg.moveSpeed;
    s.moveRange = cfg.moveRange;
    s.moveStartTime = Date.now();
    s.apples = makeApples(cfg.applePositions, cfg.targetBaseX);
    s.wind = cfg.windAmplitude === 0
      ? 0
      : (Math.random() < 0.5 ? -1 : 1) * (cfg.windAmplitude * (0.5 + Math.random() * 0.5));
    s.arrow = null;
    s.levelStartedAt = Date.now();
    s.levelArrowsUsed = 0;
    s.levelMissed = false;
    s.mood = "worried";
    s.moodUntil = 0;

    // Banner for difficulty milestones
    if (cfg.newThisLevel) {
      setMessage(`LEVEL ${lvl} · ${cfg.newThisLevel}`);
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage(`LEVEL ${lvl}`);
      setTimeout(() => setMessage(null), 1200);
    }
  }, []);

  const resetGame = useCallback(() => {
    resetIdCounter();
    stateRef.current = {
      aiming: false,
      aimStart: { x: 0, y: 0 },
      aimCurrent: { x: 0, y: 0 },
      arrow: null,
      apples: [],
      friendBaseX: 600,
      friendX: 600,
      moves: false,
      moveSpeed: 0,
      moveRange: 0,
      moveStartTime: 0,
      mood: "worried",
      moodUntil: 0,
      wind: 0,
      levelStartedAt: 0,
      levelArrowsUsed: 0,
      levelMissed: false,
      score: 0,
      proMode,
      chunks: [],
      juice: [],
      floatingTexts: [],
      grass: makeGrass(),
      shake: 0,
      cloudOffset: 0,
      lastFlinchAt: 0,
    };
    setLevel(1);
    setShots(3);
    setScore(0);
    setGameOver(false);
    setStarted(true);
    setupLevel(1);
  }, [setupLevel, proMode]);

  // ===== Animation loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;

    const draw = () => {
      const s = stateRef.current;
      frame++;
      const now = Date.now();
      s.cloudOffset = (s.cloudOffset + 0.15) % 1000;

      // ---- Friend movement (sin oscillation around base) ----
      if (s.moves) {
        s.friendX = s.friendBaseX + Math.sin((now - s.moveStartTime) * s.moveSpeed) * s.moveRange;
      } else {
        s.friendX = s.friendBaseX;
      }
      // Apples follow the friend
      syncApplePositions(s.apples, s.friendX);

      // ---- Mood timeout ----
      if (s.moodUntil > 0 && now > s.moodUntil) {
        s.mood = "worried";
        s.moodUntil = 0;
      }

      // ---- Panic on big bow-draw ----
      if (s.aiming) {
        const dx = s.aimCurrent.x - s.aimStart.x;
        const dy = s.aimCurrent.y - s.aimStart.y;
        const power = Math.min(Math.sqrt(dx * dx + dy * dy), 200);
        if (power > 140 && s.mood !== "panic" && s.mood !== "cheer" && s.mood !== "flinch") {
          setMood("panic", PANIC_DURATION_MS);
        }
      }

      // ---- Arrow physics ----
      if (s.arrow && !s.arrow.stuck) {
        const a = s.arrow;
        a.x += a.vx;
        a.y += a.vy;
        a.vy += GRAVITY;
        a.vx += s.wind * 0.04;
        // Trail
        a.trail.push({ x: a.x, y: a.y, life: ARROW_TRAIL_LIFE });
        // Decay trail
        {
          let w = 0;
          for (let i = 0; i < a.trail.length; i++) {
            const t = a.trail[i];
            t.life--;
            if (t.life > 0) {
              if (w !== i) a.trail[w] = t;
              w++;
            }
          }
          a.trail.length = w;
        }
        if (a.trail.length > ARROW_TRAIL_MAX) {
          a.trail.splice(0, a.trail.length - ARROW_TRAIL_MAX);
        }

        // ---- Collision with apples ----
        let hitApple: Apple | null = null;
        let hitDistSq = Infinity;
        for (const apple of s.apples) {
          if (apple.hit) continue;
          const dx = a.x - apple.x;
          const dy = a.y - apple.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < APPLE_RADIUS * APPLE_RADIUS && d2 < hitDistSq) {
            hitDistSq = d2;
            hitApple = apple;
          }
        }

        if (hitApple) {
          const distFromCenter = Math.sqrt(hitDistSq);
          const bullseye = distFromCenter < BULLSEYE_RADIUS;
          const angle = Math.atan2(a.vy, a.vx);
          hitApple.hit = true;
          // Score
          const base = bullseye ? BULLSEYE_POINTS : APPLE_HIT_POINTS;
          const mult = s.proMode ? PRO_MODE_MULT : 1;
          const points = base * mult;
          s.score += points;
          setScore(s.score);
          // Visuals
          makeAppleChunks(s.chunks, hitApple.x, hitApple.y, bullseye, angle);
          makeJuiceSplatter(s.juice, hitApple.x, hitApple.y, bullseye);
          s.shake = bullseye ? SHAKE_BULLSEYE : SHAKE_HIT;
          setMood("cheer", CHEER_DURATION_MS);
          // Floating text
          s.floatingTexts.push({
            id: getId(),
            x: hitApple.x, y: hitApple.y - 20,
            text: bullseye ? `BULLSEYE! +${points}` : `+${points}`,
            color: bullseye ? "#ffd060" : "#7fd650",
            life: bullseye ? 70 : 50,
            maxLife: bullseye ? 70 : 50,
            vy: -1.5,
            scale: bullseye ? 1.6 : 1.0,
          });
          // Kill arrow
          s.arrow = null;

          // Level complete?
          const remaining = s.apples.filter((ap) => !ap.hit).length;
          if (remaining === 0) {
            // Level cleared bonuses
            const elapsed = now - s.levelStartedAt;
            let bonusTotal = 0;
            const arrowsLeft = 3 - s.levelArrowsUsed;
            if (arrowsLeft > 0) {
              const saved = arrowsLeft * SAVED_ARROW_BONUS;
              bonusTotal += saved;
              s.floatingTexts.push({
                id: getId(),
                x: ARCHER_X + 100, y: 80,
                text: `${arrowsLeft} ARROW${arrowsLeft > 1 ? "S" : ""} SAVED +${saved}`,
                color: "#7fd650",
                life: 80, maxLife: 80, vy: -0.6, scale: 1.0,
              });
            }
            if (elapsed < SPEED_BONUS_FAST_MS) {
              bonusTotal += SPEED_BONUS_FAST_PTS;
              s.floatingTexts.push({
                id: getId(),
                x: ARCHER_X + 100, y: 110,
                text: `FAST! +${SPEED_BONUS_FAST_PTS}`,
                color: "#ffd060",
                life: 80, maxLife: 80, vy: -0.6, scale: 1.0,
              });
            } else if (elapsed < SPEED_BONUS_OK_MS) {
              bonusTotal += SPEED_BONUS_OK_PTS;
              s.floatingTexts.push({
                id: getId(),
                x: ARCHER_X + 100, y: 110,
                text: `QUICK +${SPEED_BONUS_OK_PTS}`,
                color: "#ffd060",
                life: 70, maxLife: 70, vy: -0.6, scale: 1.0,
              });
            }
            if (bonusTotal > 0) {
              const mult = s.proMode ? PRO_MODE_MULT : 1;
              const totalBonus = bonusTotal * mult;
              s.score += totalBonus;
              setScore(s.score);
            }
            // Advance level after a short cheer pause
            const nextLevel = level + 1;
            setTimeout(() => {
              setLevel(nextLevel);
              setShots(3);
              setupLevel(nextLevel);
            }, 1200);
          }
          return;  // skip rest of arrow physics this frame
        }

        // ---- Collision with friend's body (game over) ----
        const friendHead = { x: s.friendX, y: ARCHER_Y - 60 };
        const friendTorso = { x: s.friendX, y: ARCHER_Y - 38 };
        const headHit = Math.hypot(a.x - friendHead.x, a.y - friendHead.y) < 10;
        const torsoHit = Math.abs(a.x - friendTorso.x) < 8 &&
                         a.y > friendTorso.y - 14 && a.y < friendTorso.y + 14;
        if (headHit || torsoHit) {
          s.arrow!.stuck = true;
          s.arrow!.stuckAngle = Math.atan2(a.vy, a.vx);
          s.shake = SHAKE_FRIEND_HIT;
          setMessage("OH NO! You hit your friend.");
          setMood("flinch", 5000);
          hostRef.current.reportScore(s.score);
          setTimeout(() => setGameOver(true), 700);
          return;
        }

        // ---- Near-miss (flinch) ----
        const dxHead = a.x - friendHead.x;
        const dyHead = a.y - friendHead.y;
        const headDSq = dxHead * dxHead + dyHead * dyHead;
        if (
          headDSq < NEAR_MISS_RADIUS_SQ &&
          now - s.lastFlinchAt > FLINCH_COOLDOWN_MS &&
          s.mood !== "cheer"
        ) {
          s.lastFlinchAt = now;
          setMood("flinch", FLINCH_DURATION_MS);
          s.shake = Math.max(s.shake, SHAKE_NEAR_MISS);
        }

        // ---- Off-screen / ground = arrow lost ----
        if (a.x > WIDTH || a.y > GROUND_Y || a.x < 0) {
          s.arrow = null;
          s.levelMissed = true;
          const left = (3 - s.levelArrowsUsed);
          if (left <= 0) {
            setMessage("Out of arrows!");
            hostRef.current.reportScore(s.score);
            setTimeout(() => setGameOver(true), 500);
          } else {
            setMessage(`${left} ${left === 1 ? "arrow" : "arrows"} left`);
            setTimeout(() => setMessage(null), 1000);
          }
        }
      }

      // ---- Update chunks ----
      {
        let w = 0;
        for (let i = 0; i < s.chunks.length; i++) {
          const c = s.chunks[i];
          c.x += c.vx;
          c.y += c.vy;
          c.vy += 0.22;
          c.rotation += c.rotSpeed;
          c.life--;
          if (c.y < GROUND_Y && c.life > 0) {
            if (w !== i) s.chunks[w] = c;
            w++;
          }
        }
        s.chunks.length = w;
      }

      // ---- Update juice ----
      {
        let w = 0;
        for (let i = 0; i < s.juice.length; i++) {
          const j = s.juice[i];
          j.x += j.vx;
          j.y += j.vy;
          j.vy += 0.18;
          j.life--;
          if (j.life > 0 && j.y < GROUND_Y) {
            if (w !== i) s.juice[w] = j;
            w++;
          }
        }
        s.juice.length = w;
      }

      // ---- Update floating texts ----
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

      // ---- Shake decay ----
      if (s.shake > 0) s.shake = Math.max(0, s.shake - 1);

      // ============ DRAW ============
      const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      drawSky(ctx);
      drawMoon(ctx);
      drawClouds(ctx, s.cloudOffset, s.wind);
      drawGround(ctx);
      drawGrass(ctx, s.grass, s.wind, frame);

      // Trajectory preview while aiming (unless PRO mode)
      if (s.aiming && !s.proMode) {
        const dx = s.aimCurrent.x - s.aimStart.x;
        const dy = s.aimCurrent.y - s.aimStart.y;
        const power = Math.min(Math.sqrt(dx * dx + dy * dy), 200);
        if (power > 5) {
          const launchVX = (-dx / 8) * (power / 25);
          const launchVY = (-dy / 8) * (power / 25);
          drawTrajectoryPreview(
            ctx, ARCHER_X + 12, ARCHER_Y - 20,
            launchVX, launchVY, GRAVITY, s.wind, PREVIEW_FRAMES
          );
        }
      }

      // Archer
      let archerPower = 0;
      if (s.aiming) {
        const dx = s.aimCurrent.x - s.aimStart.x;
        const dy = s.aimCurrent.y - s.aimStart.y;
        archerPower = Math.min(Math.sqrt(dx * dx + dy * dy), 200);
      }
      drawArcher(ctx, s.aiming, archerPower);

      // Friend
      drawFriend(ctx, s.friendX, s.mood, s.apples, frame);

      // Apples (unbroken only)
      for (const ap of s.apples) {
        if (!ap.hit) drawApple(ctx, ap.x, ap.y);
      }

      // Juice and chunks
      drawJuice(ctx, s.juice);
      drawChunks(ctx, s.chunks);

      // Arrow
      if (s.arrow) drawArrow(ctx, s.arrow);

      // Floating texts
      for (const ft of s.floatingTexts) {
        ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 2);
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

      // Wind indicator (in shaken coordinate space — looks fine, it's HUD-ish but the shake is brief)
      drawWindIndicator(ctx, s.wind);

      // Power bar while aiming
      if (s.aiming) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(20, 20, 220, 14);
        const pct = archerPower / 200;
        ctx.fillStyle = pct > 0.7 ? "#d63d3d" : pct > 0.4 ? "#ff8a3d" : "#7fd650";
        ctx.fillRect(22, 22, 216 * pct, 10);
        ctx.fillStyle = "#f5e8d0";
        ctx.font = "11px monospace";
        ctx.fillText("POWER", 30, 25);
      }

      // PRO mode indicator
      if (s.proMode) {
        ctx.fillStyle = "#ffd060";
        ctx.font = "bold 11px monospace";
        ctx.fillText("PRO ×2", 20, 50);
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
   
  }, [level, setupLevel]);

  // ===== Input handling =====
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

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameOver || stateRef.current.arrow) return;
    const pt = getCanvasCoords(e);
    stateRef.current.aiming = true;
    stateRef.current.aimStart = pt;
    stateRef.current.aimCurrent = pt;
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!stateRef.current.aiming) return;
    stateRef.current.aimCurrent = getCanvasCoords(e);
  };

  const onUp = () => {
    if (!stateRef.current.aiming) return;
    const s = stateRef.current;
    s.aiming = false;
    const dx = s.aimCurrent.x - s.aimStart.x;
    const dy = s.aimCurrent.y - s.aimStart.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy), 200) / 8;
    if (power < 2) return;
    s.arrow = {
      x: ARCHER_X + 12,
      y: ARCHER_Y - 20,
      vx: (-dx / 8) * (power / 25),
      vy: (-dy / 8) * (power / 25),
      stuck: false,
      stuckAngle: 0,
      trail: [],
    };
    s.levelArrowsUsed += 1;
    setShots(3 - s.levelArrowsUsed);
  };

  // Save high score on game over
  useEffect(() => {
    if (gameOver && stateRef.current.score > highScore) {
      const final = stateRef.current.score;
      setHighScore(final);
      localStorage.setItem("apple-shooter-highscore", String(final));
    }
  }, [gameOver, highScore]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[800px] font-[family-name:var(--font-mono)] text-2xl flex-wrap gap-2">
        <span>
          <span className="text-[var(--muted)]">LEVEL </span>
          <span className="text-[var(--crt-green)]">{level}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">SCORE </span>
          <span className="text-[var(--accent-hot)]">{score}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">ARROWS </span>
          <span className="text-[var(--accent)]">
            {"●".repeat(shots)}
            {"○".repeat(3 - shots)}
          </span>
        </span>
        <span>
          <span className="text-[var(--muted)]">BEST </span>
          <span className="text-[var(--foreground)]">{highScore}</span>
        </span>
      </div>

      <div className="relative w-full max-w-[800px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-crosshair"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />

        {message && !gameOver && started && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-black/70 font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)]">
            {message}
          </div>
        )}

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              APPLE SHOOTER
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-4 text-center max-w-md">
              Drag from the archer to aim. Split the apple, not your friend.<br />
              Bullseyes pay double. Speed pays a bonus.
            </p>
            <label className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-base text-[var(--foreground)] mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={proMode}
                onChange={(e) => setProMode(e.target.checked)}
                className="w-4 h-4 accent-[var(--accent-hot)]"
              />
              <span>PRO MODE</span>
              <span className="text-[var(--muted)]">— no trajectory preview, ×2 score</span>
            </label>
            <button
              onClick={resetGame}
              className="pixel-edge px-5 py-2 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
            >
              START
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--danger)] mb-2">
              GAME OVER
            </h2>
            <div className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-4 text-center min-w-[240px]">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">REACHED</span>
                <span className="text-[var(--crt-green)]">Level {level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">SCORE</span>
                <span className="text-2xl text-[var(--accent)]">{score}</span>
              </div>
              {score > 0 && score >= highScore && (
                <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mt-2 flicker text-center">
                  ★ NEW RECORD ★
                </p>
              )}
            </div>
            <button
              onClick={resetGame}
              className="pixel-edge px-5 py-2 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
