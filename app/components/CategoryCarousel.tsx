"use client";

import { useRef } from "react";
import GameTile from "./GameTile";
import type { Game } from "@/lib/games";

export default function CategoryCarousel({ label, games }: { label: string; games: Game[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="t-display-md text-[var(--accent)] flex items-baseline gap-2">
          {label}
          <span className="t-caption text-[var(--muted)]">{games.length}</span>
        </h2>
        <div className="hidden sm:flex gap-1.5">
          <button
            onClick={() => scroll(-1)}
            aria-label="scroll left"
            className="pixel-edge w-8 h-8 rounded bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--accent)]/30 transition-colors t-body leading-none"
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="scroll right"
            className="pixel-edge w-8 h-8 rounded bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--accent)]/30 transition-colors t-body leading-none"
          >
            ›
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-[var(--surface)] [&::-webkit-scrollbar-thumb]:bg-[var(--border)] [&::-webkit-scrollbar-thumb]:rounded"
      >
        {games.map((g) => (
          <div key={g.slug} className="snap-start flex-shrink-0 w-60 sm:w-64">
            <GameTile game={g} />
          </div>
        ))}
      </div>
    </section>
  );
}
