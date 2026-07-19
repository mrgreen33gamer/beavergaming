"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 640;
const HEIGHT = 460;
const BALL_R = 7;
const HOLE_R = 12;
const FRICTION = 0.985;
const MIN_VEL = 0.07;
const MAX_POWER = 12;

type Wall = { x: number; y: number; w: number; h: number };
type Hole = { tee: { x: number; y: number }; hole: { x: number; y: number }; walls: Wall[]; par: number };

// Six course holes — designed to be fair, increasingly tricky
const COURSE: Hole[] = [
  { tee: { x: 80, y: 230 }, hole: { x: 540, y: 230 }, walls: [], par: 2 },
  { tee: { x: 80, y: 380 }, hole: { x: 560, y: 80 }, walls: [{ x: 200, y: 0, w: 24, h: 280 }, { x: 380, y: 180, w: 24, h: 280 }], par: 3 },
  { tee: { x: 80, y: 230 }, hole: { x: 560, y: 230 }, walls: [{ x: 250, y: 120, w: 24, h: 220 }, { x: 380, y: 0, w: 24, h: 220 }], par: 3 },
  { tee: { x: 80, y: 80 }, hole: { x: 560, y: 380 }, walls: [{ x: 200, y: 60, w: 200, h: 24 }, { x: 240, y: 360, w: 200, h: 24 }], par: 3 },
  { tee: { x: 80, y: 230 }, hole: { x: 560, y: 230 }, walls: [{ x: 280, y: 140, w: 24, h: 180 }, { x: 200, y: 80, w: 220, h: 24 }, { x: 220, y: 360, w: 220, h: 24 }], par: 4 },
  { tee: { x: 80, y: 80 }, hole: { x: 560, y: 380 }, walls: [{ x: 200, y: 50, w: 24, h: 200 }, { x: 320, y: 200, w: 24, h: 210 }, { x: 440, y: 50, w: 24, h: 200 }, { x: 200, y: 230, w: 144, h: 22 }, { x: 320, y: 180, w: 144, h: 22 }], par: 5 },
];

