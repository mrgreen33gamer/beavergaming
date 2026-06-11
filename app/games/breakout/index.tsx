"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 440;
const PADDLE_W = 84;
const PADDLE_H = 12;
const BALL_R = 7;
const ROWS = 5;
const COLS = 9;
const BRICK_H = 20;
const BRICK_GAP = 4;
const BRICK_TOP = 50;

type Brick = { x: number; y: number; alive: boolean; row: number };

export default function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    px: WIDTH / 2 - PADDLE_W / 2,
    bx: WIDTH / 2, by: HEIGHT - 60,
    bvx: 3.5, bvy: -3.5,
    stuck: true,
    bricks: [] as Brick[],
    left: false, right: false,
    running: false,
    score: 0, lives: 3, level: 1,
    lastSync: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("breakout-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const buildBricks = (): Brick[] => {
    const out: Brick[] = [];
    const brickW = (WIDTH - BRICK_GAP * (COLS + 1)) / COLS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        out.push({
          x: BRICK_GAP + c * (brickW + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          alive: true, row: r,
        });
      }
    }
    return out;
  };

  const reset = () => {
    const st = s.current;
    st.px = WIDTH / 2 - PADDLE_W / 2;
    st.bricks = buildBricks();
    st.bx = st.px + PADDLE_W / 2; st.by = HEIGHT - 60;
    st.stuck = true;
    st.running = true;
    st.score = 0; st.lives = 3; st.level = 1;
    setScore(0); setLives(3); setLevel(1);
    setGameOver(false); setStarted(true);
  };

  const launchBall = () => {
    const st = s.current;
    if (st.stuck && st.running) {
      st.stuck = false;
      st.bvx = (Math.random() < 0.5 ? -1 : 1) * 3.5;
      st.bvy = -(3.5 + st.level * 0.3);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const brickW = (WIDTH - BRICK_GAP * (COLS + 1)) / COLS;

    const loop = () => {
      const st = s.current;

      if (st.running) {
        if (st.left) st.px -= 7;
        if (st.right) st.px += 7;
        st.px = Math.max(0, Math.min(WIDTH - PADDLE_W, st.px));

        if (st.stuck) {
          st.bx = st.px + PADDLE_W / 2;
          st.by = HEIGHT - 42;
        } else {
          st.bx += st.bvx;
          st.by += st.bvy;
          // Walls
          if (st.bx < BALL_R) { st.bx = BALL_R; st.bvx *= -1; }
          if (st.bx > WIDTH - BALL_R) { st.bx = WIDTH - BALL_R; st.bvx *= -1; }
          if (st.by < BALL_R) { st.by = BALL_R; st.bvy *= -1; }
          // Paddle
          if (st.by + BALL_R > HEIGHT - 30 && st.by < HEIGHT - 18 &&
              st.bx > st.px && st.bx < st.px + PADDLE_W && st.bvy > 0) {
            st.bvy *= -1;
            const hit = (st.bx - (st.px + PADDLE_W / 2)) / (PADDLE_W / 2);
            st.bvx = hit * 5;
            st.by = HEIGHT - 30 - BALL_R;
          }
          // Bottom — lose life
          if (st.by > HEIGHT + 10) {
            st.lives -= 1;
            setLives(st.lives);
            if (st.lives <= 0) { die(st); }
            else { st.stuck = true; }
          }
          // Bricks
          for (const b of st.bricks) {
            if (!b.alive) continue;
            if (st.bx + BALL_R > b.x && st.bx - BALL_R < b.x + brickW &&
                st.by + BALL_R > b.y && st.by - BALL_R < b.y + BRICK_H) {
              b.alive = false;
              st.score += (ROWS - b.row) * 10;
              // Bounce: decide axis by overlap
              const overlapX = Math.min(st.bx + BALL_R - b.x, b.x + brickW - (st.bx - BALL_R));
              const overlapY = Math.min(st.by + BALL_R - b.y, b.y + BRICK_H - (st.by - BALL_R));
              if (overlapX < overlapY) st.bvx *= -1; else st.bvy *= -1;
              break;
            }
          }
          // Level clear
          if (st.bricks.every((b) => !b.alive)) {
            st.level += 1;
            setLevel(st.level);
            st.bricks = buildBricks();
            st.stuck = true;
          }
        }

        if (performance.now() - st.lastSync > 80) {
          st.lastSync = performance.now();
          setScore(st.score);
        }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#0a0608";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const palette = ["#d63d3d", "#ff6b1a", "#ffd060", "#7fd650", "#5fc8e0"];
      for (const b of st.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = palette[b.row % palette.length];
        ctx.fillRect(b.x, b.y, brickW, BRICK_H);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(b.x, b.y, brickW, 3);
      }

      // Paddle
      ctx.fillStyle = "#f5e8d0";
      ctx.fillRect(st.px, HEIGHT - 30, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#b8a088";
      ctx.fillRect(st.px, HEIGHT - 30, PADDLE_W, 3);

      // Ball
      ctx.fillStyle = "#ffd060";
      ctx.beginPath();
      ctx.arc(st.bx, st.by, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      if (st.stuck && st.running) {
        ctx.fillStyle = "#b8a088";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Click or SPACE to launch", WIDTH / 2, HEIGHT - 70);
        ctx.textAlign = "start";
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const die = (st: typeof s.current) => {
    if (!st.running) return;
    st.running = false;
    setScore(st.score);
    if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("breakout-highscore", String(st.score)); }
    setGameOver(true);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = true;
      if (e.code === "Space") {
        e.preventDefault();
        if (!started || gameOver) { reset(); return; }
        launchBall();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    s.current.px = Math.max(0, Math.min(WIDTH - PADDLE_W, x - PADDLE_W / 2));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{String(score).padStart(5, "0")}</span></span>
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--foreground)]">{level}</span></span>
        <span><span className="text-[var(--muted)]">LIVES </span><span className="text-[#ffd060]">{"● ".repeat(Math.max(0, lives))}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>
      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onMouseMove={onMove} onMouseDown={launchBall}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-pointer" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">{gameOver ? "GAME OVER" : "BREAKOUT"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE: <span className="text-[var(--accent)]">{score}</span></p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "TRY AGAIN" : "START"}</button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">Mouse or ← → to move · click/SPACE to launch</p>
          </div>
        )}
      </div>
      <div className="sm:hidden flex gap-2 mt-2">
        <button className="pixel-edge px-6 py-3 bg-[var(--surface-2)] rounded text-xl" onTouchStart={() => (s.current.left = true)} onTouchEnd={() => (s.current.left = false)}>◀</button>
        <button className="pixel-edge px-6 py-3 bg-[var(--accent)] text-[var(--background)] rounded" onTouchStart={launchBall}>LAUNCH</button>
        <button className="pixel-edge px-6 py-3 bg-[var(--surface-2)] rounded text-xl" onTouchStart={() => (s.current.right = true)} onTouchEnd={() => (s.current.right = false)}>▶</button>
      </div>
    </div>
  );
}
