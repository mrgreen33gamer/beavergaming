"use client";

import { useEffect, useRef, useState } from "react";

const COLS = 12;
const ROWS = 12;
const MINES = 24;

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number;
};

const NUM_COLORS = ["", "#5fc8e0", "#7fd650", "#ff8a3d", "#ff6b1a", "#d63d3d", "#c45ed6", "#f5e8d0", "#b8a088"];

function buildGrid(safeR: number, safeC: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }))
  );
  // Place mines, avoiding the first-clicked cell + neighbors
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (grid[r][c].mine) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    grid[r][c].mine = true;
    placed++;
  }
  // Counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].mine) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].mine) n++;
      }
      grid[r][c].count = n;
    }
  }
  return grid;
}

export default function Minesweeper() {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flags, setFlags] = useState(0);
  const [time, setTime] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const running = useRef(false);

  useEffect(() => {
    const b = localStorage.getItem("minesweeper-best");
    if (b) setBest(parseInt(b, 10));
  }, []);

  useEffect(() => {
    if (!running.current) return;
    const id = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [started, over]);

  const newGame = () => {
    setGrid([]);
    setStarted(false);
    setOver(false);
    setWon(false);
    setFlags(0);
    setTime(0);
    running.current = false;
  };

  const floodReveal = (g: Cell[][], r: number, c: number) => {
    const stack: [number, number][] = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      const cell = g[cr][cc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.count === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr, nc = cc + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !g[nr][nc].revealed) stack.push([nr, nc]);
        }
      }
    }
  };

  const checkWin = (g: Cell[][]) => {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!g[r][c].mine && !g[r][c].revealed) return false;
    }
    return true;
  };

  const reveal = (r: number, c: number) => {
    if (over) return;
    let g = grid;
    if (!started) {
      g = buildGrid(r, c);
      setStarted(true);
      running.current = true;
    } else {
      g = grid.map((row) => row.map((cell) => ({ ...cell })));
    }
    const cell = g[r][c];
    if (cell.flagged || cell.revealed) { setGrid(g); return; }
    if (cell.mine) {
      // Reveal all mines
      for (const row of g) for (const cc of row) if (cc.mine) cc.revealed = true;
      setGrid(g);
      setOver(true);
      running.current = false;
      return;
    }
    floodReveal(g, r, c);
    setGrid(g);
    if (checkWin(g)) {
      setOver(true);
      setWon(true);
      running.current = false;
      const t = time;
      if (best === null || t < best) { setBest(t); localStorage.setItem("minesweeper-best", String(t)); }
    }
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (over || !started) return;
    const g = grid.map((row) => row.map((cell) => ({ ...cell })));
    const cell = g[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    setGrid(g);
    setFlags(g.flat().filter((cc) => cc.flagged).length);
  };

  const displayGrid = grid.length ? grid : Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, count: 0 } as Cell)));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[440px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">💣 </span><span className="text-[#d63d3d]">{MINES - flags}</span></span>
        <span><span className="text-[var(--muted)]">TIME </span><span className="text-[var(--accent)]">{time}s</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--crt-green)]">{best === null ? "—" : `${best}s`}</span></span>
        <button onClick={newGame} className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] text-base">New</button>
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="grid gap-0.5 p-2 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] select-none"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {displayGrid.flatMap((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => reveal(r, c)}
                onContextMenu={(e) => toggleFlag(e, r, c)}
                className={`aspect-square rounded-sm flex items-center justify-center font-[family-name:var(--font-mono)] text-sm sm:text-base font-bold ${
                  cell.revealed
                    ? cell.mine ? "bg-[#d63d3d]" : "bg-[var(--surface-2)]"
                    : "bg-[var(--border)] hover:bg-[#5a3a28] active:bg-[#6a4a30]"
                }`}
                style={{ color: cell.revealed && !cell.mine ? NUM_COLORS[cell.count] : "#f5e8d0" }}
              >
                {cell.flagged && !cell.revealed ? "🚩" : cell.revealed ? (cell.mine ? "💥" : cell.count > 0 ? cell.count : "") : ""}
              </button>
            ))
          )}
        </div>

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center">
              <h2 className="font-[family-name:var(--font-display)] text-lg mb-2" style={{ color: won ? "#7fd650" : "#d63d3d" }}>
                {won ? "CLEARED!" : "BOOM!"}
              </h2>
              {won && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">{time}s</p>}
              {won && best === time && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ BEST TIME ★</p>}
              <button onClick={newGame} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEW GAME</button>
            </div>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Left-click to reveal, right-click to flag a mine. First click is always safe. Clear every safe tile to win.
      </p>
    </div>
  );
}
