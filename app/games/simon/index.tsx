"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isMuted as platformMuted } from "@/lib/platform/audio";
import { useCartridge } from "@/lib/platform/useCartridge";

const PADS = [
  { id: 0, color: "#7fd650", lit: "#b8f088", freq: 330 },
  { id: 1, color: "#d63d3d", lit: "#ff7070", freq: 392 },
  { id: 2, color: "#5fc8e0", lit: "#a0e8ff", freq: 494 },
  { id: 3, color: "#ffd060", lit: "#fff0b0", freq: 587 },
];

export default function Simon() {
  // Ref'd because handlePad() is reached from timer-driven callbacks, which
  // close over their first render — reading `host` directly would go stale.
  const { host } = useCartridge("simon");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [sequence, setSequence] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showing, setShowing] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("Watch the sequence");
  const inputIndex = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    const b = localStorage.getItem("simon-best");
    if (b) setBest(parseInt(b, 10));
  }, []);

  const beep = (freq: number, dur = 0.3) => {
    if (!audioCtx.current || platformMuted()) return;
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  };

  const flash = useCallback((id: number, dur = 350) => {
    setActive(id);
    beep(PADS[id].freq, dur / 1000);
    setTimeout(() => setActive(null), dur - 60);
  }, []);

  const playSequence = useCallback((seq: number[]) => {
    setShowing(true);
    setMessage("Watch...");
    let i = 0;
    const interval = setInterval(() => {
      if (i >= seq.length) {
        clearInterval(interval);
        setTimeout(() => { setShowing(false); setMessage("Your turn!"); inputIndex.current = 0; }, 300);
        return;
      }
      flash(seq[i]);
      i++;
    }, 600);
  }, [flash]);

  const start = () => {
    if (!audioCtx.current) { try { audioCtx.current = new AudioContext(); } catch { /* */ } }
    const first = [Math.floor(Math.random() * 4)];
    setSequence(first);
    setRound(1);
    setPlaying(true);
    setGameOver(false);
    inputIndex.current = 0;
    setTimeout(() => playSequence(first), 600);
  };

  const nextRound = useCallback((seq: number[]) => {
    const next = [...seq, Math.floor(Math.random() * 4)];
    setSequence(next);
    setRound(next.length);
    inputIndex.current = 0;
    setTimeout(() => playSequence(next), 700);
  }, [playSequence]);

  const handlePad = (id: number) => {
    if (!playing || showing || gameOver) return;
    flash(id, 250);
    if (id === sequence[inputIndex.current]) {
      inputIndex.current++;
      if (inputIndex.current >= sequence.length) {
        setMessage("Nice! Next round...");
        if (sequence.length > best) { setBest(sequence.length); localStorage.setItem("simon-best", String(sequence.length)); }
        setTimeout(() => nextRound(sequence), 600);
      }
    } else {
      // Wrong
      setMessage("Wrong!");
      setGameOver(true);
      setPlaying(false);
      beep(110, 0.5);
      // Endless memory game — the round reached is the score.
      hostRef.current.reportScore(sequence.length);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-[360px] font-[family-name:var(--font-mono)] text-xl">
        <span><span className="text-[var(--muted)]">ROUND </span><span className="text-[var(--crt-green)]">{round}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{best}</span></span>
      </div>

      <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px]">
        <div className="grid grid-cols-2 gap-3 w-full h-full">
          {PADS.map((pad) => (
            <button
              key={pad.id}
              onClick={() => handlePad(pad.id)}
              disabled={!playing || showing}
              className="rounded-2xl pixel-edge transition-all duration-100"
              style={{
                background: active === pad.id ? pad.lit : pad.color,
                opacity: active === pad.id ? 1 : 0.55,
                boxShadow: active === pad.id ? `0 0 30px ${pad.lit}` : "none",
                transform: active === pad.id ? "scale(0.97)" : "scale(1)",
              }}
              aria-label={`pad ${pad.id}`}
            />
          ))}
        </div>
        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-[var(--background)] border-4 border-[var(--border)] flex items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-xs text-[var(--accent)]">{round || "—"}</span>
        </div>

        {(!playing && !gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-3">SIMON</h2>
            <button onClick={start} className="pixel-edge px-6 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">START</button>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-2xl">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[#d63d3d] mb-1">GAME OVER</h2>
            <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">Round {round}</p>
            {round - 1 >= best && round > 1 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ BEST ★</p>}
            <button onClick={start} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">PLAY AGAIN</button>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] h-6">{playing ? message : ""}</p>
      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Watch the pattern light up, then repeat it by clicking the pads in order. Each round adds one more step.
      </p>
    </div>
  );
}
