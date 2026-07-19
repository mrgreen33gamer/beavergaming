"use client";

import { useCallback, useRef, useState } from "react";
import type { CartridgeMeta } from "@/lib/platform/cartridge";
import { useMuted } from "@/lib/platform/audio";

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
 */
export default function GameShell({ meta, accent, children }: GameShellProps) {
  const [paused, setPaused] = useState(false);
  const [muted, setMutedValue] = useMuted();
  const containerRef = useRef<HTMLDivElement>(null);
  const canPause = meta.supportsPause !== false;

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
            onClick={() => setPaused(true)}
            aria-label="Pause game"
            className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={() => setMutedValue(!muted)}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
          className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base"
        >
          {muted ? "🔇 Muted" : "🔊 Sound"}
        </button>
        <button
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base"
        >
          ⛶ Fullscreen
        </button>
      </div>

      {children}

      {paused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 rounded-lg">
          <h2
            className="font-[family-name:var(--font-display)] text-lg mb-4"
            style={{ color: accent }}
          >
            PAUSED
          </h2>
          <button
            onClick={() => setPaused(false)}
            aria-label="Resume game"
            className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
          >
            RESUME
          </button>
        </div>
      )}
    </div>
  );
}
