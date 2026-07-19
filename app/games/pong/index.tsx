"use client";

import { useEffect, useRef, useState } from "react";
import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 600;
const HEIGHT = 400;
const PADDLE_W = 12;
const PADDLE_H = 70;
const BALL_R = 7;
const WIN_SCORE = 7;

export default function Pong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const { host } = useCartridge("pong");

  const s = useRef({
    py: HEIGHT / 2 - PADDLE_H / 2,
    ay: HEIGHT / 2 - PADDLE_H / 2,
    bx: WIDTH / 2, by: HEIGHT / 2,
    bvx: 4, bvy: 2,
    up: false, down: false,
    running: false,
    pScore: 0, aScore: 0,
    targetY: HEIGHT / 2,
  });

  const serve = (dir: number) => {
    const st = s.current;
    st.bx = WIDTH / 2; st.by = HEIGHT / 2;
    const angle = (Math.random() - 0.5) * 0.6;
    st.bvx = dir * 4.2;
    st.bvy = Math.sin(angle) * 4;
  };

  const reset = () => {
    const st = s.current;
    st.py = HEIGHT / 2 - PADDLE_H / 2;
    st.ay = HEIGHT / 2 - PADDLE_H / 2;
    st.pScore = 0; st.aScore = 0;
    st.running = true;
    serve(Math.random() < 0.5 ? 1 : -1);
    setPlayerScore(0); setAiScore(0);
    setGameOver(false); setWon(false); setStarted(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;

      if (st.running) {
        // Player paddle
        if (st.up) st.py -= 6;
        if (st.down) st.py += 6;
        st.py = Math.max(0, Math.min(HEIGHT - PADDLE_H, st.py));

        // AI paddle — tracks ball with a slight lag/deadzone
        const aiCenter = st.ay + PADDLE_H / 2;
        if (st.by < aiCenter - 12) st.ay -= 4.2;
        else if (st.by > aiCenter + 12) st.ay += 4.2;
        st.ay = Math.max(0, Math.min(HEIGHT - PADDLE_H, st.ay));

        // Ball
        st.bx += st.bvx;
        st.by += st.bvy;
        // Top/bottom bounce
        if (st.by < BALL_R) { st.by = BALL_R; st.bvy *= -1; }
        if (st.by > HEIGHT - BALL_R) { st.by = HEIGHT - BALL_R; st.bvy *= -1; }

        // Player paddle collision (left)
        if (st.bx - BALL_R < PADDLE_W + 8 && st.bx > 0 &&
            st.by > st.py && st.by < st.py + PADDLE_H && st.bvx < 0) {
          st.bvx *= -1.06;
          const hit = (st.by - (st.py + PADDLE_H / 2)) / (PADDLE_H / 2);
          st.bvy = hit * 5;
          st.bx = PADDLE_W + 8 + BALL_R;
        }
        // AI paddle collision (right)
        if (st.bx + BALL_R > WIDTH - PADDLE_W - 8 && st.bx < WIDTH &&
            st.by > st.ay && st.by < st.ay + PADDLE_H && st.bvx > 0) {
          st.bvx *= -1.06;
          const hit = (st.by - (st.ay + PADDLE_H / 2)) / (PADDLE_H / 2);
          st.bvy = hit * 5;
          st.bx = WIDTH - PADDLE_W - 8 - BALL_R;
        }
        // Clamp speed
        st.bvx = Math.max(-9, Math.min(9, st.bvx));

        // Score
        if (st.bx < -10) { st.aScore++; setAiScore(st.aScore); checkEnd(st); if (st.running) serve(1); }
        if (st.bx > WIDTH + 10) { st.pScore++; setPlayerScore(st.pScore); checkEnd(st); if (st.running) serve(-1); }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#0a0608";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Center net
      ctx.fillStyle = "#3a2218";
      for (let y = 0; y < HEIGHT; y += 24) ctx.fillRect(WIDTH / 2 - 2, y, 4, 14);
      // Paddles
      ctx.fillStyle = "#7fd650";
      ctx.fillRect(8, st.py, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#ff6b1a";
      ctx.fillRect(WIDTH - PADDLE_W - 8, st.ay, PADDLE_W, PADDLE_H);
      // Ball
      ctx.fillStyle = "#f5e8d0";
      ctx.fillRect(st.bx - BALL_R, st.by - BALL_R, BALL_R * 2, BALL_R * 2);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkEnd = (st: typeof s.current) => {
    if (st.pScore >= WIN_SCORE || st.aScore >= WIN_SCORE) {
      st.running = false;
      const playerWon = st.pScore > st.aScore;
      setWon(playerWon);
      if (playerWon) host.reportEvent("match_won");
      setGameOver(true);
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); s.current.up = true; }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); s.current.down = true; }
      if (e.code === "Space" && (!started || gameOver)) reset();
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

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
    s.current.py = Math.max(0, Math.min(HEIGHT - PADDLE_H, y - PADDLE_H / 2));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-12 w-full max-w-[600px] font-[family-name:var(--font-display)] text-2xl">
        <span className="text-[#7fd650]">{playerScore}</span>
        <span className="text-[var(--muted)] text-sm">FIRST TO {WIN_SCORE}</span>
        <span className="text-[#ff6b1a]">{aiScore}</span>
      </div>
      <div className="relative w-full max-w-[600px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onMouseMove={onMove}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-3">
              {gameOver ? (won ? "YOU WIN!" : "AI WINS") : "PONG"}
            </h2>
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {gameOver ? "PLAY AGAIN" : "START"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center">Mouse or ↑/↓ (W/S) to move your paddle</p>
          </div>
        )}
      </div>
    </div>
  );
}
