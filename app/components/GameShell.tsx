"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartridgeMeta } from "@/lib/platform/cartridge";
import { useMuted } from "@/lib/platform/audio";
import { setGamePaused } from "@/lib/platform/pauseBus";
import { installPauseFreeze } from "@/lib/platform/pauseFreeze";

interface GameShellProps {
  meta: CartridgeMeta;
  /** Game accent colour from lib/games.ts, for the loading bar. */
  accent: string;
  children: React.ReactNode;
}

/**
 * Wraps every game with the shared chrome: loading screen, pause overlay, and
 * fullscreen. Unmigrated games get all of this without any change to their
 * own code.
 *
 * Pause sets the global pause bus (so migrated games can stop sim loops) and
 * blocks keyboard capture so unmigrated games cannot keep playing under the
 * overlay.
 */
export default function GameShell({ meta, accent, children }: GameShellProps) {
  const [paused, setPaused] = useState(false);
  const [muted, setMutedValue] = useMuted();
  const containerRef = useRef<HTMLDivElement>(null);
  const canPause = meta.supportsPause !== false;

  const pause = useCallback(() => {
    setPaused(true);
    setGamePaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    setGamePaused(false);
  }, []);

  // Install global rAF freeze once so unmigrated games stop under pause too.
  useEffect(() => {
    installPauseFreeze();
  }, []);

  // Clear global pause when leaving a game page.
  useEffect(() => {
    return () => {
      setGamePaused(false);
    };
  }, []);

  // Block keyboard while paused so rAF games that still listen on window
  // cannot be steered under the overlay (covers unmigrated games too).
  useEffect(() => {
    if (!paused) return;
    const block = (e: KeyboardEvent) => {
      // Allow Escape to resume for accessibility.
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        resume();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    window.addEventListener("keyup", block, true);
    return () => {
      window.removeEventListener("keydown", block, true);
      window.removeEventListener("keyup", block, true);
    };
  }, [paused, resume]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-2 flex items-center justify-end gap-2">
        {canPause && (
          <button
            onClick={pause}
            aria-label="Pause game"
            className="pixel-edge t-body px-3 py-1 rounded bg-[var(--surface-2)]"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={() => setMutedValue(!muted)}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
          className="pixel-edge t-body px-3 py-1 rounded bg-[var(--surface-2)]"
        >
          {muted ? "🔇 Muted" : "🔊 Sound"}
        </button>
        <button
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className="pixel-edge t-body px-3 py-1 rounded bg-[var(--surface-2)]"
        >
          ⛶ Fullscreen
        </button>
      </div>

      <div className={paused ? "pointer-events-none" : undefined} aria-hidden={paused || undefined}>
        {children}
      </div>

      {paused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 rounded-lg">
          <h2
            className="t-display-lg mb-4"
            style={{ color: accent }}
          >
            PAUSED
          </h2>
          <button
            onClick={resume}
            aria-label="Resume game"
            className="pixel-edge t-display-sm px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)]"
          >
            RESUME
          </button>
          <p className="t-body mt-3 text-[var(--muted)]">
            Esc to resume
          </p>
        </div>
      )}
    </div>
  );
}
