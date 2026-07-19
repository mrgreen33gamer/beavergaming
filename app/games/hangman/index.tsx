"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WORDS = [
  "BEAVER", "HELICOPTER", "ASTEROID", "ARCADE", "JOYSTICK", "PIXEL",
  "CONSOLE", "CARTRIDGE", "INVADER", "PLATFORM", "PUZZLE", "DRAGON",
  "WIZARD", "CASTLE", "DUNGEON", "QUEST", "TREASURE", "LASER",
  "SPACESHIP", "GALAXY", "METEOR", "ROBOT", "CYBORG", "NINJA",
  "SAMURAI", "PIRATE", "SUBMARINE", "TORNADO", "VOLCANO", "GLACIER",
  "PYRAMID", "MUMMY", "VAMPIRE", "GHOST", "WEREWOLF", "GOBLIN",
  "PHOENIX", "UNICORN", "GRIFFIN", "KRAKEN", "MERMAID", "GARGOYLE",
  "SCROLL", "POTION", "AMULET", "SHIELD", "HELMET", "GAUNTLET",
  "CATAPULT", "MARATHON", "DIAMOND", "EMERALD", "SAPPHIRE", "RUBY",
];

const MAX_WRONG = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Hangman() {
  // Ref'd because the round-end effect closes over its first render — reading
  // `host` directly there would go stale.
  const { host } = useCartridge("hangman");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [word, setWord] = useState("");
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    const b = localStorage.getItem("hangman-best-streak");
    if (b) setBestStreak(parseInt(b, 10));
    newRound();
  }, []);

  const newRound = () => {
    setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setGuessed(new Set());
    setWrong(0);
  };

  const guessLetter = (l: string) => {
    if (guessed.has(l) || won || lost) return;
    const next = new Set(guessed); next.add(l);
    setGuessed(next);
    if (!word.includes(l)) setWrong((w) => w + 1);
  };

  const display = word.split("").map((ch) => (guessed.has(ch) ? ch : "_"));
  const won = word.length > 0 && word.split("").every((ch) => guessed.has(ch));
  const lost = wrong >= MAX_WRONG;

  useEffect(() => {
    if (won) {
      const ns = streak + 1; setStreak(ns);
      if (ns > bestStreak) { setBestStreak(ns); localStorage.setItem("hangman-best-streak", String(ns)); }
      hostRef.current.reportEvent("match_won");
    } else if (lost) setStreak(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, lost]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k.length === 1 && k >= "A" && k <= "Z") guessLetter(k);
      else if (e.key === "Enter" && (won || lost)) newRound();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessed, won, lost, word]);

  // Hangman SVG body parts
  const parts = [
    <circle key="head" cx="120" cy="60" r="14" stroke="#f5e8d0" strokeWidth="3" fill="none" />,
    <line key="body" x1="120" y1="74" x2="120" y2="120" stroke="#f5e8d0" strokeWidth="3" />,
    <line key="larm" x1="120" y1="88" x2="100" y2="108" stroke="#f5e8d0" strokeWidth="3" />,
    <line key="rarm" x1="120" y1="88" x2="140" y2="108" stroke="#f5e8d0" strokeWidth="3" />,
    <line key="lleg" x1="120" y1="120" x2="104" y2="146" stroke="#f5e8d0" strokeWidth="3" />,
    <line key="rleg" x1="120" y1="120" x2="136" y2="146" stroke="#f5e8d0" strokeWidth="3" />,
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[480px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">WRONG </span><span className={wrong >= 4 ? "text-[#d63d3d]" : "text-[var(--foreground)]"}>{wrong}/{MAX_WRONG}</span></span>
        <span><span className="text-[var(--muted)]">STREAK </span><span className="text-[var(--crt-green)]">{streak}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{bestStreak}</span></span>
      </div>

      <div className="relative w-full max-w-[480px] rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col items-center">
        <svg viewBox="0 0 220 200" className="w-44 h-40">
          {/* Gallows */}
          <line x1="20" y1="180" x2="100" y2="180" stroke="#7a5230" strokeWidth="4" />
          <line x1="60" y1="180" x2="60" y2="20" stroke="#7a5230" strokeWidth="4" />
          <line x1="60" y1="20" x2="120" y2="20" stroke="#7a5230" strokeWidth="4" />
          <line x1="120" y1="20" x2="120" y2="46" stroke="#7a5230" strokeWidth="3" />
          {/* Body parts based on wrong count */}
          {parts.slice(0, wrong)}
        </svg>

        <div className="flex gap-2 mt-2 text-2xl sm:text-3xl font-[family-name:var(--font-display)] text-[var(--foreground)] tracking-widest">
          {display.map((ch, i) => (
            <span key={i} className="border-b-2 border-[var(--border)] px-1 min-w-[1.2em] text-center">{ch === "_" ? "\u00A0" : ch}</span>
          ))}
        </div>

        {(won || lost) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg mb-2" style={{ color: won ? "#7fd650" : "#d63d3d" }}>
              {won ? "YOU GOT IT!" : "GAME OVER"}
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-2xl text-[var(--accent)] mb-3 tracking-widest">{word}</p>
            <button onClick={newRound} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEW WORD</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 w-full max-w-[480px]">
        {ALPHABET.map((l) => {
          const used = guessed.has(l);
          const correct = used && word.includes(l);
          return (
            <button
              key={l}
              onClick={() => guessLetter(l)}
              disabled={used || won || lost}
              className={`aspect-square pixel-edge rounded font-[family-name:var(--font-mono)] text-base sm:text-lg ${
                used ? (correct ? "bg-[#7fd650]/30 text-[#7fd650]" : "bg-[#d63d3d]/30 text-[#d63d3d]") : "bg-[var(--surface-2)] hover:bg-[var(--accent)]/30 text-[var(--foreground)]"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click letters or type to guess. Six wrong guesses and the stick figure&apos;s a goner.
      </p>
    </div>
  );
}
