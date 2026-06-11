"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 640;
const HEIGHT = 460;
const BALL_R = 9;
const GRAVITY = 0.22;
const FRICTION = 0.999;
const BOUNCE = 0.2;

type Seg = { x1: number; y1: number; x2: number; y2: number };

export default function LineRider() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [segCount, setSegCount] = useState(0);

  const s = useRef({
    segments: [] as Seg[],
    drawing: false,
    startX: 0, startY: 0,
    curX: 0, curY: 0,
    // rider
    rx: 60, ry: 60,
    vx: 0, vy: 0,
    playing: false,
    startPos: { x: 60, y: 60 },
    trail: [] as { x: number; y: number }[],
    crashed: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      const st = s.current;

      if (st.playing && !st.crashed) {
        // Physics: gravity
        st.vy += GRAVITY;
        st.vx *= FRICTION;
        st.rx += st.vx;
        st.ry += st.vy;

        // Collide with each segment
        for (const seg of st.segments) {
          const dx = seg.x2 - seg.x1;
          const dy = seg.y2 - seg.y1;
          const lenSq = dx * dx + dy * dy || 1;
          let t = ((st.rx - seg.x1) * dx + (st.ry - seg.y1) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const closestX = seg.x1 + t * dx;
          const closestY = seg.y1 + t * dy;
          const distX = st.rx - closestX;
          const distY = st.ry - closestY;
          const dist = Math.hypot(distX, distY);
          if (dist < BALL_R && dist > 0.0001) {
            // Push out along normal
            const nx = distX / dist;
            const ny = distY / dist;
            const overlap = BALL_R - dist;
            st.rx += nx * overlap;
            st.ry += ny * overlap;
            // Reflect velocity: remove normal component (with bounce), keep tangential
            const vDotN = st.vx * nx + st.vy * ny;
            st.vx -= (1 + BOUNCE) * vDotN * nx;
            st.vy -= (1 + BOUNCE) * vDotN * ny;
          }
        }

        // Trail
        st.trail.push({ x: st.rx, y: st.ry });
        if (st.trail.length > 60) st.trail.shift();

        // Fell off screen
        if (st.ry > HEIGHT + 200 || st.rx < -200 || st.rx > WIDTH + 200) {
          st.crashed = true;
        }
      }

      // ===== DRAW =====
      ctx.fillStyle = "#f5efe2";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Subtle grid (graph paper)
      ctx.strokeStyle = "#e0d5c0";
      ctx.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
      for (let y = 0; y <= HEIGHT; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }

      // Segments
      ctx.strokeStyle = "#2a1810";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const seg of st.segments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }

      // Live drawing preview
      if (st.drawing) {
        ctx.strokeStyle = "#ff6b1a";
        ctx.beginPath();
        ctx.moveTo(st.startX, st.startY);
        ctx.lineTo(st.curX, st.curY);
        ctx.stroke();
      }

      // Start marker
      if (!st.playing) {
        ctx.fillStyle = "#7fd650";
        ctx.beginPath();
        ctx.arc(st.startPos.x, st.startPos.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2a1810";
        ctx.font = "12px monospace";
        ctx.fillText("START", st.startPos.x + 12, st.startPos.y + 4);
      }

      // Trail
      if (st.trail.length > 1) {
        ctx.strokeStyle = "rgba(255, 107, 26, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(st.trail[0].x, st.trail[0].y);
        for (const t of st.trail) ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }

      // Rider (sled)
      if (st.playing) {
        ctx.fillStyle = st.crashed ? "#d63d3d" : "#ff6b1a";
        ctx.beginPath();
        ctx.arc(st.rx, st.ry, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(st.rx - 3, st.ry - 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.Touch, rect: DOMRect) => ({
    x: (e.clientX - rect.left) * (WIDTH / rect.width),
    y: (e.clientY - rect.top) * (HEIGHT / rect.height),
  });

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (s.current.playing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = getPos(e, rect);
    s.current.drawing = true;
    s.current.startX = p.x; s.current.startY = p.y;
    s.current.curX = p.x; s.current.curY = p.y;
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!s.current.drawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = getPos(e, rect);
    s.current.curX = p.x; s.current.curY = p.y;
  };
  const onUp = () => {
    const st = s.current;
    if (!st.drawing) return;
    st.drawing = false;
    const len = Math.hypot(st.curX - st.startX, st.curY - st.startY);
    if (len > 6) {
      st.segments.push({ x1: st.startX, y1: st.startY, x2: st.curX, y2: st.curY });
      setSegCount(st.segments.length);
    }
  };

  const play = () => {
    const st = s.current;
    st.playing = true;
    st.crashed = false;
    st.rx = st.startPos.x; st.ry = st.startPos.y;
    st.vx = 0; st.vy = 0;
    st.trail = [];
    setPlaying(true);
  };
  const stop = () => {
    const st = s.current;
    st.playing = false;
    st.crashed = false;
    st.trail = [];
    setPlaying(false);
  };
  const clearAll = () => {
    const st = s.current;
    st.segments = [];
    st.playing = false;
    st.trail = [];
    setSegCount(0);
    setPlaying(false);
  };
  const undo = () => {
    s.current.segments.pop();
    setSegCount(s.current.segments.length);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[640px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-2">
        <span><span className="text-[var(--muted)]">LINES </span><span className="text-[var(--crt-green)]">{segCount}</span></span>
        <div className="flex gap-2">
          {!playing ? (
            <button onClick={play} disabled={segCount === 0}
              className="pixel-edge px-4 py-1.5 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs disabled:opacity-40">
              ▶ RIDE
            </button>
          ) : (
            <button onClick={stop}
              className="pixel-edge px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              ✎ EDIT
            </button>
          )}
          <button onClick={undo} disabled={playing || segCount === 0}
            className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base disabled:opacity-40">
            undo
          </button>
          <button onClick={clearAll} disabled={playing}
            className="pixel-edge px-3 py-1.5 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base disabled:opacity-40">
            clear
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-[640px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className={`w-full h-full rounded border-2 border-[var(--border)] ${playing ? "" : "cursor-crosshair"}`}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        />
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Click and drag to draw track lines from the green START dot.
        Build ramps and slopes, then hit RIDE to watch gravity take the sled. EDIT to keep drawing.
      </p>
    </div>
  );
}
