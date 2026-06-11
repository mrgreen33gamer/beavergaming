"use client";

import { useEffect, useState } from "react";

const COLS = 9;
const ROWS = 7;
const FLOW_INTERVAL_MS = 350; // how often the water advances one segment

// Pipe shapes: bitmask of connections N=1, E=2, S=4, W=8
// Each shape has 1-4 rotations
type PipeKind = "straight" | "curve" | "tee" | "cross";
type Cell = {
  kind: PipeKind | null;
  rot: 0 | 1 | 2 | 3;          // multiples of 90deg
  fixed: boolean;               // start/end pieces locked
  filled: boolean;
  filledFrom?: number;          // bitmask of side flow entered through (for partial fill animation)
};

const CONN0: Record<PipeKind, number> = {
  straight: 0b0101, // N(1) + S(4)
  curve: 0b0011,    // N(1) + E(2)
  tee: 0b1110,      // E(2) + S(4) + W(8)
  cross: 0b1111,
};

function rotateMask(mask: number, rot: number): number {
  // Rotate clockwise by rot*90 degrees: N→E, E→S, S→W, W→N
  let m = mask & 0xf;
  for (let i = 0; i < rot; i++) {
    const n = (m & 1) ? 1 : 0;
    const e = (m & 2) ? 1 : 0;
    const s = (m & 4) ? 1 : 0;
    const w = (m & 8) ? 1 : 0;
    m = (w << 0) | (n << 1) | (e << 2) | (s << 3);
  }
  return m;
}

function connections(cell: Cell): number {
  if (!cell.kind) return 0;
  return rotateMask(CONN0[cell.kind], cell.rot);
}

const DIRS: { dr: number; dc: number; mask: number; opp: number }[] = [
  { dr: -1, dc: 0, mask: 1, opp: 4 },  // N
  { dr: 0, dc: 1, mask: 2, opp: 8 },   // E
  { dr: 1, dc: 0, mask: 4, opp: 1 },   // S
  { dr: 0, dc: -1, mask: 8, opp: 2 },  // W
];

function emptyGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ kind: null as PipeKind | null, rot: 0 as const, fixed: false, filled: false })));
}

function generatePuzzle(): { grid: Cell[][]; startR: number; startC: number; endR: number; endC: number } {
  const grid = emptyGrid();
  const startR = Math.floor(Math.random() * ROWS);
  const endR = Math.floor(Math.random() * ROWS);
  const startC = 0, endC = COLS - 1;
  grid[startR][startC] = { kind: "curve", rot: 0, fixed: true, filled: false };
  grid[endR][endC] = { kind: "curve", rot: 2, fixed: true, filled: false };
  // Fill some cells with random pipes at random rotations (not actually solvable, but the player rotates to make a path)
  const kinds: PipeKind[] = ["straight", "straight", "curve", "curve", "curve", "tee"];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c].kind) continue;
    if (Math.random() < 0.85) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const rot = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
      grid[r][c] = { kind, rot, fixed: false, filled: false };
    }
  }
  // Fix start to point East (rot to expose E)
  // For curve at rot 0: N+E. Rotate so the open side points East from cell.
  // We want it to connect East only (with maybe a closed inner). Actually leak from start is fine via tee.
  // Easiest: replace start with a custom "source" piece that connects East only.
  // For simplicity, use curve with rot 1 (E + S) so it connects East — well, let me use a "tee" to be flexible.
  grid[startR][startC] = { kind: "tee", rot: 3, fixed: true, filled: false }; // E+S+W → connects E for sure
  grid[endR][endC] = { kind: "tee", rot: 1, fixed: true, filled: false };     // connects W for sure
  return { grid, startR, startC, endR, endC };
}

