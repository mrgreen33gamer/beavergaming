"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const WIDTH = 500;
const HEIGHT = 540;
const BUBBLE_R = 18;
const D = BUBBLE_R * 2;
const ROW_H = D * 0.866;        // hex spacing
const COLS_EVEN = 12;
const COLS_ODD = 11;
const TOP_MARGIN = 24;
const DANGER_Y = HEIGHT - 80;
const SHOOTER_Y = HEIGHT - 36;
const SHOT_SPEED = 11;
const COLORS = ["#d63d3d", "#7fd650", "#5fc8e0", "#ffd060", "#c45ed6"];

type Grid = (number | null)[][];

function rowCols(r: number) { return r % 2 === 0 ? COLS_EVEN : COLS_ODD; }
function cellToPx(r: number, c: number): { x: number; y: number } {
  const xOffset = r % 2 === 0 ? BUBBLE_R : BUBBLE_R + BUBBLE_R;
  return { x: xOffset + c * D, y: TOP_MARGIN + r * ROW_H };
}
function pxToNearestCell(x: number, y: number): { r: number; c: number } {
  const r = Math.max(0, Math.round((y - TOP_MARGIN) / ROW_H));
  const xOffset = r % 2 === 0 ? BUBBLE_R : BUBBLE_R + BUBBLE_R;
  const c = Math.max(0, Math.min(rowCols(r) - 1, Math.round((x - xOffset) / D)));
  return { r, c };
}

function neighbors(r: number, c: number): [number, number][] {
  const odd = r % 2 === 1;
  return [
    [r, c - 1], [r, c + 1],
    [r - 1, odd ? c : c - 1], [r - 1, odd ? c + 1 : c],
    [r + 1, odd ? c : c - 1], [r + 1, odd ? c + 1 : c],
  ];
}

function inBounds(g: Grid, r: number, c: number) { return r >= 0 && r < g.length && c >= 0 && c < rowCols(r); }

function buildGrid(initialRows: number): Grid {
  const rows = 18;
  const g: Grid = Array.from({ length: rows }, (_, r) => Array(rowCols(r)).fill(null));
  for (let r = 0; r < initialRows; r++) {
    for (let c = 0; c < rowCols(r); c++) {
      g[r][c] = Math.floor(Math.random() * COLORS.length);
    }
  }
  return g;
}

