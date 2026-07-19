"use client";

import { useCallback, useEffect, useState } from "react";

const EMOJI_POOL = ["🦫", "🚁", "🏹", "🐍", "🃏", "🔨", "🎮", "🕹️", "🎯", "🎲", "🚀", "🎨", "💎", "⚡", "🍀", "🔥", "🎪", "🎰"];

type Difficulty = "easy" | "hard";

type Card = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
  justMatched: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck(diff: Difficulty): Card[] {
  const pairs = diff === "easy" ? 8 : 18;
  const emojis = shuffle(EMOJI_POOL).slice(0, pairs);
  const all = shuffle(emojis.flatMap((e) => [e, e]));
  return all.map((emoji, id) => ({
    id,
    emoji,
    flipped: false,
    matched: false,
    justMatched: false,
  }));
}

function starsForScore(moves: number, pairs: number): number {
  // Best case: pairs moves (perfect). 3 stars if <= 1.5x pairs. 2 if <= 2x. 1 otherwise.
  if (moves <= pairs * 1.5) return 3;
  if (moves <= pairs * 2) return 2;
  return 1;
}

export default function MemoryMatch() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [moves, setMoves] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [bestEasy, setBestEasy] = useState<number | null>(null);
  const [bestHard, setBestHard] = useState<number | null>(null);

  useEffect(() => {
    const e = localStorage.getItem("memory-best-easy");
    if (e) setBestEasy(parseInt(e, 10));
    const h = localStorage.getItem("memory-best-hard");
    if (h) setBestHard(parseInt(h, 10));
  }, []);

  // Timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Check win
  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.matched)) {
      setRunning(false);
      setWon(true);
      const key = difficulty === "easy" ? "memory-best-easy" : "memory-best-hard";
      const current = difficulty === "easy" ? bestEasy : bestHard;
      if (current === null || moves < current) {
        if (difficulty === "easy") setBestEasy(moves);
        else setBestHard(moves);
        localStorage.setItem(key, String(moves));
      }
    }
  }, [cards, moves, bestEasy, bestHard, difficulty]);

  // Clear "justMatched" flag after animation
  useEffect(() => {
    if (cards.some((c) => c.justMatched)) {
      const t = setTimeout(() => {
        setCards((p) => p.map((c) => ({ ...c, justMatched: false })));
      }, 600);
      return () => clearTimeout(t);
    }
  }, [cards]);

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    setCards(makeDeck(diff));
    setMoves(0);
    setStreak(0);
    setMaxStreak(0);
    setTime(0);
    setWon(false);
    setRunning(false);
    setBusy(false);
  };

  const flip = useCallback(
    (id: number) => {
      if (busy || won) return;
      if (!running) setRunning(true);

      setCards((prev) => {
        const card = prev.find((c) => c.id === id);
        if (!card || card.flipped || card.matched) return prev;

        const flipped = prev.filter((c) => c.flipped && !c.matched);
        if (flipped.length >= 2) return prev;

        const next = prev.map((c) => (c.id === id ? { ...c, flipped: true } : c));
        const nowFlipped = next.filter((c) => c.flipped && !c.matched);

        if (nowFlipped.length === 2) {
          setMoves((m) => m + 1);
          const [a, b] = nowFlipped;
          if (a.emoji === b.emoji) {
            setStreak((st) => {
              const ns = st + 1;
              setMaxStreak((ms) => Math.max(ms, ns));
              return ns;
            });
            setTimeout(() => {
              setCards((p) =>
                p.map((c) =>
                  c.id === a.id || c.id === b.id
                    ? { ...c, matched: true, justMatched: true }
                    : c
                )
              );
            }, 400);
          } else {
            setStreak(0);
            setBusy(true);
            setTimeout(() => {
              setCards((p) =>
                p.map((c) =>
                  c.id === a.id || c.id === b.id ? { ...c, flipped: false } : c
                )
              );
              setBusy(false);
            }, 900);
          }
        }
        return next;
      });
    },
    [busy, won, running]
  );

  const restart = () => {
    if (difficulty) startGame(difficulty);
  };

  const backToMenu = () => {
    setDifficulty(null);
    setCards([]);
    setRunning(false);
    setWon(false);
  };

  if (!difficulty) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">
          PICK YOUR DIFFICULTY
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => startGame("easy")}
            className="pixel-edge px-8 py-6 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] text-left"
          >
            <div className="font-[family-name:var(--font-display)] text-sm text-[var(--crt-green)] mb-2">
              EASY
            </div>
            <div className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)]">
              4×4 grid &middot; 8 pairs
            </div>
            <div className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mt-2">
              Best: {bestEasy ?? "—"} moves
            </div>
          </button>
          <button
            onClick={() => startGame("hard")}
            className="pixel-edge px-8 py-6 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] text-left"
          >
            <div className="font-[family-name:var(--font-display)] text-sm text-[var(--danger)] mb-2">
              HARD
            </div>
            <div className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)]">
              6×6 grid &middot; 18 pairs
            </div>
            <div className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mt-2">
              Best: {bestHard ?? "—"} moves
            </div>
          </button>
        </div>
      </div>
    );
  }

  const pairs = cards.length / 2;
  const cols = difficulty === "easy" ? 4 : 6;
  const best = difficulty === "easy" ? bestEasy : bestHard;
  const stars = won ? starsForScore(moves, pairs) : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] font-[family-name:var(--font-mono)] text-xl flex-wrap gap-2">
        <span>
          <span className="text-[var(--muted)]">MOVES </span>
          <span className="text-[var(--crt-green)]">{String(moves).padStart(3, "0")}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">TIME </span>
          <span className="text-[var(--accent)]">{String(time).padStart(3, "0")}s</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">STREAK </span>
          <span className="text-[var(--foreground)]">{streak}</span>
        </span>
        <span>
          <span className="text-[var(--muted)]">BEST </span>
          <span className="text-[var(--foreground)]">
            {best === null ? "—" : String(best).padStart(3, "0")}
          </span>
        </span>
      </div>

      {streak >= 2 && (
        <div className="font-[family-name:var(--font-display)] text-xs text-[var(--accent-hot)] flicker">
          {streak}× COMBO!
        </div>
      )}

      <div className="relative w-full max-w-[600px]">
        <div
          className="grid gap-2 sm:gap-3 p-3 sm:p-4 rounded border-2 border-[var(--border)] bg-[var(--surface)]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {cards.map((card) => {
            const isOpen = card.flipped || card.matched;
            return (
              <button
                key={card.id}
                onClick={() => flip(card.id)}
                className="aspect-square relative"
                style={{ perspective: "600px" }}
                disabled={card.matched}
                aria-label="memory card"
              >
                <div
                  className="absolute inset-0 transition-transform duration-300"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Card back */}
                  <div
                    className="absolute inset-0 rounded pixel-edge bg-[var(--surface-2)] flex items-center justify-center"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <span className="font-[family-name:var(--font-display)] text-sm sm:text-base text-[var(--accent)]">
                      ?
                    </span>
                  </div>
                  {/* Card front */}
                  <div
                    className={`absolute inset-0 rounded pixel-edge flex items-center justify-center text-3xl sm:text-5xl ${
                      card.matched
                        ? card.justMatched
                          ? "bg-[var(--crt-green)]/40 ring-4 ring-[var(--crt-green)]"
                          : "bg-[var(--crt-green)]/20 opacity-70"
                        : "bg-[var(--accent)]/20"
                    }`}
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <span
                      className={card.justMatched ? "scale-125 transition-transform" : ""}
                    >
                      {card.emoji}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--crt-green)] mb-2">
              YOU WIN!
            </h2>
            <div className="text-3xl mb-2 tracking-widest">
              {"★".repeat(stars)}
              <span className="text-[var(--muted)]">{"★".repeat(3 - stars)}</span>
            </div>
            <p className="font-[family-name:var(--font-mono)] text-2xl text-[var(--foreground)]">
              {moves} moves &middot; {time}s
            </p>
            {maxStreak > 1 && (
              <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent-hot)] mb-1">
                best streak: {maxStreak}×
              </p>
            )}
            {best === moves && (
              <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--accent)] mb-3 flicker">
                ★ NEW BEST! ★
              </p>
            )}
            <div className="flex gap-3 mt-3">
              <button
                onClick={restart}
                className="pixel-edge px-4 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
              >
                AGAIN
              </button>
              <button
                onClick={backToMenu}
                className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] text-[var(--foreground)] font-[family-name:var(--font-display)] text-xs"
              >
                MENU
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-1">
        <button
          onClick={restart}
          className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] text-[var(--foreground)] font-[family-name:var(--font-mono)] text-lg"
        >
          ↻ Reset
        </button>
        <button
          onClick={backToMenu}
          className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] text-[var(--foreground)] font-[family-name:var(--font-mono)] text-lg"
        >
          ← Menu
        </button>
      </div>
    </div>
  );
}
