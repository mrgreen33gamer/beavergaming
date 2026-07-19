"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const SIZE = 8;
// 0 = empty, 1 = black (player), 2 = white (AI)
type Board = number[][];

const DIRS: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

function initialBoard(): Board {
  const b: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  b[3][3] = 2; b[3][4] = 1; b[4][3] = 1; b[4][4] = 2;
  return b;
}

function flipsForMove(board: Board, r: number, c: number, player: number): [number, number][] {
  if (board[r][c] !== 0) return [];
  const opp = 3 - player;
  const all: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const line: [number, number][] = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === opp) {
      line.push([nr, nc]); nr += dr; nc += dc;
    }
    if (line.length && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
      all.push(...line);
    }
  }
  return all;
}

function legalMoves(board: Board, player: number): { r: number; c: number; flips: [number, number][] }[] {
  const out: { r: number; c: number; flips: [number, number][] }[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const f = flipsForMove(board, r, c, player);
    if (f.length) out.push({ r, c, flips: f });
  }
  return out;
}

function applyMove(board: Board, r: number, c: number, player: number, flips: [number, number][]): Board {
  const out = board.map((row) => [...row]);
  out[r][c] = player;
  for (const [fr, fc] of flips) out[fr][fc] = player;
  return out;
}

function score(board: Board): { p1: number; p2: number } {
  let p1 = 0, p2 = 0;
  for (const row of board) for (const v of row) { if (v === 1) p1++; else if (v === 2) p2++; }
  return { p1, p2 };
}

// AI: prefer corners, then maximize flips, then prefer edges.
function aiPick(board: Board): { r: number; c: number; flips: [number, number][] } | null {
  const moves = legalMoves(board, 2);
  if (!moves.length) return null;
  const cornerPicks = moves.filter((m) => (m.r === 0 || m.r === 7) && (m.c === 0 || m.c === 7));
  if (cornerPicks.length) return cornerPicks[Math.floor(Math.random() * cornerPicks.length)];
  // Avoid giving away corners — skip squares adjacent to empty corners
  const safer = moves.filter((m) => {
    for (const [cr, cc] of [[0, 0], [0, 7], [7, 0], [7, 7]] as [number, number][]) {
      if (board[cr][cc] === 0 && Math.abs(m.r - cr) <= 1 && Math.abs(m.c - cc) <= 1) return false;
    }
    return true;
  });
  const pool = safer.length ? safer : moves;
  pool.sort((a, b) => b.flips.length - a.flips.length);
  const top = pool.slice(0, Math.min(2, pool.length));
  return top[Math.floor(Math.random() * top.length)];
}

export default function Reversi() {
  // Ref'd because endGame() is reached from the AI's setTimeout chain, which
  // closes over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("reversi");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState("Your turn (black)");
  const [wins, setWins] = useState(0);

  useEffect(() => {
    const w = localStorage.getItem("reversi-wins");
    if (w) setWins(parseInt(w, 10));
  }, []);

  const newGame = () => { setBoard(initialBoard()); setTurn(1); setOver(false); setMsg("Your turn (black)"); };

  const advance = (b: Board, next: 1 | 2) => {
    const moves = legalMoves(b, next);
    if (!moves.length) {
      const other = (3 - next) as 1 | 2;
      const otherMoves = legalMoves(b, other);
      if (!otherMoves.length) { endGame(b); return; }
      setMsg(next === 1 ? "You have no moves — AI plays" : "AI has no moves — your turn");
      setTurn(other);
      if (other === 2) setTimeout(() => aiMove(b), 600);
      return;
    }
    setTurn(next);
    setMsg(next === 1 ? "Your turn (black)" : "AI thinking…");
    if (next === 2) setTimeout(() => aiMove(b), 600);
  };

  const aiMove = (b: Board) => {
    const pick = aiPick(b);
    if (!pick) { endGame(b); return; }
    const nb = applyMove(b, pick.r, pick.c, 2, pick.flips);
    setBoard(nb);
    advance(nb, 1);
  };

  const playerMove = (r: number, c: number) => {
    if (over || turn !== 1) return;
    const flips = flipsForMove(board, r, c, 1);
    if (!flips.length) return;
    const nb = applyMove(board, r, c, 1, flips);
    setBoard(nb);
    advance(nb, 2);
  };

  const endGame = (b: Board) => {
    setOver(true);
    const { p1, p2 } = score(b);
    if (p1 > p2) { setMsg(`You win! ${p1} – ${p2}`); const w = wins + 1; setWins(w); localStorage.setItem("reversi-wins", String(w)); hostRef.current.reportEvent("match_won"); }
    else if (p2 > p1) setMsg(`AI wins. ${p1} – ${p2}`);
    else setMsg(`Tie ${p1} – ${p2}`);
  };

  const { p1, p2 } = score(board);
  const playerMoves = turn === 1 && !over ? legalMoves(board, 1) : [];
  const moveSet = new Set(playerMoves.map((m) => `${m.r},${m.c}`));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[420px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[#1a0e0a] bg-[var(--foreground)] px-2 rounded">BLACK</span> <span className="text-[var(--crt-green)]">{p1}</span></span>
        <span className="text-[var(--muted)] text-base">{msg}</span>
        <span><span className="text-[var(--foreground)]">{p2}</span> <span className="text-[var(--background)] bg-[var(--foreground)] px-2 rounded">WHITE</span></span>
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="grid p-2 rounded-lg border-2 border-[var(--border)] bg-[#1a4828]" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 2 }}>
          {board.flatMap((row, r) => row.map((v, c) => {
            const isHint = moveSet.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => playerMove(r, c)}
                disabled={turn !== 1 || over || v !== 0}
                className="aspect-square flex items-center justify-center bg-[#2a6a3a] hover:bg-[#357a44] disabled:hover:bg-[#2a6a3a]"
              >
                {v !== 0 ? (
                  <span className="w-[80%] h-[80%] rounded-full" style={{ background: v === 1 ? "#1a0e0a" : "#f5e8d0", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.15)" }} />
                ) : isHint ? (
                  <span className="w-[30%] h-[30%] rounded-full bg-black/30" />
                ) : null}
              </button>
            );
          }))}
        </div>

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg mb-2" style={{ color: p1 > p2 ? "#7fd650" : p2 > p1 ? "#d63d3d" : "#b8a088" }}>
              {p1 > p2 ? "YOU WIN!" : p2 > p1 ? "AI WINS" : "TIE"}
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-3">{p1} – {p2}</p>
            <button onClick={newGame} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">PLAY AGAIN</button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={newGame} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ New Game</button>
        <span className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] self-center">WINS <span className="text-[var(--accent)]">{wins}</span></span>
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Place a black disc to flank and flip white discs between yours. The dots show legal moves. Corners are gold.
      </p>
    </div>
  );
}
