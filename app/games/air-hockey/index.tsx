"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 420;
const HEIGHT = 620;
const PADDLE_R = 26;
const PUCK_R = 14;
const GOAL_W = 160;
const FRICTION = 0.993;
const MAX_PUCK_SPEED = 22;
const MIN_BOUNCE_SPEED = 2.5;
const WIN_SCORE = 7;

// AI's "no-stuck" thresholds
const STUCK_SPEED = 1.2;          // below this is "stuck"
const STUCK_FRAMES_TO_ACT = 35;   // ~0.6s in AI half slow before AI panic-sweeps

type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string };

export default function AirHockey() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [over, setOver] = useState<null | "player" | "ai">(null);
  const [started, setStarted] = useState(false);
  const [wins, setWins] = useState(0);

  const s = useRef({
    // Player paddle (bottom half)
    px: WIDTH / 2, py: HEIGHT - 80,
    pvx: 0, pvy: 0,
    targetX: WIDTH / 2, targetY: HEIGHT - 80,

    // AI paddle (top half)
    ax: WIDTH / 2, ay: 80,
    avx: 0, avy: 0,
    aiSweepDir: 1 as 1 | -1,        // direction of current sweep when puck stuck
    aiSweepFrames: 0,
    stuckCounter: 0,

    // Puck
    bx: WIDTH / 2, by: HEIGHT / 2,
    bvx: 0, bvy: 0,
    serveCountdown: 60,
    serveTo: 1 as 1 | -1,

    playerScore: 0, aiScore: 0,
    running: false,
    sparks: [] as Spark[],
    shake: 0,
  });

  useEffect(() => {
    const w = localStorage.getItem("airhockey-wins");
    if (w) setWins(parseInt(w, 10));
  }, []);

  const reset = () => {
    const st = s.current;
    st.playerScore = 0; st.aiScore = 0;
    st.px = WIDTH / 2; st.py = HEIGHT - 80; st.targetX = st.px; st.targetY = st.py;
    st.ax = WIDTH / 2; st.ay = 80;
    st.stuckCounter = 0;
    serve(st, Math.random() < 0.5 ? 1 : -1);
    st.running = true;
    setPlayerScore(0); setAiScore(0); setOver(null); setStarted(true);
  };

  const serve = (st: typeof s.current, dir: 1 | -1) => {
    st.bx = WIDTH / 2; st.by = HEIGHT / 2;
    st.bvx = 0; st.bvy = 0;
    st.serveCountdown = 45;
    st.serveTo = dir;
    st.stuckCounter = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;

    const loop = () => {
      frame++;
      const st = s.current;

      if (st.running) {
        // === PLAYER PADDLE: ease to target, restricted to bottom half ===
        const oldPx = st.px, oldPy = st.py;
        st.px += (st.targetX - st.px) * 0.5;
        st.py += (st.targetY - st.py) * 0.5;
        st.px = Math.max(PADDLE_R + 4, Math.min(WIDTH - PADDLE_R - 4, st.px));
        st.py = Math.max(HEIGHT / 2 + PADDLE_R + 4, Math.min(HEIGHT - PADDLE_R - 4, st.py));
        st.pvx = st.px - oldPx; st.pvy = st.py - oldPy;

        // === AI PADDLE ===
        const puckSpeed = Math.hypot(st.bvx, st.bvy);
        const puckInAIHalf = st.by < HEIGHT / 2;

        // Track "stuck" state: puck slow and in our half (or near top wall)
        if (puckInAIHalf && puckSpeed < STUCK_SPEED) {
          st.stuckCounter++;
        } else {
          st.stuckCounter = Math.max(0, st.stuckCounter - 2);
        }

        // Difficulty scaling: AI gets a hair faster as player scores more
        const baseSpeed = 0.09 + Math.min(0.06, st.playerScore * 0.012);

        let aiTargetX: number, aiTargetY: number;
        let aggression = 1;

        if (st.stuckCounter > STUCK_FRAMES_TO_ACT) {
          // PANIC SWEEP: puck is stuck in AI half. Do a horizontal sweep through it.
          if (st.aiSweepFrames <= 0) {
            // Initiate sweep: pick a direction that pushes puck toward player's side
            // (any horizontal motion works; alternate to avoid pattern)
            st.aiSweepDir = (st.bx < WIDTH / 2 ? 1 : -1);
            st.aiSweepFrames = 22;
          }
          // Move horizontally past the puck, slightly below it (so we connect on the way past)
          aiTargetX = st.bx + st.aiSweepDir * 55;
          aiTargetY = Math.min(HEIGHT / 2 - PADDLE_R - 4, st.by + PADDLE_R + 2);
          aggression = 2.2;
          st.aiSweepFrames--;
          if (st.aiSweepFrames <= 0 && puckSpeed > STUCK_SPEED * 1.5) {
            st.stuckCounter = 0; // sweep worked, reset
          }
        } else if (puckInAIHalf) {
          // ATTACK: aim PAST the puck, on the player-goal side, so AI swings through it.
          // The "swing through" direction points from puck toward player's goal (downward, toward center horizontally).
          const dirX = (WIDTH / 2 - st.bx) * 0.05;
          const dirY = 1; // always downward (toward player goal)
          // Predict puck a few frames out so the AI doesn't always miss a moving puck
          const predBx = st.bx + st.bvx * 4;
          const predBy = st.by + st.bvy * 4;
          aiTargetX = predBx + dirX * 12;
          aiTargetY = predBy + dirY * 26; // overshoot past the puck downward
          aggression = puckSpeed < 2 ? 1.6 : 1.1; // slow puck = swing harder
        } else {
          // DEFENSE: puck in player half. Hold a defensive line, shade toward puck X.
          aiTargetX = WIDTH / 2 + (st.bx - WIDTH / 2) * 0.45;
          aiTargetY = HEIGHT * 0.16;
          // If puck is rising toward AI goal, edge forward to intercept
          if (st.bvy < -2) {
            aiTargetY = HEIGHT * 0.25;
            aiTargetX = st.bx + st.bvx * 6;
          }
        }

        // Apply bounds
        aiTargetX = Math.max(PADDLE_R + 4, Math.min(WIDTH - PADDLE_R - 4, aiTargetX));
        aiTargetY = Math.max(PADDLE_R + 4, Math.min(HEIGHT / 2 - PADDLE_R - 4, aiTargetY));

        const oldAx = st.ax, oldAy = st.ay;
        const aiSpeed = baseSpeed * aggression;
        st.ax += (aiTargetX - st.ax) * aiSpeed;
        st.ay += (aiTargetY - st.ay) * aiSpeed;
        st.avx = st.ax - oldAx; st.avy = st.ay - oldAy;

        // === PUCK ===
        if (st.serveCountdown > 0) {
          st.serveCountdown--;
          if (st.serveCountdown === 0) {
            const a = (Math.random() - 0.5) * 0.6 + (st.serveTo === 1 ? Math.PI / 2 : -Math.PI / 2);
            st.bvx = Math.cos(a) * 4.5;
            st.bvy = Math.sin(a) * 4.5;
          }
        } else {
          st.bx += st.bvx; st.by += st.bvy;
          st.bvx *= FRICTION; st.bvy *= FRICTION;
          // tiny deadzone so micro-velocity doesn't pretend the game is moving
          if (Math.abs(st.bvx) < 0.04) st.bvx = 0;
          if (Math.abs(st.bvy) < 0.04) st.bvy = 0;

          const sp = Math.hypot(st.bvx, st.bvy);
          if (sp > MAX_PUCK_SPEED) {
            st.bvx = (st.bvx / sp) * MAX_PUCK_SPEED;
            st.bvy = (st.bvy / sp) * MAX_PUCK_SPEED;
          }

          // Side walls
          if (st.bx < PUCK_R) { st.bx = PUCK_R; st.bvx = Math.abs(st.bvx); addSparks(st, st.bx, st.by, "#fff"); }
          if (st.bx > WIDTH - PUCK_R) { st.bx = WIDTH - PUCK_R; st.bvx = -Math.abs(st.bvx); addSparks(st, st.bx, st.by, "#fff"); }

          // Top/bottom walls (with goals)
          const goalLeft = (WIDTH - GOAL_W) / 2, goalRight = goalLeft + GOAL_W;
          if (st.by < PUCK_R) {
            if (st.bx > goalLeft && st.bx < goalRight) { score(st, "player"); return scheduleNext(); }
            st.by = PUCK_R; st.bvy = Math.abs(st.bvy); addSparks(st, st.bx, st.by, "#fff");
          }
          if (st.by > HEIGHT - PUCK_R) {
            if (st.bx > goalLeft && st.bx < goalRight) { score(st, "ai"); return scheduleNext(); }
            st.by = HEIGHT - PUCK_R; st.bvy = -Math.abs(st.bvy); addSparks(st, st.bx, st.by, "#fff");
          }

          // Paddle collisions
          collidePaddle(st, st.px, st.py, st.pvx, st.pvy);
          collidePaddle(st, st.ax, st.ay, st.avx, st.avy);
        }
      }

      // Sparks
      let w = 0;
      for (let i = 0; i < st.sparks.length; i++) {
        const p = st.sparks[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--;
        if (p.life > 0) { if (w !== i) st.sparks[w] = p; w++; }
      }
      st.sparks.length = w;

      // ===== DRAW =====
      // shake
      ctx.save();
      if (st.shake > 0) {
        ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
        st.shake = Math.max(0, st.shake - 0.5);
      }

      // Table base
      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, "#2a3a55"); grad.addColorStop(0.5, "#1d2a45"); grad.addColorStop(1, "#152038");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Center line + circle
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, HEIGHT / 2); ctx.lineTo(WIDTH, HEIGHT / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 60, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 6, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();

      // Goal crease arcs
      ctx.strokeStyle = "rgba(255,107,26,0.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(WIDTH / 2, 0, 70, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT, 70, Math.PI, Math.PI * 2); ctx.stroke();

      // Goal areas
      const goalLeft = (WIDTH - GOAL_W) / 2;
      ctx.fillStyle = "rgba(255,107,26,0.18)";
      ctx.fillRect(goalLeft, 0, GOAL_W, 20);
      ctx.fillRect(goalLeft, HEIGHT - 20, GOAL_W, 20);
      ctx.fillStyle = "#ff6b1a";
      ctx.fillRect(goalLeft, 0, GOAL_W, 3);
      ctx.fillRect(goalLeft, HEIGHT - 3, GOAL_W, 3);

      // Border rails (filled but with goal slot cut out)
      ctx.fillStyle = "#1a0e0a";
      ctx.fillRect(0, 0, 4, HEIGHT); ctx.fillRect(WIDTH - 4, 0, 4, HEIGHT);
      ctx.fillRect(0, 0, goalLeft, 4); ctx.fillRect(WIDTH - goalLeft, 0, goalLeft, 4);
      ctx.fillRect(0, HEIGHT - 4, goalLeft, 4); ctx.fillRect(WIDTH - goalLeft, HEIGHT - 4, goalLeft, 4);

      // Sparks
      for (const p of st.sparks) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
      ctx.globalAlpha = 1;

      // Paddles
      drawPaddle(ctx, st.ax, st.ay, "#d63d3d");
      drawPaddle(ctx, st.px, st.py, "#5fc8e0");

      // Puck
      if (st.serveCountdown > 0) {
        const a = 0.5 + Math.abs(Math.sin(frame * 0.15)) * 0.5;
        ctx.globalAlpha = a;
      }
      // Speed-streak trail
      const ps = Math.hypot(st.bvx, st.bvy);
      if (ps > 6) {
        const tlen = Math.min(40, ps * 2.5);
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.5, ps / 25)})`;
        ctx.lineWidth = PUCK_R * 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(st.bx - st.bvx / ps * tlen, st.by - st.bvy / ps * tlen);
        ctx.lineTo(st.bx, st.by);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.arc(st.bx + 1, st.by + 3, PUCK_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0e0a"; ctx.beginPath(); ctx.arc(st.bx, st.by, PUCK_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a2218"; ctx.beginPath(); ctx.arc(st.bx, st.by, PUCK_R - 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();

      raf = requestAnimationFrame(loop);
    };

    const scheduleNext = () => {
      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wins]);

  const collidePaddle = (st: typeof s.current, paddleX: number, paddleY: number, paddleVx: number, paddleVy: number) => {
    const dx = st.bx - paddleX, dy = st.by - paddleY;
    const dist = Math.hypot(dx, dy);
    const minD = PUCK_R + PADDLE_R;
    if (dist < minD && dist > 0.0001) {
      const nx = dx / dist, ny = dy / dist;
      // Push puck out by just the overlap (NOT all the way to minD distance — that teleports)
      const overlap = minD - dist;
      st.bx += nx * overlap;
      st.by += ny * overlap;

      // Compute relative velocity along the normal
      const relVx = st.bvx - paddleVx;
      const relVy = st.bvy - paddleVy;
      const relAlongN = relVx * nx + relVy * ny;
      // Only reflect if puck and paddle are approaching (else we'd "stick" puck to paddle)
      if (relAlongN < 0) {
        // Elastic bounce: subtract twice the projection along the normal
        st.bvx -= 2 * relAlongN * nx;
        st.bvy -= 2 * relAlongN * ny;
        // Energy transfer from paddle motion: add a fraction of paddle velocity along the normal
        const padAlongN = paddleVx * nx + paddleVy * ny;
        if (padAlongN > 0) {
          st.bvx += nx * padAlongN * 0.6;
          st.bvy += ny * padAlongN * 0.6;
        }
      }

      // Minimum rebound speed along the normal so the puck always pushes away
      const speedAlongN = st.bvx * nx + st.bvy * ny;
      if (speedAlongN < MIN_BOUNCE_SPEED) {
        const add = MIN_BOUNCE_SPEED - speedAlongN;
        st.bvx += nx * add;
        st.bvy += ny * add;
      }

      // Clamp top speed
      const sp = Math.hypot(st.bvx, st.bvy);
      if (sp > MAX_PUCK_SPEED) { st.bvx = (st.bvx / sp) * MAX_PUCK_SPEED; st.bvy = (st.bvy / sp) * MAX_PUCK_SPEED; }

      addSparks(st, st.bx, st.by, "#ffd060");
    }
  };

  const addSparks = (st: typeof s.current, x: number, y: number, color: string) => {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      st.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 16, maxLife: 16, color });
    }
  };

  const score = (st: typeof s.current, who: "player" | "ai") => {
    if (who === "player") { st.playerScore++; setPlayerScore(st.playerScore); }
    else { st.aiScore++; setAiScore(st.aiScore); }
    const x = st.bx, y = st.by;
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      st.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 40, maxLife: 40, color: who === "player" ? "#5fc8e0" : "#d63d3d" });
    }
    st.shake = 8;
    if (st.playerScore >= WIN_SCORE) {
      st.running = false; setOver("player");
      const w = wins + 1; setWins(w); localStorage.setItem("airhockey-wins", String(w));
    } else if (st.aiScore >= WIN_SCORE) {
      st.running = false; setOver("ai");
    } else {
      serve(st, who === "player" ? -1 : 1);
    }
  };

  // Input
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
      s.current.targetX = x;
      s.current.targetY = y;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    return () => { canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerdown", onMove); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[440px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[#d63d3d]">AI </span><span className="text-[var(--foreground)]">{aiScore}</span></span>
        <span className="text-base text-[var(--muted)]">First to {WIN_SCORE}</span>
        <span><span className="text-[var(--foreground)]">{playerScore}</span> <span className="text-[#5fc8e0]">YOU</span></span>
      </div>

      <div className="relative w-full max-w-[440px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT}
          className="w-full h-full rounded border-2 border-[var(--border)] touch-none cursor-none" />
        {(!started || over) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base mb-2" style={{ color: over === "player" ? "#7fd650" : over === "ai" ? "#d63d3d" : "#ff8a3d" }}>
              {!started ? "AIR HOCKEY" : over === "player" ? "YOU WIN!" : "AI WINS"}
            </h2>
            {over && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-3">{playerScore} – {aiScore}</p>}
            {started && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-2">Career wins: <span className="text-[var(--accent)]">{wins}</span></p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {over ? "REMATCH" : "PUCK DROP"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">Move the mouse to control your paddle<br />Hit the puck into the top goal</p>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Move your paddle with the mouse (no clicking needed). The faster you swing into the puck, the harder it flies. First to {WIN_SCORE}.
      </p>
    </div>
  );
}

function drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.arc(x + 2, y + 4, PADDLE_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, PADDLE_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(x, y, PADDLE_R - 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, PADDLE_R - 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.arc(x - 3, y - 3, PADDLE_R - 16, 0, Math.PI * 2); ctx.fill();
}
