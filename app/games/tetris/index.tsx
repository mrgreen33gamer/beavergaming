"use client";

import { useEffect, useRef, useState } from "react";
import { useCartridge } from "@/lib/platform/useCartridge";

const COLS = 10;
const ROWS = 20;
const CELL = 22;
const WIDTH = COLS * CELL;   // 220
const HEIGHT = ROWS * CELL;  // 440

const COLORS = ["", "#5fc8e0", "#ffd060", "#c45ed6", "#7fd650", "#d63d3d", "#ff6b1a", "#5a8cff"];

// Tetromino shapes (each rotation state computed at runtime)
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],                 // I -> color 1
  [[2, 2], [2, 2]],               // O -> 2
  [[0, 3, 0], [3, 3, 3]],         // T -> 3
  [[0, 4, 4], [4, 4, 0]],         // S -> 4
  [[5, 5, 0], [0, 5, 5]],         // Z -> 5
  [[6, 0, 0], [6, 6, 6]],         // L -> 6 (J-ish)
  [[0, 0, 7], [7, 7, 7]],         // J -> 7
];

type Piece = { shape: number[][]; x: number; y: number };

function rotate(shape: number[][]): number[][] {
  const rows = shape.length, cols = shape[0].length;
  const out: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c][rows - 1 - r] = shape[r][c];
  return out;
}

function randomPiece(): Piece {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)].map((row) => [...row]);
  return { shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
}

