"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useQuality } from "./QualityContext";
import { detectTier, type QualityTier } from "./quality";

/** Error boundary: a thrown 3D tree shows a Retry panel, never a white screen. */
export class CrashErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  retry = () => this.setState({ failed: false });
  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)] mb-2">
            Rendering hiccup
          </p>
          <button
            onClick={this.retry}
            className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-sm"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Probes the live GPU once and reports context-loss/restore to the parent.
 *
 * The parent (`Viewport`) is unmemoized and re-renders frequently during play
 * (score/timer updates), which recreates the `onTier`/`onContextLost`/
 * `onContextRestored` callbacks on every render. To keep the GPU probe and
 * the context-loss listeners truly "once per mount", the latest callbacks are
 * stashed in refs and the effect below depends only on `gl` — so a parent
 * re-render never tears down and re-adds the listeners, and never re-probes
 * (a `hasProbed` ref belt-and-suspenders against that even if `gl` itself
 * were ever to change identity).
 */
function GlWatchdog({
  onTier,
  onContextLost,
  onContextRestored,
}: {
  onTier: (t: QualityTier) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
}) {
  const gl = useThree((s) => s.gl);

  const onTierRef = useRef(onTier);
  const onContextLostRef = useRef(onContextLost);
  const onContextRestoredRef = useRef(onContextRestored);
  useEffect(() => {
    onTierRef.current = onTier;
    onContextLostRef.current = onContextLost;
    onContextRestoredRef.current = onContextRestored;
  }, [onTier, onContextLost, onContextRestored]);

  const hasProbed = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    // One-time GPU probe -> initial tier.
    if (!hasProbed.current) {
      hasProbed.current = true;
      try {
        const ext = gl.getContext().getExtension("WEBGL_debug_renderer_info");
        const renderer = ext
          ? (gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
          : "";
        const maxTex = gl.getContext().getParameter(gl.getContext().MAX_TEXTURE_SIZE) as number;
        onTierRef.current(detectTier({ renderer, maxTextureSize: maxTex }));
      } catch {
        /* keep the provider default */
      }
    }
    const lost = (e: Event) => {
      e.preventDefault(); // lets Three restore instead of dying
      onContextLostRef.current();
    };
    const restored = () => onContextRestoredRef.current();
    canvas.addEventListener("webglcontextlost", lost as EventListener);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost as EventListener);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl]);
  return null;
}

export function Viewport({
  children,
  cameraPosition = [0, 6, 18],
  fov = 55,
  background,
}: {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  fov?: number;
  background: string;
}) {
  const { settings, setTier } = useQuality();
  const [lostAt, setLostAt] = useState<number | null>(null);

  return (
    <CrashErrorBoundary>
      <Canvas
        shadows={settings.shadowMapSize === 0 ? false : "percentage"}
        dpr={[1, settings.maxPixelRatio]}
        camera={{ position: cameraPosition, fov }}
      >
        <color attach="background" args={[background]} />
        <PerformanceMonitor
          onDecline={() => setTier(settings.tier === "high" ? "med" : "low")}
          onIncline={() => setTier(settings.tier === "low" ? "med" : "high")}
        />
        <GlWatchdog
          onTier={setTier}
          onContextLost={() => setLostAt(Date.now())}
          onContextRestored={() => setLostAt(null)}
        />
        {children}
      </Canvas>
      {lostAt !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none">
          <span className="font-[family-name:var(--font-mono)] text-[var(--muted)]">
            Restoring graphics…
          </span>
        </div>
      )}
    </CrashErrorBoundary>
  );
}