export default function BubbleShooter() {
  // Ref'd because endGame() is called from the canvas loop, which closes over
  // its first render — reading `host` directly there would go stale.
  const { host } = useCartridge("bubble-shooter");
  const hostRef = useRef(host);
  hostRef.current = host;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [over, setOver] = useState<"win" | "lose" | null>(null);
  const [started, setStarted] = useState(false);

  const s = useRef({
    grid: buildGrid(6),
    currentColor: 0,
    nextColor: 0,
    shotX: WIDTH / 2, shotY: SHOOTER_Y,
    shotVx: 0, shotVy: 0,
    shooting: false,
    angle: -Math.PI / 2,
    running: false,
    score: 0,
    falling: [] as { x: number; y: number; vy: number; color: number }[],
  });

  useEffect(() => {
    const b = localStorage.getItem("bubble-highscore");
    if (b) setHighScore(parseInt(b, 10));
  }, []);

  const pickColorFromGrid = (g: Grid): number => {
    const present = new Set<number>();
    for (const row of g) for (const v of row) if (v != null) present.add(v);
    const arr = Array.from(present);
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : Math.floor(Math.random() * COLORS.length);
  };

  const reset = () => {
    const st = s.current;
    st.grid = buildGrid(6);
    st.currentColor = pickColorFromGrid(st.grid);
    st.nextColor = pickColorFromGrid(st.grid);
    st.shotX = WIDTH / 2; st.shotY = SHOOTER_Y;
    st.shotVx = 0; st.shotVy = 0;
    st.shooting = false;
    st.running = true;
    st.score = 0;
    st.falling = [];
    setScore(0); setOver(null); setStarted(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const tryAttach = (st: typeof s.current): boolean => {
      // Check collision with any existing bubble
      for (let r = 0; r < st.grid.length; r++) {
        for (let c = 0; c < rowCols(r); c++) {
          if (st.grid[r][c] == null) continue;
          const p = cellToPx(r, c);
          if (Math.hypot(p.x - st.shotX, p.y - st.shotY) < D - 2) {
            // Find nearest empty cell to shot
            const nearest = pxToNearestCell(st.shotX, st.shotY);
            // Find an empty adjacent cell to the touched bubble closest to shot
            let bestR = nearest.r, bestC = nearest.c, bestD = Infinity;
            if (inBounds(st.grid, bestR, bestC) && st.grid[bestR][bestC] != null) bestD = Infinity;
            else if (inBounds(st.grid, bestR, bestC)) { const np = cellToPx(bestR, bestC); bestD = Math.hypot(np.x - st.shotX, np.y - st.shotY); }
            const candidates: [number, number][] = [[nearest.r, nearest.c], ...neighbors(r, c), ...neighbors(nearest.r, nearest.c)];
            for (const [rr, cc] of candidates) {
              if (!inBounds(st.grid, rr, cc) || st.grid[rr][cc] != null) continue;
              const np = cellToPx(rr, cc); const d = Math.hypot(np.x - st.shotX, np.y - st.shotY);
              if (d < bestD) { bestD = d; bestR = rr; bestC = cc; }
            }
            if (inBounds(st.grid, bestR, bestC) && st.grid[bestR][bestC] == null) {
              st.grid[bestR][bestC] = st.currentColor;
              afterAttach(st, bestR, bestC);
              return true;
            }
            return false;
          }
        }
      }
      // Top edge
      if (st.shotY < TOP_MARGIN + BUBBLE_R) {
        const cell = pxToNearestCell(st.shotX, TOP_MARGIN);
        if (inBounds(st.grid, cell.r, cell.c) && st.grid[cell.r][cell.c] == null) {
          st.grid[cell.r][cell.c] = st.currentColor;
          afterAttach(st, cell.r, cell.c);
          return true;
        }
      }
      return false;
    };

    const afterAttach = (st: typeof s.current, r: number, c: number) => {
      // Find connected same-color group
      const color = st.grid[r][c]!;
      const visited = new Set<string>();
      const group: [number, number][] = [];
      const stack: [number, number][] = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        const k = `${cr},${cc}`;
        if (visited.has(k)) continue;
        if (!inBounds(st.grid, cr, cc) || st.grid[cr][cc] !== color) continue;
        visited.add(k); group.push([cr, cc]);
        for (const [nr, nc] of neighbors(cr, cc)) stack.push([nr, nc]);
      }
      if (group.length >= 3) {
        for (const [gr, gc] of group) st.grid[gr][gc] = null;
        st.score += group.length * 10;
        // Drop disconnected
        const supported = new Set<string>();
        const stk: [number, number][] = [];
        for (let cc = 0; cc < rowCols(0); cc++) if (st.grid[0][cc] != null) stk.push([0, cc]);
        while (stk.length) {
          const [cr, cc] = stk.pop()!;
          const k = `${cr},${cc}`;
          if (supported.has(k)) continue;
          if (!inBounds(st.grid, cr, cc) || st.grid[cr][cc] == null) continue;
          supported.add(k);
          for (const [nr, nc] of neighbors(cr, cc)) stk.push([nr, nc]);
        }
        for (let rr = 0; rr < st.grid.length; rr++) {
          for (let cc = 0; cc < rowCols(rr); cc++) {
            if (st.grid[rr][cc] != null && !supported.has(`${rr},${cc}`)) {
              const p = cellToPx(rr, cc);
              st.falling.push({ x: p.x, y: p.y, vy: 0, color: st.grid[rr][cc]! });
              st.grid[rr][cc] = null;
              st.score += 20;
            }
          }
        }
      }
      // Move to next color
      st.currentColor = st.nextColor;
      st.nextColor = pickColorFromGrid(st.grid);
      setScore(st.score);
      // Check win/lose
      let any = false;
      for (let rr = 0; rr < st.grid.length; rr++) {
        for (let cc = 0; cc < rowCols(rr); cc++) {
          if (st.grid[rr][cc] != null) {
            any = true;
            const p = cellToPx(rr, cc);
            if (p.y + BUBBLE_R > DANGER_Y) { endGame(st, "lose"); return; }
          }
        }
      }
      if (!any) endGame(st, "win");
    };

    const endGame = (st: typeof s.current, outcome: "win" | "lose") => {
      st.running = false;
      if (outcome === "win") st.score += 500;
      setScore(st.score);
      if (st.score > highScore) { setHighScore(st.score); localStorage.setItem("bubble-highscore", String(st.score)); }
      hostRef.current.reportScore(st.score);
      setOver(outcome);
    };

    const loop = () => {
      const st = s.current;

      if (st.running && st.shooting) {
        st.shotX += st.shotVx; st.shotY += st.shotVy;
        if (st.shotX < BUBBLE_R) { st.shotX = BUBBLE_R; st.shotVx = -st.shotVx; }
        if (st.shotX > WIDTH - BUBBLE_R) { st.shotX = WIDTH - BUBBLE_R; st.shotVx = -st.shotVx; }
        if (tryAttach(st) || st.shotY < TOP_MARGIN) {
          if (!st.shooting) { /* attached */ }
          st.shooting = false;
          st.shotX = WIDTH / 2; st.shotY = SHOOTER_Y; st.shotVx = 0; st.shotVy = 0;
        }
      }
      // Falling debris
      let w = 0;
      for (let i = 0; i < st.falling.length; i++) { const f = st.falling[i]; f.vy += 0.5; f.y += f.vy; if (f.y < HEIGHT + 30) { if (w !== i) st.falling[w] = f; w++; } }
      st.falling.length = w;

      // ===== DRAW =====
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, "#1a0e0a"); g.addColorStop(1, "#0a0608");
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Side walls hint
      ctx.fillStyle = "#3a2218"; ctx.fillRect(0, 0, 2, HEIGHT); ctx.fillRect(WIDTH - 2, 0, 2, HEIGHT);

      // Danger line
      ctx.strokeStyle = "rgba(214,61,61,0.5)"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(WIDTH, DANGER_Y); ctx.stroke(); ctx.setLineDash([]);

      // Grid bubbles
      for (let r = 0; r < st.grid.length; r++) {
        for (let c = 0; c < rowCols(r); c++) {
          const v = st.grid[r][c]; if (v == null) continue;
          const p = cellToPx(r, c); drawBubble(ctx, p.x, p.y, COLORS[v]);
        }
      }
      // Falling
      for (const f of st.falling) drawBubble(ctx, f.x, f.y, COLORS[f.color]);

      // Shooter (cannon)
      ctx.save();
      ctx.translate(WIDTH / 2, SHOOTER_Y + 8);
      ctx.rotate(st.angle + Math.PI / 2);
      ctx.fillStyle = "#5a3a22"; ctx.fillRect(-7, -22, 14, 22);
      ctx.fillStyle = "#7a5a34"; ctx.fillRect(-7, -22, 14, 4);
      ctx.restore();
      // Base
      ctx.fillStyle = "#3a2218"; ctx.beginPath(); ctx.arc(WIDTH / 2, SHOOTER_Y + 14, 14, 0, Math.PI * 2); ctx.fill();

      // Current bubble (in cannon)
      if (!st.shooting && st.running) drawBubble(ctx, WIDTH / 2, SHOOTER_Y, COLORS[st.currentColor]);
      // Next bubble preview
      ctx.fillStyle = "rgba(245,232,208,0.6)"; ctx.font = "10px monospace";
      ctx.fillText("NEXT", 12, HEIGHT - 12);
      if (st.running) drawBubble(ctx, 60, HEIGHT - 16, COLORS[st.nextColor], 10);

      // Aim line
      if (!st.shooting && st.running) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
        const ax = WIDTH / 2 + Math.cos(st.angle) * 80;
        const ay = SHOOTER_Y + Math.sin(st.angle) * 80;
        ctx.beginPath(); ctx.moveTo(WIDTH / 2, SHOOTER_Y); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
      }

      // In-flight shot
      if (st.shooting) drawBubble(ctx, st.shotX, st.shotY, COLORS[st.currentColor]);

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
   
  }, [highScore]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (s.current.shooting || !s.current.running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (WIDTH / rect.width);
    const my = (e.clientY - rect.top) * (HEIGHT / rect.height);
    const a = Math.atan2(my - SHOOTER_Y, mx - WIDTH / 2);
    // Clamp to upper hemisphere
    s.current.angle = Math.max(-Math.PI + 0.25, Math.min(-0.25, a));
  };
  const onClick = () => {
    const st = s.current;
    if (!st.running || st.shooting) return;
    st.shooting = true;
    st.shotX = WIDTH / 2; st.shotY = SHOOTER_Y;
    st.shotVx = Math.cos(st.angle) * SHOT_SPEED;
    st.shotVy = Math.sin(st.angle) * SHOT_SPEED;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[500px] font-[family-name:var(--font-mono)] text-lg">
        <span><span className="text-[var(--muted)]">SCORE </span><span className="text-[var(--crt-green)]">{score}</span></span>
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highScore}</span></span>
      </div>
      <div className="relative w-full max-w-[500px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onMouseMove={onMove} onClick={onClick}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-crosshair" />
        {(!started || over) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--accent)] mb-2">
              {!started ? "BUBBLE SHOOTER" : over === "win" ? "CLEARED!" : "OVERFLOW!"}
            </h2>
            {over && <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--foreground)] mb-1">SCORE <span className="text-[var(--accent)]">{score}</span></p>}
            {over && score >= highScore && score > 0 && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW RECORD ★</p>}
            <button onClick={reset} className="pixel-edge mt-1 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">
              {over ? "PLAY AGAIN" : "START"}
            </button>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">Aim with mouse · click to shoot<br />Match 3+ of a color to pop them</p>
          </div>
        )}
      </div>
    </div>
  );
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius = BUBBLE_R) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.arc(x, y + radius * 0.4, radius * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath(); ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.3, 0, Math.PI * 2); ctx.fill();
}
