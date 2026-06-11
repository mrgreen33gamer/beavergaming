"use client";

import { useEffect, useRef, useState } from "react";

const SIZE = 8;
const COLORS = ["#d63d3d", "#7fd650", "#5fc8e0", "#ffd060", "#c45ed6", "#ff8a3d"];
const GLYPHS = ["♥", "♣", "◆", "★", "♠", "●"];
const MOVES_PER_GAME = 25;

type Grid = number[][]; // values 0..5, -1 = empty

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
}

function randNoMatch(g: Grid, r: number, c: number): number {
  while (true) {
    const v = Math.floor(Math.random() * COLORS.length);
    // Avoid creating an instant 3-in-a-row when seeding
    if (c >= 2 && g[r][c - 1] === v && g[r][c - 2] === v) continue;
    if (r >= 2 && g[r - 1][c] === v && g[r - 2][c] === v) continue;
    return v;
  }
}

function newGrid(): Grid {
  const g = emptyGrid();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) g[r][c] = randNoMatch(g, r, c);
  return g;
}

function findMatches(g: Grid): Set<string> {
  const out = new Set<string>();
  // Rows
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c <= SIZE; c++) {
      if (c < SIZE && g[r][c] === g[r][c - 1] && g[r][c] !== -1) run++;
      else {
        if (run >= 3) for (let k = c - run; k < c; k++) out.add(`${r},${k}`);
        run = 1;
      }
    }
  }
  // Cols
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r <= SIZE; r++) {
      if (r < SIZE && g[r][c] === g[r - 1][c] && g[r][c] !== -1) run++;
      else {
        if (run >= 3) for (let k = r - run; k < r; k++) out.add(`${k},${c}`);
        run = 1;
      }
    }
  }
  return out;
}

function gravity(g: Grid): boolean {
  let moved = false;
  for (let c = 0; c < SIZE; c++) {
    let write = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      if (g[r][c] !== -1) {
        if (write !== r) { g[write][c] = g[r][c]; g[r][c] = -1; moved = true; }
        write--;
      }
    }
    for (let r = write; r >= 0; r--) {
      if (g[r][c] === -1) { g[r][c] = Math.floor(Math.random() * COLORS.length); moved = true; }
    }
  }
  return moved;
}

export default function MatchThree() {
  const [grid, setGrid] = useState<Grid>(newGrid);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(MOVES_PER_GAME);
  const [highScore, setHighScore] = useState(0);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const gridRef = useRef<Grid>(grid);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => {
    const b = localStorage.getItem("match3-highscore");
    if (b) setHighScore(parseInt(b, 10));
  }, []);

  const newGame = () => {
    const g = newGrid();
    gridRef.current = g;
    setGrid(g); setSelected(null); setScore(0); setMovesLeft(MOVES_PER_GAME); setOver(false); setBusy(false); setPopping(new Set());
  };

  const swap = (a: { r: number; c: number }, b: { r: number; c: number }) => {
    const g = gridRef.current.map((row) => [...row]);
    [g[a.r][a.c], g[b.r][b.c]] = [g[b.r][b.c], g[a.r][a.c]];
    return g;
  };

  const resolveCascade = async (initial: Grid) => {
    setBusy(true);
    let g = initial.map((row) => [...row]);
    let totalCleared = 0;
    let cascadeMult = 1;
    while (true) {
      const matches = findMatches(g);
      if (matches.size === 0) break;
      // Show pop animation
      setPopping(matches);
      const popped = g.map((row) => [...row]);
      for (const key of matches) {
        const [r, c] = key.split(",").map(Number);
        popped[r][c] = -1;
      }
      const gained = matches.size * 10 * cascadeMult;
      totalCleared += gained;
      setScore((s) => s + gained);
      gridRef.current = popped; setGrid(popped);
      await new Promise((res) => setTimeout(res, 220));
      setPopping(new Set());
      // Apply gravity + refill
      const g2 = popped.map((row) => [...row]);
      gravity(g2);
      gridRef.current = g2; setGrid(g2);
      g = g2;
      cascadeMult++;
      await new Promise((res) => setTimeout(res, 180));
    }
    setBusy(false);
    return totalCleared;
  };

  const cellClick = (r: number, c: number) => {
    if (busy || over) return;
    if (!selected) { setSelected({ r, c }); return; }
    if (selected.r === r && selected.c === c) { setSelected(null); return; }
    const adjacent = Math.abs(selected.r - r) + Math.abs(selected.c - c) === 1;
    if (!adjacent) { setSelected({ r, c }); return; }
    // Attempt swap
    const swapped = swap(selected, { r, c });
    const matches = findMatches(swapped);
    if (matches.size === 0) {
      // Bounce back — animate selection
      setSelected(null);
      return;
    }
    gridRef.current = swapped; setGrid(swapped); setSelected(null);
    setMovesLeft((m) => m - 1);
    (async () => {
      await resolveCascade(swapped);
      // After cascade, check if no moves remain (rare); otherwise wait for moves
      if (movesLeft - 1 <= 0) {
        // Slight delay so the user sees the final state
        setTimeout(() => endGame(), 200);
      }
    })();
  };

  const endGame = () => {
    setOver(true);
    setScore((s) => {
      if (s > highScore) { setHighScore(s); localStorage.setItem("match3-highscore", String(s)); }
      return s;
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[440px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">MOVES </span><span className={movesLeft <= 5 ? "text-[#d63d3d]" : "text-[var(--foreground)]"}>{movesLeft}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="grid gap-1 p-2 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)]" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {grid.flatMap((row, r) => row.map((v, c) => {
            const sel = selected && selected.r === r && selected.c === c;
            const pop = popping.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => cellClick(r, c)}
                disabled={busy || over}
                className="aspect-square pixel-edge rounded flex items-center justify-center transition-all duration-150 font-bold text-xl sm:text-2xl"
                style={{
                  background: v === -1 ? "transparent" : COLORS[v],
                  color: "rgba(0,0,0,0.55)",
                  transform: sel ? "scale(0.92)" : pop ? "scale(1.3)" : "scale(1)",
                  opacity: pop ? 0 : 1,
                  boxShadow: sel ? "0 0 0 3px #f5e8d0, 0 0 14px rgba(255,255,255,0.4)" : "inset 0 -3px 0 rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.18)",
                }}
              >
                {v >= 0 ? GLYPHS[v] : ""}
              </button>
            );
          }))}
        </div>

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">OUT OF MOVES</h2>
            <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE <span className="text-[var(--accent)]">{score}</span></p>
            {score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={newGame} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">PLAY AGAIN</button>
          </div>
        )}
      </div>

      <button onClick={newGame} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ New Game</button>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click two adjacent gems to swap them — match three or more in a row to clear them. Cascades multiply points!
      </p>
    </div>
  );
}