export default function Pipes() {
  const [puzzle, setPuzzle] = useState<{ grid: Cell[][]; startR: number; startC: number; endR: number; endC: number }>(() => generatePuzzle());
  const [filledCells, setFilledCells] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"setup" | "flowing" | "won" | "lost">("setup");
  const [setupTime, setSetupTime] = useState(0);    // seconds elapsed in setup
  const [flowTime, setFlowTime] = useState(0);
  const [seed, setSeed] = useState(0);              // bump to restart
  const [level, setLevel] = useState(1);
  const [bestLevel, setBestLevel] = useState(1);

  useEffect(() => {
    const b = localStorage.getItem("pipes-best-level");
    if (b) setBestLevel(parseInt(b, 10));
  }, []);

  // Setup timer / flow start
  useEffect(() => {
    if (phase !== "setup") return;
    const id = window.setInterval(() => {
      setSetupTime((t) => {
        const nt = t + 1;
        const setupAllowed = Math.max(8, 18 - level); // shorter setup at higher levels
        if (nt >= setupAllowed) {
          setPhase("flowing");
          setFilledCells(new Set([`${puzzle.startR},${puzzle.startC}`]));
        }
        return nt;
      });
    }, 1000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, seed, level]);

  // Flow propagation
  useEffect(() => {
    if (phase !== "flowing") return;
    const id = window.setInterval(() => {
      setFilledCells((prev) => {
        const next = new Set(prev);
        let grew = false;
        for (const k of prev) {
          const [r, c] = k.split(",").map(Number);
          const cell = puzzle.grid[r][c];
          const conn = connections(cell);
          for (const d of DIRS) {
            if (!(conn & d.mask)) continue;
            const nr = r + d.dr, nc = c + d.dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const ncell = puzzle.grid[nr][nc];
            if (!ncell.kind) continue;
            const nconn = connections(ncell);
            if (!(nconn & d.opp)) continue;
            const nk = `${nr},${nc}`;
            if (!next.has(nk)) { next.add(nk); grew = true; }
          }
        }
        if (!grew) {
          // Check win
          const endKey = `${puzzle.endR},${puzzle.endC}`;
          setTimeout(() => {
            if (next.has(endKey)) {
              setPhase("won");
              if (level + 1 > bestLevel) { setBestLevel(level + 1); localStorage.setItem("pipes-best-level", String(level + 1)); }
            } else setPhase("lost");
          }, 200);
        }
        setFlowTime((t) => t + 1);
        return next;
      });
    }, FLOW_INTERVAL_MS);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, seed, puzzle, level, bestLevel]);

  const rotate = (r: number, c: number) => {
    if (phase === "won" || phase === "lost") return;
    const cell = puzzle.grid[r][c];
    if (!cell.kind || cell.fixed) return;
    // Don't allow rotating a cell that's currently filled (it would break flow)
    const nextGrid = puzzle.grid.map((row) => row.map((c) => ({ ...c })));
    nextGrid[r][c] = { ...cell, rot: ((cell.rot + 1) % 4) as 0 | 1 | 2 | 3 };
    setPuzzle({ ...puzzle, grid: nextGrid });
  };

  const newPuzzle = (lvl: number) => {
    setPuzzle(generatePuzzle());
    setFilledCells(new Set());
    setPhase("setup"); setSetupTime(0); setFlowTime(0);
    setLevel(lvl);
    setSeed((s) => s + 1);
  };

  const allowedSetup = Math.max(8, 18 - level);
  const setupLeft = Math.max(0, allowedSetup - setupTime);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[560px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-x-3 gap-y-1">
        <span><span className="text-[var(--muted)]">LVL </span><span className="text-[var(--crt-green)]">{level}</span></span>
        {phase === "setup" && <span><span className="text-[var(--muted)]">SETUP </span><span className={setupLeft <= 3 ? "text-[#d63d3d]" : "text-[var(--foreground)]"}>{setupLeft}s</span></span>}
        {phase === "flowing" && <span><span className="text-[var(--muted)]">FLOWING </span><span className="text-[#5fc8e0]">{filledCells.size}</span> cells</span>}
        <span><span className="text-[var(--muted)]">BEST LVL </span><span className="text-[var(--accent)]">{bestLevel}</span></span>
      </div>

      <div className="relative">
        <div
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-2 inline-grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, 56px)`, gap: 2 }}
        >
          {puzzle.grid.map((row, r) => row.map((cell, c) => {
            const isStart = r === puzzle.startR && c === puzzle.startC;
            const isEnd = r === puzzle.endR && c === puzzle.endC;
            const filled = filledCells.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}-${seed}`}
                onClick={() => rotate(r, c)}
                disabled={cell.fixed || phase === "won" || phase === "lost"}
                className="aspect-square pixel-edge rounded relative overflow-hidden"
                style={{ width: 56, height: 56, background: isStart ? "#1a4878" : isEnd ? "#4a1810" : "#3a2218" }}
              >
                {cell.kind && <PipeSVG kind={cell.kind} rot={cell.rot} filled={filled} fixed={cell.fixed} />}
                {isStart && <span className="absolute top-0 left-0 text-sm font-[family-name:var(--font-mono)] text-[#5fc8e0] px-0.5">IN</span>}
                {isEnd && <span className="absolute top-0 right-0 text-sm font-[family-name:var(--font-mono)] text-[#ff8a3d] px-0.5">OUT</span>}
              </button>
            );
          }))}
        </div>

        {phase === "setup" && setupLeft <= 3 && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#d63d3d] text-[#1a0e0a] font-[family-name:var(--font-display)] text-xs rounded flicker">
            FLOW IN {setupLeft}!
          </div>
        )}

        {(phase === "won" || phase === "lost") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base mb-2" style={{ color: phase === "won" ? "#7fd650" : "#d63d3d" }}>
              {phase === "won" ? "FLOW COMPLETE!" : "LEAK!"}
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-3">
              {phase === "won" ? "Water reached the outlet." : "The water stopped before the outlet."}
            </p>
            {phase === "won" ? (
              <button onClick={() => newPuzzle(level + 1)} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEXT LEVEL →</button>
            ) : (
              <button onClick={() => newPuzzle(level)} className="pixel-edge px-5 py-2 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">TRY AGAIN</button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => newPuzzle(1)} className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">⏮ Restart</button>
        <button onClick={() => newPuzzle(level)} className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ New Puzzle</button>
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md leading-snug">
        Click pipe tiles to rotate them 90°. Connect IN to OUT before the setup timer runs out. Once the water starts flowing, it&apos;ll follow whatever path you&apos;ve built — leak it and you lose.
      </p>
    </div>
  );
}

