"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WORD_THEMES: { name: string; words: string[] }[] = [
  { name: "ARCADE", words: ["PIXEL", "JOYSTICK", "ARCADE", "COIN", "HIGHSCORE", "LASER", "LEVEL", "BOSS"] },
  { name: "ANIMALS", words: ["BEAVER", "OTTER", "EAGLE", "FOX", "WOLF", "TIGER", "BEAR", "HAWK"] },
  { name: "SPACE", words: ["PLANET", "ROCKET", "COMET", "ORBIT", "MOON", "STAR", "GALAXY", "ALIEN"] },
  { name: "OCEAN", words: ["SHARK", "WAVE", "REEF", "WHALE", "CORAL", "OCTOPUS", "TIDE", "SAND"] },
  { name: "FANTASY", words: ["DRAGON", "WIZARD", "ELF", "POTION", "SCROLL", "KNIGHT", "MAGIC", "QUEST"] },
];

const GRID_SIZE = 12;
const DIRS: [number, number][] = [
  [0, 1], [1, 0], [1, 1], [-1, 1],
  [0, -1], [-1, 0], [-1, -1], [1, -1],
];

type Placement = { word: string; r: number; c: number; dir: [number, number]; cells: string[] };

function key(r: number, c: number) { return `${r},${c}`; }

function buildGrid(words: string[]): { grid: string[][]; placements: Placement[] } {
  const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(""));
  const placements: Placement[] = [];
  // Sort longest first for fitting
  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (const w of sorted) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      const r0 = Math.floor(Math.random() * GRID_SIZE);
      const c0 = Math.floor(Math.random() * GRID_SIZE);
      const rEnd = r0 + dir[0] * (w.length - 1);
      const cEnd = c0 + dir[1] * (w.length - 1);
      if (rEnd < 0 || rEnd >= GRID_SIZE || cEnd < 0 || cEnd >= GRID_SIZE) continue;
      // Check fit
      let ok = true;
      const cells: string[] = [];
      for (let i = 0; i < w.length; i++) {
        const rr = r0 + dir[0] * i, cc = c0 + dir[1] * i;
        const ex = grid[rr][cc];
        if (ex !== "" && ex !== w[i]) { ok = false; break; }
        cells.push(key(rr, cc));
      }
      if (!ok) continue;
      // Place
      for (let i = 0; i < w.length; i++) grid[r0 + dir[0] * i][c0 + dir[1] * i] = w[i];
      placements.push({ word: w, r: r0, c: c0, dir, cells });
      placed = true;
    }
  }
  // Fill remaining cells with random letters
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (grid[r][c] === "") grid[r][c] = alphabet[Math.floor(Math.random() * 26)];
  return { grid, placements };
}

