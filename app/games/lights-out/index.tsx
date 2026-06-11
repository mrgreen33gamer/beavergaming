"use client";

import { useEffect, useState } from "react";

const SIZE = 5;

type Grid = boolean[][];

function emptyGrid(): Grid { return Array.from({ length: SIZE }, () => Array(SIZE).fill(false)); }

function toggle(g: Grid, r: number, c: number): Grid {
  const out = g.map((row) => [...row]);
  const flip = (rr: number, cc: number) => { if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out[rr][cc] = !out[rr][cc]; };
  flip(r, c); flip(r - 1, c); flip(r + 1, c); flip(r, c - 1); flip(r, c + 1);
  return out;
}

function randomBoard(level: number): Grid {
  // Generate solvable board by applying N random presses to an empty grid.
  let g = emptyGrid();
  const presses = 4 + level * 2;
  for (let i = 0; i < presses; i++) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);
    g = toggle(g, r, c);
  }
  // Avoid trivially-solved boards
  if (g.every((row) => row.every((v) => !v))) g = toggle(g, 2, 2);
  return g;
}

export default function LightsOut() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [level, setLevel] = useState(1);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [bestLevel, setBestLevel] = useState(1);

  useEffect(() => {
    const b = localStorage.getItem("lightsout-best");
    if (b) setBestLevel(parseInt(b, 10));
    newPuzzle(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newPuzzle = (lv: number) => {
    setLevel(lv);
    setGrid(randomBoard(lv));
    setMoves(0);
    setSolved(false);
  };

  const press = (r: number, c: number) => {
    if (solved) return;
    const next = toggle(grid, r, c);
    setGrid(next);
    setMoves((m) => m + 1);
    if (next.every((row) => row.every((v) => !v))) {
      setSolved(true);
      if (level >= bestLevel) {
        setBestLevel(level + 1);
        localStorage.setItem("lightsout-best", String(level + 1));
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[380px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--crt-green)]">{level}</span></span>
        <span><span className="text-[var(--muted)]">MOVES </span><span className="text-[var(--foreground)]">{moves}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{bestLevel}</span></span>
      </div>

      <div className="relative w-full max-w-[380px]">
        <div className="grid gap-2 p-3 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)]" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {grid.flatMap((row, r) => row.map((on, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => press(r, c)}
              className="aspect-square rounded transition-all duration-100 pixel-edge"
              style={{
                background: on ? "#ffd060" : "#3a2218",
                boxShadow: on ? "inset 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,208,96,0.5)" : "inset 0 2px 4px rgba(0,0,0,0.4)",
              }}
              aria-label={`light ${r},${c}`}
            />
          )))}
        </div>

        {solved && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)] mb-2">SOLVED!</h2>
            <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-3">{moves} moves</p>
            <button onClick={() => newPuzzle(level + 1)} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEXT LEVEL →</button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={() => newPuzzle(level)} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ Reset Level</button>
        <button onClick={() => newPuzzle(1)} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">⏮ Restart</button>
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click any tile to toggle it and its four neighbors. Turn every light off to win. Each level gets harder.
      </p>
    </div>
  );
}
