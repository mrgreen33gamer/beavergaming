"use client";

import { useEffect, useRef, useState } from "react";

const COLS = 7;
const ROWS = 6;
// 0 = empty, 1 = player (red), 2 = AI (yellow)

type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function dropRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r;
  return -1;
}

function checkWin(board: Board, player: number): boolean {
  // Horizontal, vertical, both diagonals
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === player) count++;
          else break;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

function isFull(board: Board): boolean {
  return board[0].every((v) => v !== 0);
}

// Simple AI: win if possible, block if needed, else prefer center
function aiMove(board: Board): number {
  const valid = [];
  for (let c = 0; c < COLS; c++) if (dropRow(board, c) >= 0) valid.push(c);
  // Win
  for (const c of valid) {
    const r = dropRow(board, c);
    board[r][c] = 2;
    if (checkWin(board, 2)) { board[r][c] = 0; return c; }
    board[r][c] = 0;
  }
  // Block
  for (const c of valid) {
    const r = dropRow(board, c);
    board[r][c] = 1;
    if (checkWin(board, 1)) { board[r][c] = 0; return c; }
    board[r][c] = 0;
  }
  // Avoid giving opponent a win on top
  const safe = valid.filter((c) => {
    const r = dropRow(board, c);
    if (r <= 0) return true;
    board[r][c] = 2;
    board[r - 1][c] = 1;
    const bad = checkWin(board, 1);
    board[r][c] = 0;
    board[r - 1][c] = 0;
    return !bad;
  });
  const pool = safe.length ? safe : valid;
  // Prefer center columns
  pool.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  // Small randomness among the best two
  const top = pool.slice(0, Math.min(2, pool.length));
  return top[Math.floor(Math.random() * top.length)];
}

export default function ConnectFour() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<0 | 1 | 2 | 3>(0); // 3 = draw
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hoverCol, setHoverCol] = useState(-1);
  const boardRef = useRef<Board>(emptyBoard());

  useEffect(() => {
    const w = localStorage.getItem("connect4-wins");
    const l = localStorage.getItem("connect4-losses");
    if (w) setWins(parseInt(w, 10));
    if (l) setLosses(parseInt(l, 10));
  }, []);

  const newGame = () => {
    const b = emptyBoard();
    boardRef.current = b;
    setBoard(b);
    setTurn(1);
    setWinner(0);
    setBusy(false);
  };

  const finish = (w: 0 | 1 | 2 | 3) => {
    setWinner(w);
    if (w === 1) { setWins((x) => { const n = x + 1; localStorage.setItem("connect4-wins", String(n)); return n; }); }
    if (w === 2) { setLosses((x) => { const n = x + 1; localStorage.setItem("connect4-losses", String(n)); return n; }); }
  };

  const playColumn = (col: number) => {
    if (busy || winner) return;
    const b = boardRef.current.map((row) => [...row]);
    const r = dropRow(b, col);
    if (r < 0) return;
    b[r][col] = 1;
    boardRef.current = b;
    setBoard(b);
    if (checkWin(b, 1)) { finish(1); return; }
    if (isFull(b)) { finish(3); return; }
    // AI turn
    setBusy(true);
    setTurn(2);
    setTimeout(() => {
      const b2 = boardRef.current.map((row) => [...row]);
      const ac = aiMove(b2);
      const ar = dropRow(b2, ac);
      if (ar >= 0) b2[ar][ac] = 2;
      boardRef.current = b2;
      setBoard(b2);
      if (checkWin(b2, 2)) { finish(2); setBusy(false); return; }
      if (isFull(b2)) { finish(3); setBusy(false); return; }
      setTurn(1);
      setBusy(false);
    }, 450);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[420px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[#d63d3d]">● YOU </span><span className="text-[var(--crt-green)]">{wins}W</span></span>
        <span className="text-[var(--muted)]">
          {winner === 0 ? (turn === 1 ? "Your turn" : "AI thinking…") : winner === 1 ? "You win!" : winner === 2 ? "AI wins" : "Draw"}
        </span>
        <span><span className="text-[#ffd060]">AI ● </span><span className="text-[var(--accent)]">{losses}L</span></span>
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-lg border-2 border-[var(--border)] bg-[#1a2a6a] p-2">
          {/* Column hover/click zones */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {Array.from({ length: COLS }).map((_, c) => (
              <button
                key={`col-${c}`}
                onClick={() => playColumn(c)}
                onMouseEnter={() => setHoverCol(c)}
                onMouseLeave={() => setHoverCol(-1)}
                disabled={busy || !!winner || dropRow(boardRef.current, c) < 0}
                className="flex flex-col gap-1"
                aria-label={`drop in column ${c + 1}`}
              >
                {Array.from({ length: ROWS }).map((_, r) => {
                  const v = board[r][c];
                  return (
                    <span
                      key={`${r}-${c}`}
                      className="aspect-square rounded-full"
                      style={{
                        background: v === 1 ? "#d63d3d" : v === 2 ? "#ffd060" : (hoverCol === c && !winner && !busy ? "#22357a" : "#0f1f55"),
                        boxShadow: v ? "inset 0 -3px 0 rgba(0,0,0,0.3)" : "inset 0 2px 4px rgba(0,0,0,0.5)",
                      }}
                    />
                  );
                })}
              </button>
            ))}
          </div>
        </div>

        {winner !== 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg mb-3"
              style={{ color: winner === 1 ? "#7fd650" : winner === 2 ? "#ffd060" : "#b8a088" }}>
              {winner === 1 ? "YOU WIN!" : winner === 2 ? "AI WINS" : "DRAW"}
            </h2>
            <button onClick={newGame} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">PLAY AGAIN</button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={newGame} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] text-[var(--foreground)] font-[family-name:var(--font-mono)] text-base">↻ New Game</button>
      </div>
      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click a column to drop your red disc. Connect four in a row — horizontal, vertical, or diagonal — before the AI does.
      </p>
    </div>
  );
}
