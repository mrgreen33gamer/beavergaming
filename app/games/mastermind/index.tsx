"use client";

import { useEffect, useState } from "react";

const COLORS = ["#d63d3d", "#ffd060", "#7fd650", "#5fc8e0", "#c45ed6", "#ff8a3d"];
const SLOTS = 4;
const MAX_GUESSES = 10;

function generateCode(): number[] {
  return Array.from({ length: SLOTS }, () => Math.floor(Math.random() * COLORS.length));
}

// Returns { black: exact-position matches, white: right-color-wrong-position }
function scoreGuess(guess: number[], code: number[]): { black: number; white: number } {
  let black = 0;
  const codeRem: number[] = [];
  const guessRem: number[] = [];
  for (let i = 0; i < SLOTS; i++) {
    if (guess[i] === code[i]) black++;
    else { codeRem.push(code[i]); guessRem.push(guess[i]); }
  }
  let white = 0;
  for (const g of guessRem) {
    const idx = codeRem.indexOf(g);
    if (idx >= 0) { white++; codeRem.splice(idx, 1); }
  }
  return { black, white };
}

type Row = { guess: number[]; black: number; white: number };

export default function Mastermind() {
  const [code, setCode] = useState<number[]>(generateCode);
  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState<(number | null)[]>(Array(SLOTS).fill(null));
  const [activeSlot, setActiveSlot] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [wins, setWins] = useState(0);

  useEffect(() => {
    const w = localStorage.getItem("mastermind-wins");
    if (w) setWins(parseInt(w, 10));
  }, []);

  const newGame = () => {
    setCode(generateCode());
    setRows([]);
    setCurrent(Array(SLOTS).fill(null));
    setActiveSlot(0);
    setWon(false); setLost(false);
  };

  const placeColor = (col: number) => {
    if (won || lost) return;
    const next = current.slice();
    next[activeSlot] = col;
    setCurrent(next);
    // Move to next empty slot
    const nextEmpty = next.findIndex((v, i) => i > activeSlot && v === null);
    if (nextEmpty >= 0) setActiveSlot(nextEmpty);
    else {
      const anyEmpty = next.findIndex((v) => v === null);
      if (anyEmpty >= 0) setActiveSlot(anyEmpty);
    }
  };

  const clearSlot = (i: number) => {
    if (won || lost) return;
    const next = current.slice();
    next[i] = null;
    setCurrent(next);
    setActiveSlot(i);
  };

  const submit = () => {
    if (won || lost) return;
    if (current.some((v) => v === null)) return;
    const guess = current as number[];
    const sc = scoreGuess(guess, code);
    const newRows = [...rows, { guess, black: sc.black, white: sc.white }];
    setRows(newRows);
    setCurrent(Array(SLOTS).fill(null));
    setActiveSlot(0);
    if (sc.black === SLOTS) {
      setWon(true);
      const w = wins + 1; setWins(w); localStorage.setItem("mastermind-wins", String(w));
    } else if (newRows.length >= MAX_GUESSES) {
      setLost(true);
    }
  };

  const filled = current.filter((v) => v !== null).length;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[420px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">GUESS </span><span className="text-[var(--crt-green)]">{rows.length + 1}</span>/<span className="text-[var(--muted)]">{MAX_GUESSES}</span></span>
        <span><span className="text-[var(--muted)]">WINS </span><span className="text-[var(--accent)]">{wins}</span></span>
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-3">
          {/* Past rows (newest at bottom) */}
          <div className="flex flex-col-reverse gap-1.5 mb-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] w-6 text-right">{idx + 1}.</span>
                <div className="flex gap-1.5">
                  {row.guess.map((g, i) => <Peg key={i} color={COLORS[g]} />)}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-1 ml-2">
                  {Array.from({ length: row.black }).map((_, i) => <MiniPeg key={`b${i}`} color="#1a0e0a" />)}
                  {Array.from({ length: row.white }).map((_, i) => <MiniPeg key={`w${i}`} color="#f5e8d0" />)}
                  {Array.from({ length: SLOTS - row.black - row.white }).map((_, i) => <MiniPeg key={`e${i}`} color="transparent" />)}
                </div>
              </div>
            ))}
          </div>
          {/* Current row */}
          {!won && !lost && (
            <div className="flex items-center gap-2 mt-1 border-t border-[var(--border)] pt-2">
              <span className="font-[family-name:var(--font-mono)] text-base text-[var(--accent-hot)] w-6 text-right">›</span>
              <div className="flex gap-1.5">
                {current.map((c, i) => (
                  <button key={i} onClick={() => clearSlot(i)} onFocus={() => setActiveSlot(i)} onMouseDown={() => setActiveSlot(i)}
                    className="rounded-full" style={{
                      width: 28, height: 28,
                      background: c !== null ? COLORS[c] : "transparent",
                      border: `2px solid ${activeSlot === i ? "#ff8a3d" : "#4a2e1f"}`,
                      boxShadow: c !== null ? "inset -2px -2px 0 rgba(0,0,0,0.3), inset 2px 2px 0 rgba(255,255,255,0.2)" : "none",
                    }}
                  />
                ))}
              </div>
              <button onClick={submit} disabled={filled < SLOTS}
                className="ml-auto pixel-edge px-3 py-1.5 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs disabled:opacity-40">
                GUESS
              </button>
            </div>
          )}
        </div>

        {(won || lost) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded-lg p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base mb-2" style={{ color: won ? "#7fd650" : "#d63d3d" }}>
              {won ? "CRACKED!" : "CODE LOCKED"}
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-2">The code was:</p>
            <div className="flex gap-2 mb-3">{code.map((c, i) => <Peg key={i} color={COLORS[c]} />)}</div>
            {won && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--foreground)] mb-2">in {rows.length} guesses</p>}
            <button onClick={newGame} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEW CODE</button>
          </div>
        )}
      </div>

      {/* Color palette */}
      {!won && !lost && (
        <div className="flex gap-2">
          {COLORS.map((c, i) => (
            <button key={i} onClick={() => placeColor(i)} className="pixel-edge rounded-full"
              style={{
                width: 36, height: 36,
                background: c,
                boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.3), inset 3px 3px 0 rgba(255,255,255,0.25)",
              }}
              aria-label={`color ${i}`}
            />
          ))}
        </div>
      )}

      <button onClick={newGame} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ New Game</button>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md leading-snug">
        Crack the secret 4-color code in {MAX_GUESSES} guesses. ● black peg = right color in the right slot · ○ white peg = right color, wrong slot.
      </p>
    </div>
  );
}

function Peg({ color }: { color: string }) {
  return <span className="rounded-full inline-block" style={{
    width: 28, height: 28, background: color,
    boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.3), inset 2px 2px 0 rgba(255,255,255,0.2)",
  }} />;
}
function MiniPeg({ color }: { color: string }) {
  return <span className="rounded-full inline-block" style={{
    width: 10, height: 10, background: color === "transparent" ? "rgba(74,46,31,0.4)" : color,
    border: color === "transparent" ? "1px solid rgba(74,46,31,0.6)" : "none",
  }} />;
}