export default function Tetris() {
  // Ref'd because the death handler runs inside the canvas loop, which closes
  // over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("tetris");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const s = useRef({
    board: [] as number[][],
    piece: null as Piece | null,
    running: false,
    dropTimer: 0,
    dropInterval: 48,
    score: 0, lines: 0, level: 1,
  });

  useEffect(() => {
    const saved = localStorage.getItem("tetris-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const collides = (board: number[][], piece: Piece, nx: number, ny: number, shape?: number[][]): boolean => {
    const sh = shape ?? piece.shape;
    for (let r = 0; r < sh.length; r++) {
      for (let c = 0; c < sh[r].length; c++) {
        if (!sh[r][c]) continue;
        const x = nx + c, y = ny + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  };

  const merge = (st: typeof s.current) => {
    const p = st.piece!;
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c] && p.y + r >= 0) st.board[p.y + r][p.x + c] = p.shape[r][c];
      }
    }
    // Clear lines
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (st.board[r].every((v) => v !== 0)) {
        st.board.splice(r, 1);
        st.board.unshift(Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      const pts = [0, 100, 300, 500, 800][cleared] * st.level;
      st.score += pts;
      st.lines += cleared;
      st.level = 1 + Math.floor(st.lines / 10);
      st.dropInterval = Math.max(8, 48 - (st.level - 1) * 4);
      setScore(st.score); setLines(st.lines); setLevel(st.level);
    }
    // New piece
    st.piece = randomPiece();
    if (collides(st.board, st.piece, st.piece.x, st.piece.y)) {
      die(st);
    }
  };

  const reset = () => {
    const st = s.current;
    st.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    st.piece = randomPiece();
    st.running = true;
    st.dropTimer = 0;
    st.dropInterval = 48;
    st.score = 0; st.lines = 0; st.level = 1;
    setScore(0); setLines(0); setLevel(1);
    setGameOver(false); setStarted(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;

      if (st.running && st.piece) {
        st.dropTimer++;
        if (st.dropTimer >= st.dropInterval) {
          st.dropTimer = 0;
          if (!collides(st.board, st.piece, st.piece.x, st.piece.y + 1)) {
            st.piece.y++;
          } else {
            merge(st);
          }
        }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#0a0608";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Grid lines
      ctx.strokeStyle = "#1a1410";
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, HEIGHT); ctx.stroke(); }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(WIDTH, y * CELL); ctx.stroke(); }

      const drawCell = (x: number, y: number, color: number) => {
        ctx.fillStyle = COLORS[color];
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 3);
      };

      if (st.board.length) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (st.board[r][c]) drawCell(c, r, st.board[r][c]);
      }
      if (st.piece) {
        const p = st.piece;
        // Ghost
        let gy = p.y;
        while (!collides(st.board, p, p.x, gy + 1)) gy++;
        for (let r = 0; r < p.shape.length; r++) for (let c = 0; c < p.shape[r].length; c++) {
          if (p.shape[r][c] && gy + r >= 0) {
            ctx.fillStyle = "rgba(245,232,208,0.12)";
            ctx.fillRect((p.x + c) * CELL + 1, (gy + r) * CELL + 1, CELL - 2, CELL - 2);
          }
        }
        // Active piece
        for (let r = 0; r < p.shape.length; r++) for (let c = 0; c < p.shape[r].length; c++) {
          if (p.shape[r][c] && p.y + r >= 0) drawCell(p.x + c, p.y + r, p.shape[r][c]);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const die = (st: typeof s.current) => {
    st.running = false;
    setScore(st.score);
    if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("tetris-highscore", String(st.score)); }
    hostRef.current.reportScore(st.score);
    setGameOver(true);
  };

  const hardDrop = (st: typeof s.current) => {
    if (!st.piece) return;
    while (!collides(st.board, st.piece, st.piece.x, st.piece.y + 1)) { st.piece.y++; st.score += 2; }
    merge(st);
    setScore(st.score);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = s.current;
      if (!started || gameOver) {
        if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); reset(); }
        return;
      }
      if (!st.piece || !st.running) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); if (!collides(st.board, st.piece, st.piece.x - 1, st.piece.y)) st.piece.x--; }
      else if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); if (!collides(st.board, st.piece, st.piece.x + 1, st.piece.y)) st.piece.x++; }
      else if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); if (!collides(st.board, st.piece, st.piece.x, st.piece.y + 1)) { st.piece.y++; st.score++; setScore(st.score); } }
      else if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        const rotated = rotate(st.piece.shape);
        // wall kick attempts
        for (const dx of [0, -1, 1, -2, 2]) {
          if (!collides(st.board, st.piece, st.piece.x + dx, st.piece.y, rotated)) { st.piece.shape = rotated; st.piece.x += dx; break; }
        }
      }
      else if (e.code === "Space") { e.preventDefault(); hardDrop(st); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  const tap = (action: "left" | "right" | "down" | "rotate" | "drop") => {
    const st = s.current;
    if (!st.piece || !st.running) return;
    if (action === "left" && !collides(st.board, st.piece, st.piece.x - 1, st.piece.y)) st.piece.x--;
    if (action === "right" && !collides(st.board, st.piece, st.piece.x + 1, st.piece.y)) st.piece.x++;
    if (action === "down" && !collides(st.board, st.piece, st.piece.x, st.piece.y + 1)) st.piece.y++;
    if (action === "rotate") {
      const rotated = rotate(st.piece.shape);
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!collides(st.board, st.piece, st.piece.x + dx, st.piece.y, rotated)) { st.piece.shape = rotated; st.piece.x += dx; break; }
      }
    }
    if (action === "drop") hardDrop(st);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[300px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">SCORE</span><br/><span className="text-[var(--crt-green)] text-xl">{score}</span></span>
        <span className="text-center"><span className="text-[var(--muted)]">LINES</span><br/><span className="text-[var(--foreground)] text-xl">{lines}</span></span>
        <span className="text-right"><span className="text-[var(--muted)]">LVL</span><br/><span className="text-[var(--accent)] text-xl">{level}</span></span>
      </div>

      <div className="relative" style={{ width: WIDTH, maxWidth: "60vw" }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded border-2 border-[var(--border)]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }} />
        {(!started || gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-3 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">{gameOver ? "GAME OVER" : "TETRIS"}</h2>
            {gameOver && <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-1">{score}</p>}
            {gameOver && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--accent)] mb-2 flicker">★ BEST ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-4 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">{gameOver ? "AGAIN" : "START"}</button>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--muted)] text-center max-w-xs">← → move · ↑ rotate · ↓ soft drop · SPACE hard drop · BEST {highScore}</p>

      <div className="sm:hidden grid grid-cols-4 gap-2">
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tap("left")}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tap("rotate")}>↻</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tap("right")}>▶</button>
        <button className="pixel-edge p-3 bg-[var(--accent)] text-[var(--background)] rounded" onClick={() => tap("drop")}>⤓</button>
      </div>
    </div>
  );
}
