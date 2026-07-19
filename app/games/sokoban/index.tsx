"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

// Tile chars: # wall, . floor, $ crate, * crate-on-target, @ player, + player-on-target, x target, space outside
const LEVELS: string[][] = [
  [
    "  #####  ",
    "###...#  ",
    "#.@$..#  ",
    "###.$x#  ",
    "#x..$.###",
    "#.###..x#",
    "#.....###",
    "###..#   ",
    "  ####   ",
  ],
  [
    "########",
    "#......#",
    "#.$..$.#",
    "#.x@x..#",
    "#.$..$.#",
    "#......#",
    "#..xx..#",
    "########",
  ],
  [
    " ####### ",
    " #..x..# ",
    " #.$.$.# ",
    "##..@..##",
    "#.$...$.#",
    "#.x.x.x.#",
    "#.$...$.#",
    "##..x..##",
    " #.....# ",
    " ####### ",
  ],
  [
    "  ######",
    "###....#",
    "#.x.$$.#",
    "#.x.@..#",
    "#.x.$$.#",
    "###....#",
    "  ######",
  ],
  [
    "##########",
    "#........#",
    "#.######.#",
    "#.#x..x#.#",
    "#.#.$$.#.#",
    "#.#.@..#.#",
    "#.#.$$.#.#",
    "#.#x..x#.#",
    "#.######.#",
    "#........#",
    "##########",
  ],
];

type Cell = "wall" | "floor" | "outside" | "target";
type Grid = { cells: Cell[][]; crates: Set<string>; player: { r: number; c: number }; targets: Set<string> };

function key(r: number, c: number) { return `${r},${c}`; }

function parseLevel(lines: string[]): Grid {
  const cells: Cell[][] = [];
  const crates = new Set<string>();
  const targets = new Set<string>();
  let player = { r: 0, c: 0 };
  for (let r = 0; r < lines.length; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < lines[r].length; c++) {
      const ch = lines[r][c];
      if (ch === "#") row.push("wall");
      else if (ch === " ") row.push("outside");
      else {
        if (ch === "x" || ch === "+" || ch === "*") { row.push("target"); targets.add(key(r, c)); }
        else row.push("floor");
        if (ch === "@" || ch === "+") player = { r, c };
        if (ch === "$" || ch === "*") crates.add(key(r, c));
      }
    }
    cells.push(row);
  }
  return { cells, crates, player, targets };
}

function clone(g: Grid): Grid {
  return { cells: g.cells.map((r) => [...r]), crates: new Set(g.crates), player: { ...g.player }, targets: g.targets };
}

function isWon(g: Grid): boolean {
  for (const t of g.targets) if (!g.crates.has(t)) return false;
  return true;
}

