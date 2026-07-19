"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GameTile from "./GameTile";
import type { Game } from "@/lib/games";

export default function CategoryCarousel({ label, games }: { label: string; games: Game[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * The arrows are the only visible control now that the scrollbar is hidden,
   * so they have to reflect reality — an arrow that does nothing at the end of
   * a row is worse than no arrow.
   */
  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // Scroll-snap combined with the row's horizontal padding parks the
    // resting position a few pixels off zero, and fractional layout widths
    // mean scrollLeft rarely lands exactly on max — so both ends need slack
    // or the arrows never report "at the end".
    const EDGE_SLACK = 8;
    setAtStart(el.scrollLeft <= EDGE_SLACK);
    setAtEnd(el.scrollLeft >= max - EDGE_SLACK);
  }, []);

  useEffect(() => {
    sync();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);

  const scroll = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollBy's smooth behaviour is a JS API and ignores the CSS
    // prefers-reduced-motion override, so it is checked explicitly.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Page by roughly a viewport of tiles rather than a fixed pixel count, so
    // the step stays sensible from phone to desktop.
    el.scrollBy({
      left: dir * Math.max(240, el.clientWidth * 0.8),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const arrow =
    "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/95 text-2xl leading-none text-[var(--foreground)] shadow-lg transition disabled:pointer-events-none disabled:opacity-0 hover:border-[var(--accent)] hover:text-[var(--accent)] sm:flex";

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="t-display-md flex items-baseline gap-2 text-[var(--accent)]">
          {label}
          <span className="t-caption text-[var(--muted)]">{games.length}</span>
        </h2>
      </div>

      {/* Deliberately not a Tailwind `group`: each GameTile is its own group,
          and `group-hover:` matches any ancestor carrying the class — a group
          here would reveal the play overlay on every tile in the row at once. */}
      <div className="relative">
        {/* Edge fades hint that the row continues, which the hidden scrollbar
            no longer communicates. Pointer-events off so they never eat a
            click on a tile underneath. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--background)] to-transparent transition-opacity duration-200 ${
            atStart ? "opacity-0" : "opacity-100"
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--background)] to-transparent transition-opacity duration-200 ${
            atEnd ? "opacity-0" : "opacity-100"
          }`}
        />

        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={atStart}
          aria-label={`Scroll ${label} games left`}
          className={`${arrow} left-2`}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={atEnd}
          aria-label={`Scroll ${label} games right`}
          className={`${arrow} right-2`}
        >
          ›
        </button>

        <div
          ref={scrollRef}
          onScroll={sync}
          className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 pb-3"
        >
          {games.map((g) => (
            <div key={g.slug} className="w-60 shrink-0 snap-start sm:w-64">
              <GameTile game={g} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