function PipeSVG({ kind, rot, filled, fixed }: { kind: PipeKind; rot: number; filled: boolean; fixed: boolean }) {
  const color = filled ? "#5fc8e0" : fixed ? "#ffd060" : "#b8a088";
  const dark = filled ? "#2a6f8b" : "#7a6a4a";
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full block" style={{ transform: `rotate(${rot * 90}deg)`, transition: "transform 0.15s ease-out" }}>
      {/* Background dark plate */}
      <rect x="0" y="0" width="100" height="100" fill="transparent" />
      {kind === "straight" && (
        <>
          <rect x="38" y="0" width="24" height="100" fill={dark} />
          <rect x="42" y="0" width="16" height="100" fill={color} />
        </>
      )}
      {kind === "curve" && (
        <>
          {/* N+E elbow */}
          <path d="M 38 0 L 38 50 Q 38 62 50 62 L 100 62 L 100 38 Q 62 38 62 38 L 62 0 Z" fill={dark} />
          <path d="M 42 0 L 42 50 Q 42 58 50 58 L 100 58 L 100 42 Q 58 42 58 42 L 58 0 Z" fill={color} />
        </>
      )}
      {kind === "tee" && (
        <>
          {/* E+S+W */}
          <rect x="0" y="38" width="100" height="24" fill={dark} />
          <rect x="38" y="38" width="24" height="62" fill={dark} />
          <rect x="0" y="42" width="100" height="16" fill={color} />
          <rect x="42" y="42" width="16" height="58" fill={color} />
        </>
      )}
      {kind === "cross" && (
        <>
          <rect x="0" y="38" width="100" height="24" fill={dark} />
          <rect x="38" y="0" width="24" height="100" fill={dark} />
          <rect x="0" y="42" width="100" height="16" fill={color} />
          <rect x="42" y="0" width="16" height="100" fill={color} />
        </>
      )}
    </svg>
  );
}
