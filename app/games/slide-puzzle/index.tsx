"use client";

import { useEffect, useState } from "react";

type Size = 3 | 4 | 5;

function solvedBoard(n: Size): number[] {
  const arr = Array.from({ length: n * n }, (_, i) => i + 1);
  arr[arr.length - 1] = 0; // 0 = empty
  return arr;
}

function shuffle(n: Size, presses = 200): number[] {
  let board = solvedBoard(n);
  let empty = board.indexOf(0);
  let lastEmpty = -1;
  for (let i = 0; i < presses; i++) {
    const ex = empty % n, ey = (empty / n) | 0;
    const neighbors: number[] = [];
    if (ex > 0) neighbors.push(empty - 1);
    if (ex < n - 1) neighbors.push(empty + 1);
    if (ey > 0) neighbors.push(empty - n);
    if (ey < n - 1) neighbors.push(empty + n);
    const pool = neighbors.filter((idx) => idx !== lastEmpty);
    const pick = (pool.length ? pool : neighbors)[Math.floor(Math.random() * (pool.length ? pool.length : neighbors.length))];
    board = board.slice();
    board[empty] = board[pick]; board[pick] = 0;
    lastEmpty = empty;
    empty = pick;
  }
  return board;
}

function isSolved(board: number[]): boolean {
  for (let i = 0; i < board.length - 1; i++) if (board[i] !== i + 1) return false;
  return board[board.length - 1] === 0;
}

export default function SlidePuzzle() {
  const [size, setSize] = useState<Size>(4);
  const [board, setBoard] = useState<number[]>(() => shuffle(4));
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<Record<string, { moves: number; seconds: number }>>({});

  useEffect(() => {
    const raw = localStorage.getItem("slidepuzzle-best");
    if (raw) try { setBest(JSON.parse(raw)); } catch {}
  }, []);

  useEffect(() => {
    if (!running || won) return;
    const id = window.setInterval(() => setSeconds((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, won]);

  const newGame = (n: Size = size) => {
    setSize(n);
    setBoard(shuffle(n));
    setMoves(0); setSeconds(0); setRunning(true); setWon(false);
  };

  const click = (idx: number) => {
    if (won) return;
    const n = size;
    const empty = board.indexOf(0);
    const ex = empty % n, ey = (empty / n) | 0;
    const ix = idx % n, iy = (idx / n) | 0;
    const adj = (Math.abs(ex - ix) + Math.abs(ey - iy)) === 1;
    if (!adj) return;
    const nb = board.slice();
    nb[empty] = nb[idx]; nb[idx] = 0;
    setBoard(nb);
    const m = moves + 1; setMoves(m);
    if (isSolved(nb)) {
      setWon(true); setRunning(false);
      const key = `${size}`;
      const prev = best[key];
      if (!prev || m < prev.moves || (m === prev.moves && seconds < prev.seconds)) {
        const next = { ...best, [key]: { moves: m, seconds } };
        setBest(next);
        localStorage.setItem("slidepuzzle-best", JSON.stringify(next));
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      const empty = board.indexOf(0);
      const n = size;
      const ex = empty % n, ey = (empty / n) | 0;
      let target = -1;
      if (e.code === "ArrowLeft" && ex < n - 1) target = empty + 1;
      if (e.code === "ArrowRight" && ex > 0) target = empty - 1;
      if (e.code === "ArrowUp" && ey < n - 1) target = empty + n;
      if (e.code === "ArrowDown" && ey > 0) target = empty - n;
      if (target >= 0) { e.preventDefault(); click(target); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, won]);

  const tilePx = size === 3 ? 100 : size === 4 ? 80 : 64;
  const formatTime = (s: number) => `${(s / 60 | 0).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const bestRec = best[`${size}`];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[420px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">MOVES </span><span className="text-[var(--crt-green)]">{moves}</span></span>
        <span><span className="text-[var(--muted)]">TIME </span><span className="text-[var(--foreground)]">{formatTime(seconds)}</span></span>
        {bestRec && <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{bestRec.moves}/{formatTime(bestRec.seconds)}</span></span>}
      </div>

      <div className="flex gap-2">
        {([3, 4, 5] as Size[]).map((n) => (
          <button key={n} onClick={() => newGame(n)} className={`pixel-edge px-3 py-1.5 rounded font-[family-name:var(--font-mono)] text-base ${size === n ? "bg-[var(--accent)] text-[var(--background)]" : "bg-[var(--surface-2)]"}`}>
            {n}×{n}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-2 inline-grid"
          style={{ gridTemplateColumns: `repeat(${size}, ${tilePx}px)`, gap: 4 }}
        >
          {board.map((v, idx) => (
            <button
              key={idx}
              onClick={() => click(idx)}
              disabled={v === 0 || won}
              style={{ width: tilePx, height: tilePx }}
              className={`pixel-edge rounded font-[family-name:var(--font-display)] text-lg sm:text-xl transition-all ${
                v === 0 ? "invisible" : "bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-hot)]"
              }`}
            >
              {v || ""}
            </button>
          ))}
        </div>

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)] mb-2">SOLVED!</h2>
            <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-1">{moves} moves · {formatTime(seconds)}</p>
            <button onClick={() => newGame(size)} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEW PUZZLE</button>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Slide tiles into the empty space to put them in order 1-{size * size - 1}. Click an adjacent tile or use the arrow keys.
      </p>
    </div>
  );
}
