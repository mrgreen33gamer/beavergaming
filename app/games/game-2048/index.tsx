"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SIZE = 4;

type Grid = number[][];

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#3a2218", fg: "#f5e8d0" },
  4: { bg: "#4a2e1f", fg: "#f5e8d0" },
  8: { bg: "#ff8a3d", fg: "#1a0e0a" },
  16: { bg: "#ff6b1a", fg: "#1a0e0a" },
  32: { bg: "#ff5050", fg: "#fff" },
  64: { bg: "#d63d3d", fg: "#fff" },
  128: { bg: "#ffd060", fg: "#1a0e0a" },
  256: { bg: "#ffc040", fg: "#1a0e0a" },
  512: { bg: "#ffb020", fg: "#1a0e0a" },
  1024: { bg: "#7fd650", fg: "#1a0e0a" },
  2048: { bg: "#5fc8e0", fg: "#1a0e0a" },
};

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function clone(g: Grid): Grid {
  return g.map((row) => [...row]);
}

function addRandomTile(g: Grid): boolean {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) empties.push([r, c]);
  if (empties.length === 0) return false;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

// Slide+merge one row to the left. Returns [newRow, gainedScore, moved]
function slideRow(row: number[]): [number[], number, boolean] {
  const nonZero = row.filter((v) => v !== 0);
  const merged: number[] = [];
  let gained = 0;
  for (let i = 0; i < nonZero.length; i++) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const v = nonZero[i] * 2;
      merged.push(v);
      gained += v;
      i++;
    } else {
      merged.push(nonZero[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  const moved = merged.some((v, i) => v !== row[i]);
  return [merged, gained, moved];
}

function transpose(g: Grid): Grid {
  const out = emptyGrid();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) out[c][r] = g[r][c];
  return out;
}
function reverseRows(g: Grid): Grid {
  return g.map((row) => [...row].reverse());
}

function move(g: Grid, dir: "left" | "right" | "up" | "down"): [Grid, number, boolean] {
  let work = clone(g);
  if (dir === "up") work = transpose(work);
  if (dir === "down") work = reverseRows(transpose(work));
  if (dir === "right") work = reverseRows(work);

  let gained = 0;
  let moved = false;
  work = work.map((row) => {
    const [newRow, g2, m] = slideRow(row);
    gained += g2;
    if (m) moved = true;
    return newRow;
  });

  if (dir === "up") work = transpose(work);
  if (dir === "down") work = transpose(reverseRows(work));
  if (dir === "right") work = reverseRows(work);
  return [work, gained, moved];
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (g[r][c] === 0) return true;
    if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
    if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
  }
  return false;
}

export default function Game2048() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const gridRef = useRef<Grid>(emptyGrid());
  const overRef = useRef(false);

  useEffect(() => {
    const b = localStorage.getItem("2048-best");
    if (b) setBest(parseInt(b, 10));
    newGame();
   
  }, []);

  const newGame = () => {
    const g = emptyGrid();
    addRandomTile(g);
    addRandomTile(g);
    gridRef.current = g;
    overRef.current = false;
    setGrid(clone(g));
    setScore(0);
    setOver(false);
    setWon(false);
  };

  const doMove = useCallback((dir: "left" | "right" | "up" | "down") => {
    if (overRef.current) return;
    const [moved, gained, didMove] = move(gridRef.current, dir);
    if (!didMove) return;
    addRandomTile(moved);
    gridRef.current = moved;
    setGrid(clone(moved));
    setScore((sc) => {
      const ns = sc + gained;
      if (ns > best) { setBest(ns); localStorage.setItem("2048-best", String(ns)); }
      return ns;
    });
    if (!won && moved.some((row) => row.some((v) => v >= 2048))) setWon(true);
    if (!canMove(moved)) { overRef.current = true; setOver(true); }
  }, [best, won]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
        KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
      };
      if (e.code in map) { e.preventDefault(); doMove(map[e.code]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // Touch swipe
  const touch = useRef({ x: 0, y: 0 });
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[420px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{best}</span></span>
        <button onClick={newGame} className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] text-base">New</button>
      </div>

      <div className="relative w-full max-w-[420px]">
        <div
          className="grid gap-2 p-2 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] select-none"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {grid.flatMap((row, r) =>
            row.map((v, c) => {
              const col = TILE_COLORS[v] ?? { bg: "#5fc8e0", fg: "#1a0e0a" };
              return (
                <div key={`${r}-${c}`} className="aspect-square rounded flex items-center justify-center font-[family-name:var(--font-display)]"
                  style={{ background: v === 0 ? "#241610" : col.bg, color: col.fg, fontSize: v >= 1024 ? "0.9rem" : v >= 128 ? "1.1rem" : "1.3rem" }}>
                  {v > 0 ? v : ""}
                </div>
              );
            })
          )}
        </div>

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-2">GAME OVER</h2>
            <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-3">SCORE: <span className="text-[var(--accent)]">{score}</span></p>
            <button onClick={newGame} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEW GAME</button>
          </div>
        )}
        {won && !over && (
          <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
            <span className="font-[family-name:var(--font-display)] text-xs text-[#5fc8e0] bg-black/70 px-3 py-1 rounded flicker">★ 2048 REACHED! keep going ★</span>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Arrow keys / WASD (or swipe) to slide tiles. Matching numbers merge. Reach 2048!
      </p>

      <div className="sm:hidden grid grid-cols-3 gap-2">
        <div /><button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => doMove("up")}>▲</button><div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => doMove("left")}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => doMove("down")}>▼</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => doMove("right")}>▶</button>
      </div>
    </div>
  );
}