export default function WordSearch() {
  // Ref'd because the solve handler is wired into pointer callbacks that close
  // over their first render — reading `host` directly there would go stale.
  const { host } = useCartridge("word-search");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [themeIdx, setThemeIdx] = useState(0);
  const [grid, setGrid] = useState<string[][]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ r: number; c: number } | null>(null);
  const [solved, setSolved] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [bestSec, setBestSec] = useState<number | null>(null);

  useEffect(() => {
    const b = localStorage.getItem("wordsearch-best");
    if (b) setBestSec(parseInt(b, 10));
    newPuzzle(0);
   
  }, []);

  useEffect(() => {
    if (solved) return;
    const id = window.setInterval(() => setSeconds((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [solved, themeIdx]);

  const newPuzzle = (i: number) => {
    const theme = WORD_THEMES[i];
    const { grid, placements } = buildGrid(theme.words);
    setThemeIdx(i); setGrid(grid); setPlacements(placements);
    setFound(new Set()); setSolved(false); setSeconds(0);
  };

  // Cells currently being dragged (in a straight line)
  const dragCells = (() => {
    if (!dragStart || !dragEnd) return [] as string[];
    const dr = Math.sign(dragEnd.r - dragStart.r);
    const dc = Math.sign(dragEnd.c - dragStart.c);
    const rDiff = Math.abs(dragEnd.r - dragStart.r);
    const cDiff = Math.abs(dragEnd.c - dragStart.c);
    if (dr === 0 && dc === 0) return [key(dragStart.r, dragStart.c)];
    if (dr !== 0 && dc !== 0 && rDiff !== cDiff) return []; // only straight lines / diagonals
    const len = Math.max(rDiff, cDiff);
    const arr: string[] = [];
    for (let i = 0; i <= len; i++) arr.push(key(dragStart.r + dr * i, dragStart.c + dc * i));
    return arr;
  })();

  const cellDown = (r: number, c: number) => { if (!solved) { setDragStart({ r, c }); setDragEnd({ r, c }); } };
  const cellEnter = (r: number, c: number) => { if (dragStart && !solved) setDragEnd({ r, c }); };
  const cellUp = () => {
    if (!dragStart || !dragEnd) { setDragStart(null); setDragEnd(null); return; }
    const cellSet = dragCells;
    if (cellSet.length >= 2) {
      // Read letters
      const letters = cellSet.map((k) => { const [r, c] = k.split(",").map(Number); return grid[r][c]; }).join("");
      const reverse = letters.split("").reverse().join("");
      const matchP = placements.find((p) => (p.word === letters || p.word === reverse) && !found.has(p.word));
      if (matchP) {
        const f = new Set(found); f.add(matchP.word); setFound(f);
        if (f.size >= placements.length) {
          setSolved(true);
          if (bestSec === null || seconds < bestSec) { setBestSec(seconds); localStorage.setItem("wordsearch-best", String(seconds)); }
          hostRef.current.reportEvent("puzzle_solved");
        }
      }
    }
    setDragStart(null); setDragEnd(null);
  };

  const foundCells = new Set<string>();
  for (const p of placements) if (found.has(p.word)) for (const c of p.cells) foundCells.add(c);
  const dragSet = new Set(dragCells);

  const fmt = (t: number) => `${(t / 60 | 0).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[520px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">FOUND </span><span className="text-[var(--crt-green)]">{found.size}</span>/<span className="text-[var(--muted)]">{placements.length}</span></span>
        <span><span className="text-[var(--muted)]">TIME </span><span className="text-[var(--foreground)]">{fmt(seconds)}</span></span>
        {bestSec !== null && <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{fmt(bestSec)}</span></span>}
      </div>

      <div className="flex gap-1.5 flex-wrap justify-center">
        {WORD_THEMES.map((t, i) => (
          <button key={i} onClick={() => newPuzzle(i)} className={`pixel-edge px-2.5 py-1 rounded font-[family-name:var(--font-mono)] text-base ${themeIdx === i ? "bg-[var(--accent)] text-[var(--background)]" : "bg-[var(--surface-2)]"}`}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-2 inline-grid select-none touch-none"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 28px)`, gap: 2 }}
          onPointerUp={cellUp} onPointerLeave={cellUp}
        >
          {grid.flatMap((row, r) => row.map((letter, c) => {
            const k = key(r, c);
            const inDrag = dragSet.has(k);
            const isFound = foundCells.has(k);
            return (
              <button
                key={k}
                onPointerDown={() => cellDown(r, c)}
                onPointerEnter={() => cellEnter(r, c)}
                className="aspect-square pixel-edge rounded font-[family-name:var(--font-mono)] text-base flex items-center justify-center transition-colors"
                style={{
                  background: isFound ? "#7fd650" : inDrag ? "#ff8a3d" : "#3a2218",
                  color: isFound || inDrag ? "#1a0e0a" : "#f5e8d0",
                }}
              >
                {letter}
              </button>
            );
          }))}
        </div>

        {solved && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)] mb-2">ALL FOUND!</h2>
            <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-3">{fmt(seconds)}</p>
            {bestSec !== null && seconds <= bestSec && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW BEST ★</p>}
            <button onClick={() => newPuzzle((themeIdx + 1) % WORD_THEMES.length)} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEXT THEME</button>
          </div>
        )}
      </div>

      {/* Word list */}
      <div className="flex flex-wrap gap-2 max-w-[520px] justify-center">
        {placements.map((p) => (
          <span key={p.word} className={`px-2 py-1 rounded font-[family-name:var(--font-mono)] text-base ${found.has(p.word) ? "bg-[#7fd650]/20 text-[#7fd650] line-through" : "bg-[var(--surface-2)] text-[var(--foreground)]"}`}>
            {p.word}
          </span>
        ))}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click and drag across letters to highlight a word. Words can run in any direction including diagonals and backwards.
      </p>
    </div>
  );
}