export default function MiniGolf() {
  // Ref'd because the hole-sunk handler runs inside the canvas loop, which
  // closes over its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("mini-golf");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [holeIdx, setHoleIdx] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPar, setTotalPar] = useState(0);
  const [showHole, setShowHole] = useState(true);
  const [holed, setHoled] = useState(false);
  const [bestTotal, setBestTotal] = useState<number | null>(null);

  const s = useRef({
    bx: 80, by: 230,
    bvx: 0, bvy: 0,
    rolling: false,
    aiming: false,
    aimX: 0, aimY: 0,
    holed: false,
    strokes: 0,
    total: 0, totalPar: 0,
    lastSync: 0,
  });

  useEffect(() => {
    const b = localStorage.getItem("minigolf-best-total");
    if (b) setBestTotal(parseInt(b, 10));
    loadHole(0);
   
  }, []);

  const loadHole = (i: number) => {
    const st = s.current;
    const h = COURSE[i];
    st.bx = h.tee.x; st.by = h.tee.y; st.bvx = 0; st.bvy = 0;
    st.rolling = false; st.aiming = false;
    st.holed = false; st.strokes = 0;
    setHoleIdx(i); setStrokes(0); setShowHole(true); setHoled(false);
    setTimeout(() => setShowHole(false), 1100);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;
      const h = COURSE[holeIdx];

      if (st.rolling) {
        st.bx += st.bvx; st.by += st.bvy;
        st.bvx *= FRICTION; st.bvy *= FRICTION;
        // Bounce off canvas edges
        if (st.bx < BALL_R) { st.bx = BALL_R; st.bvx = -st.bvx * 0.7; }
        if (st.bx > WIDTH - BALL_R) { st.bx = WIDTH - BALL_R; st.bvx = -st.bvx * 0.7; }
        if (st.by < BALL_R) { st.by = BALL_R; st.bvy = -st.bvy * 0.7; }
        if (st.by > HEIGHT - BALL_R) { st.by = HEIGHT - BALL_R; st.bvy = -st.bvy * 0.7; }
        // Bounce off walls (AABB)
        for (const w of h.walls) {
          const cx = Math.max(w.x, Math.min(st.bx, w.x + w.w));
          const cy = Math.max(w.y, Math.min(st.by, w.y + w.h));
          const dx = st.bx - cx, dy = st.by - cy;
          const dist = Math.hypot(dx, dy);
          if (dist < BALL_R) {
            // determine which side hit by penetration depth
            const overlapX = BALL_R - Math.abs(dx);
            const overlapY = BALL_R - Math.abs(dy);
            if (overlapX < overlapY) { st.bx += Math.sign(dx) * overlapX; st.bvx = -st.bvx * 0.78; }
            else { st.by += Math.sign(dy) * overlapY; st.bvy = -st.bvy * 0.78; }
          }
        }
        // Hole capture: only if slow enough
        const dxh = st.bx - h.hole.x, dyh = st.by - h.hole.y;
        const dh = Math.hypot(dxh, dyh);
        const sp = Math.hypot(st.bvx, st.bvy);
        if (dh < HOLE_R && sp < 5) {
          st.rolling = false; st.bvx = 0; st.bvy = 0;
          st.bx = h.hole.x; st.by = h.hole.y;
          st.holed = true;
          st.total += st.strokes; st.totalPar += h.par;
          setTotal(st.total); setTotalPar(st.totalPar);
          setHoled(true);
          hostRef.current.reportEvent("level_cleared");
        }
        // Stop if very slow
        if (sp < MIN_VEL) { st.bvx = 0; st.bvy = 0; st.rolling = false; }
      }

      // ===== DRAW =====
      // Fairway gradient
      const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 100, WIDTH / 2, HEIGHT / 2, 500);
      g.addColorStop(0, "#4a7a30"); g.addColorStop(1, "#2e5220");
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Subtle grass pattern
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 73) % WIDTH, (i * 41) % HEIGHT, 2, 2);
      // Border
      ctx.strokeStyle = "#2a1810"; ctx.lineWidth = 4; ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4);

      // Walls (brick)
      for (const w of h.walls) {
        ctx.fillStyle = "#5a3a22"; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "#7a5a34"; ctx.fillRect(w.x, w.y, w.w, 3);
        ctx.fillStyle = "#3a2218"; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
      }

      // Hole
      ctx.fillStyle = "#1a0e0a"; ctx.beginPath(); ctx.arc(h.hole.x, h.hole.y, HOLE_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0a0608"; ctx.lineWidth = 2; ctx.stroke();
      // Flag
      ctx.fillStyle = "#fff"; ctx.fillRect(h.hole.x - 1, h.hole.y - 30, 2, 22);
      ctx.fillStyle = "#d63d3d"; ctx.beginPath(); ctx.moveTo(h.hole.x + 1, h.hole.y - 30); ctx.lineTo(h.hole.x + 14, h.hole.y - 26); ctx.lineTo(h.hole.x + 1, h.hole.y - 22); ctx.closePath(); ctx.fill();

      // Tee marker (when ball at tee)
      if (st.strokes === 0 && !st.rolling) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath();
        ctx.arc(h.tee.x, h.tee.y, BALL_R + 5, 0, Math.PI * 2); ctx.stroke();
      }

      // Aim line
      if (st.aiming && !st.rolling) {
        const dx = st.aimX - st.bx, dy = st.aimY - st.by;
        const dist = Math.min(Math.hypot(dx, dy), 120);
        const a = Math.atan2(dy, dx);
        const ex = st.bx + Math.cos(a) * dist * -1, ey = st.by + Math.sin(a) * dist * -1;
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(st.bx, st.by); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        // power dot
        ctx.fillStyle = dist > 100 ? "#d63d3d" : dist > 60 ? "#ffd060" : "#7fd650";
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
      }

      // Ball
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(st.bx + 1, st.by + 2, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f5e8d0"; ctx.beginPath(); ctx.arc(st.bx, st.by, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b8a088"; ctx.beginPath(); ctx.arc(st.bx + 2, st.by + 2, 2, 0, Math.PI * 2); ctx.fill();

      // HUD
      ctx.fillStyle = "#1a0e0a"; ctx.fillRect(8, HEIGHT - 30, 200, 22);
      ctx.fillStyle = "#f5e8d0"; ctx.font = "13px monospace";
      ctx.fillText(`HOLE ${holeIdx + 1}/${COURSE.length}   PAR ${h.par}   STROKES ${st.strokes}`, 14, HEIGHT - 14);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
   
  }, [holeIdx]);

  const pos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (WIDTH / rect.width), y: (e.clientY - rect.top) * (HEIGHT / rect.height) };
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = s.current;
    if (st.rolling || st.holed) return;
    const p = pos(e);
    if (Math.hypot(p.x - st.bx, p.y - st.by) > 35 && !st.aiming) {
      // Only aim if click is reasonably close to the ball (lets you drag from anywhere within a margin too)
    }
    st.aiming = true; st.aimX = p.x; st.aimY = p.y;
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = s.current;
    if (!st.aiming) return;
    const p = pos(e); st.aimX = p.x; st.aimY = p.y;
  };
  const onUp = () => {
    const st = s.current;
    if (!st.aiming || st.rolling || st.holed) { st.aiming = false; return; }
    const dx = st.aimX - st.bx, dy = st.aimY - st.by;
    const dist = Math.min(Math.hypot(dx, dy), 120);
    if (dist < 8) { st.aiming = false; return; }
    const a = Math.atan2(dy, dx);
    const power = (dist / 120) * MAX_POWER;
    st.bvx = -Math.cos(a) * power; st.bvy = -Math.sin(a) * power;
    st.rolling = true; st.aiming = false;
    st.strokes++; setStrokes(st.strokes);
  };

  const nextHole = () => {
    const st = s.current;
    if (holeIdx + 1 < COURSE.length) loadHole(holeIdx + 1);
    else {
      // Course finished
      if (bestTotal === null || st.total < bestTotal) { setBestTotal(st.total); localStorage.setItem("minigolf-best-total", String(st.total)); }
    }
  };

  const restart = () => { setTotal(0); setTotalPar(0); s.current.total = 0; s.current.totalPar = 0; loadHole(0); };

  const diff = total - totalPar;
  const allDone = holed && holeIdx + 1 >= COURSE.length;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[640px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">HOLE </span><span className="text-[var(--crt-green)]">{holeIdx + 1}</span>/<span className="text-[var(--muted)]">{COURSE.length}</span></span>
        <span><span className="text-[var(--muted)]">PAR </span><span className="text-[var(--foreground)]">{COURSE[holeIdx].par}</span></span>
        <span><span className="text-[var(--muted)]">STROKES </span><span className="text-[var(--accent)]">{strokes}</span></span>
        <span><span className="text-[var(--muted)]">TOTAL </span><span className="text-[var(--foreground)]">{total}</span> <span className={diff < 0 ? "text-[#7fd650]" : diff > 0 ? "text-[#d63d3d]" : "text-[var(--muted)]"}>({diff >= 0 ? "+" : ""}{diff})</span></span>
        {bestTotal !== null && <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{bestTotal}</span></span>}
      </div>

      <div className="relative w-full max-w-[640px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-crosshair" />

        {showHole && !holed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded pointer-events-none">
            <span className="font-[family-name:var(--font-display)] text-base text-[var(--accent)]">HOLE {holeIdx + 1} · PAR {COURSE[holeIdx].par}</span>
          </div>
        )}

        {holed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)] mb-2">
              {strokes === 1 ? "HOLE IN ONE!" : strokes < COURSE[holeIdx].par ? "UNDER PAR!" : strokes === COURSE[holeIdx].par ? "PAR" : "OVER PAR"}
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-3">{strokes} stroke{strokes === 1 ? "" : "s"}</p>
            {!allDone ? (
              <button onClick={nextHole} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEXT HOLE →</button>
            ) : (
              <>
                <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-1">COURSE COMPLETE</p>
                <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-3">{total} ({diff >= 0 ? "+" : ""}{diff})</p>
                {bestTotal !== null && total <= bestTotal && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW BEST ★</p>}
                <button onClick={restart} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">PLAY AGAIN</button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click and drag *away from* the ball to aim, then release to putt. Longer drag = more power. Sink the ball in as few strokes as you can.
      </p>
    </div>
  );
}