export default function Sokoban() {
  // Ref'd because tryMove() is reached from the keydown listener, which closes
  // over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("sokoban");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [levelIdx, setLevelIdx] = useState(0);
  const [grid, setGrid] = useState<Grid>(() => parseLevel(LEVELS[0]));
  const [history, setHistory] = useState<Grid[]>([]);
  const [moves, setMoves] = useState(0);
  const [bestLevel, setBestLevel] = useState(0);
  const [won, setWon] = useState(false);

  useEffect(() => {
    const b = localStorage.getItem("sokoban-best");
    if (b) setBestLevel(parseInt(b, 10));
  }, []);

  const loadLevel = (i: number) => {
    setLevelIdx(i);
    setGrid(parseLevel(LEVELS[i]));
    setHistory([]);
    setMoves(0);
    setWon(false);
  };

  const tryMove = (dr: number, dc: number) => {
    if (won) return;
    const g = grid;
    const nr = g.player.r + dr, nc = g.player.c + dc;
    if (nr < 0 || nr >= g.cells.length || nc < 0 || nc >= (g.cells[nr]?.length ?? 0)) return;
    const cell = g.cells[nr][nc];
    if (cell === "wall" || cell === "outside") return;
    const next = clone(g);
    if (g.crates.has(key(nr, nc))) {
      const br = nr + dr, bc = nc + dc;
      if (br < 0 || br >= g.cells.length || bc < 0 || bc >= (g.cells[br]?.length ?? 0)) return;
      const beyond = g.cells[br][bc];
      if (beyond === "wall" || beyond === "outside") return;
      if (g.crates.has(key(br, bc))) return;
      next.crates.delete(key(nr, nc));
      next.crates.add(key(br, bc));
    }
    next.player = { r: nr, c: nc };
    setHistory([...history, g]);
    setGrid(next);
    setMoves((m) => m + 1);
    if (isWon(next)) {
      setWon(true);
      if (levelIdx + 1 > bestLevel) { setBestLevel(levelIdx + 1); localStorage.setItem("sokoban-best", String(levelIdx + 1)); }
      hostRef.current.reportEvent("level_cleared");
    }
  };

  const undo = () => {
    if (won || history.length === 0) return;
    const prev = history[history.length - 1];
    setGrid(prev);
    setHistory(history.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); tryMove(-1, 0); }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); tryMove(1, 0); }
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); tryMove(0, -1); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); tryMove(0, 1); }
      if (e.code === "KeyZ" || e.code === "KeyU") { e.preventDefault(); undo(); }
      if (e.code === "KeyR") { e.preventDefault(); loadLevel(levelIdx); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, history, levelIdx, won]);

  const cols = Math.max(...grid.cells.map((r) => r.length));
  const tileSize = Math.max(22, Math.min(40, Math.floor(420 / cols)));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[460px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--crt-green)]">{levelIdx + 1}</span>/<span className="text-[var(--muted)]">{LEVELS.length}</span></span>
        <span><span className="text-[var(--muted)]">MOVES </span><span className="text-[var(--foreground)]">{moves}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{bestLevel}</span></span>
      </div>

      <div className="relative">
        <div className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-3 inline-block">
          <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`, gap: 0 }}>
            {grid.cells.map((row, r) => row.concat(Array(cols - row.length).fill("outside" as Cell)).map((cell, c) => {
              const isPlayer = grid.player.r === r && grid.player.c === c;
              const isCrate = grid.crates.has(key(r, c));
              const isTarget = cell === "target";
              let bg = "transparent";
              if (cell === "wall") bg = "#5a3a22";
              else if (cell === "floor" || cell === "target") bg = "#2a1810";
              return (
                <div key={`${r}-${c}`} style={{ width: tileSize, height: tileSize, background: bg }} className="flex items-center justify-center relative">
                  {cell === "wall" && (
                    <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #6a4a2c, #4a2e1f)", boxShadow: "inset 0 2px 0 #7a5a34, inset 0 -2px 0 #3a2218" }} />
                  )}
                  {isTarget && !isCrate && !isPlayer && <div className="absolute w-[40%] h-[40%] rounded-full border-2 border-[#ffd060]" />}
                  {isCrate && (
                    <div className="absolute w-[80%] h-[80%] flex items-center justify-center" style={{ background: isTarget ? "#7fd650" : "#a06820", boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.35), inset 3px 3px 0 rgba(255,255,255,0.18)" }}>
                      <span className="text-[10px] font-[family-name:var(--font-mono)]" style={{ color: isTarget ? "#1a0e0a" : "#3a2218" }}>{isTarget ? "✓" : ""}</span>
                    </div>
                  )}
                  {isPlayer && (
                    <span className="absolute text-xl" style={{ fontSize: tileSize * 0.7 }}>🦫</span>
                  )}
                </div>
              );
            }))}
          </div>
        </div>

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)] mb-1">LEVEL {levelIdx + 1} SOLVED!</h2>
            <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-3">{moves} moves</p>
            {levelIdx + 1 < LEVELS.length ? (
              <button onClick={() => loadLevel(levelIdx + 1)} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEXT LEVEL →</button>
            ) : (
              <>
                <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-3 flicker">★ ALL LEVELS CLEARED ★</p>
                <button onClick={() => loadLevel(0)} className="pixel-edge px-5 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-display)] text-xs">PLAY AGAIN</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        <button onClick={undo} disabled={!history.length || won} className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base disabled:opacity-40">↶ Undo</button>
        <button onClick={() => loadLevel(levelIdx)} className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ Restart</button>
        <button onClick={() => loadLevel(Math.max(0, levelIdx - 1))} disabled={levelIdx === 0} className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base disabled:opacity-40">← Prev</button>
        <button onClick={() => loadLevel(Math.min(LEVELS.length - 1, levelIdx + 1))} disabled={levelIdx >= LEVELS.length - 1} className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base disabled:opacity-40">Next →</button>
      </div>

      <div className="sm:hidden grid grid-cols-3 gap-2">
        <div /><button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tryMove(-1, 0)}>▲</button><div />
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tryMove(0, -1)}>◀</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tryMove(1, 0)}>▼</button>
        <button className="pixel-edge p-3 bg-[var(--surface-2)] rounded" onClick={() => tryMove(0, 1)}>▶</button>
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Push crates onto the gold targets — you can only push, never pull. Arrow keys / WASD · Z to undo · R to restart.
      </p>
    </div>
  );
}
