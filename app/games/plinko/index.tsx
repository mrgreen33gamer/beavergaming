"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 480;
const HEIGHT = 580;
const PEG_R = 4;
const PUCK_R = 9;
const GRAVITY = 0.25;
const BOUNCE = 0.55;
const FRICTION = 0.992;
const ROWS = 12;
const COL_SPACE = 36;

const SLOTS = [
  { mult: 25, color: "#c45ed6" },
  { mult: 5, color: "#ff5050" },
  { mult: 2, color: "#ff8a3d" },
  { mult: 1, color: "#ffd060" },
  { mult: 0, color: "#7a5230" },
  { mult: 1, color: "#ffd060" },
  { mult: 2, color: "#ff8a3d" },
  { mult: 5, color: "#ff5050" },
  { mult: 25, color: "#c45ed6" },
];

type Puck = { x: number; y: number; vx: number; vy: number; bet: number; landed: boolean; color: string };
type FX = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string };

export default function Plinko() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [credits, setCredits] = useState(100);
  const [highCredits, setHighCredits] = useState(100);
  const [bet, setBet] = useState(5);
  const [aimX, setAimX] = useState(WIDTH / 2);
  const [lastWin, setLastWin] = useState<{ amount: number; mult: number } | null>(null);

  const s = useRef({
    pucks: [] as Puck[],
    fx: [] as FX[],
    pegs: [] as { x: number; y: number; hit: number }[],
    slotsY: 0,
    slotW: 0,
    aimPulse: 0,
    lastDrop: 0,
  });

  // Generate pegs in a triangular field
  useEffect(() => {
    const st = s.current;
    const pegs: { x: number; y: number; hit: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
      const cols = 4 + r; // 4 to 4+ROWS-1
      const offset = (WIDTH - (cols - 1) * COL_SPACE) / 2;
      const y = 90 + r * 36;
      for (let c = 0; c < cols; c++) {
        pegs.push({ x: offset + c * COL_SPACE, y, hit: 0 });
      }
    }
    st.pegs = pegs;
    st.slotW = WIDTH / SLOTS.length;
    st.slotsY = HEIGHT - 60;

    const saved = localStorage.getItem("plinko-best-credits");
    if (saved) setHighCredits(parseInt(saved, 10));
  }, []);

  const drop = () => {
    const st = s.current;
    if (Date.now() - st.lastDrop < 200) return;
    if (credits < bet) return;
    st.lastDrop = Date.now();
    setCredits((c) => c - bet);
    st.pucks.push({
      x: aimX + (Math.random() - 0.5) * 0.5,
      y: 30,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0,
      bet,
      landed: false,
      color: ["#5fc8e0", "#7fd650", "#ffd060", "#ff8a3d", "#c45ed6"][Math.floor(Math.random() * 5)],
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const st = s.current;

      // Physics
      for (const puck of st.pucks) {
        if (puck.landed) continue;
        puck.vy += GRAVITY;
        puck.vx *= FRICTION; puck.vy *= FRICTION;
        puck.x += puck.vx; puck.y += puck.vy;
        // Walls
        if (puck.x < PUCK_R) { puck.x = PUCK_R; puck.vx = -puck.vx * BOUNCE; }
        if (puck.x > WIDTH - PUCK_R) { puck.x = WIDTH - PUCK_R; puck.vx = -puck.vx * BOUNCE; }
        // Pegs
        for (const peg of st.pegs) {
          const dx = puck.x - peg.x, dy = puck.y - peg.y;
          const dist = Math.hypot(dx, dy);
          const minD = PUCK_R + PEG_R;
          if (dist < minD && dist > 0) {
            // Reflect
            const nx = dx / dist, ny = dy / dist;
            const dot = puck.vx * nx + puck.vy * ny;
            puck.vx -= 2 * dot * nx;
            puck.vy -= 2 * dot * ny;
            puck.vx *= BOUNCE; puck.vy *= BOUNCE;
            // Add a tiny kick so it doesn't get stuck
            puck.vx += (Math.random() - 0.5) * 0.5;
            // Push out
            puck.x = peg.x + nx * minD;
            puck.y = peg.y + ny * minD;
            peg.hit = 1;
            // Spark
            for (let i = 0; i < 4; i++) {
              const a = Math.random() * Math.PI * 2; const sp = 1 + Math.random() * 2;
              st.fx.push({ x: peg.x, y: peg.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 14, maxLife: 14, color: "#ffd060" });
            }
          }
        }
        // Land in slot
        if (puck.y >= st.slotsY) {
          puck.landed = true;
          const slotIdx = Math.max(0, Math.min(SLOTS.length - 1, Math.floor(puck.x / st.slotW)));
          const slot = SLOTS[slotIdx];
          const win = puck.bet * slot.mult;
          setCredits((c) => {
            const nc = c + win;
            if (nc > highCredits) { setHighCredits(nc); localStorage.setItem("plinko-best-credits", String(nc)); }
            return nc;
          });
          setLastWin({ amount: win, mult: slot.mult });
          // Burst at landing slot
          for (let i = 0; i < 20; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
            const sp = 2 + Math.random() * 3;
            st.fx.push({ x: puck.x, y: st.slotsY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 28, maxLife: 28, color: slot.color });
          }
        }
      }
      // Remove landed pucks after a moment
      st.pucks = st.pucks.filter((p) => !p.landed || p.y < HEIGHT + 40).slice(-12);

      // Decay peg-hit highlights
      for (const peg of st.pegs) if (peg.hit > 0) peg.hit = Math.max(0, peg.hit - 0.04);

      // FX
      let w = 0;
      for (let i = 0; i < st.fx.length; i++) { const f = st.fx[i]; f.vy += 0.2; f.x += f.vx; f.y += f.vy; f.life--; if (f.life > 0) { if (w !== i) st.fx[w] = f; w++; } }
      st.fx.length = w;

      // Aim pulse
      st.aimPulse = (st.aimPulse + 0.06) % (Math.PI * 2);

      // ===== DRAW =====
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, "#1a0f24"); g.addColorStop(1, "#0c0810");
      ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Background pegboard wood frame
      ctx.fillStyle = "#3a2218"; ctx.fillRect(0, 70, WIDTH, st.slotsY - 70);
      ctx.fillStyle = "#2a1810"; for (let y = 70; y < st.slotsY; y += 4) ctx.fillRect(0, y, WIDTH, 1);

      // Aim guide
      const aimY = 60;
      ctx.strokeStyle = "rgba(255,138,61,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(aimX, aimY); ctx.lineTo(aimX, 90); ctx.stroke(); ctx.setLineDash([]);
      // Aim indicator (triangle)
      const wobble = Math.sin(st.aimPulse) * 2;
      ctx.fillStyle = "#ff8a3d";
      ctx.beginPath(); ctx.moveTo(aimX, aimY + wobble); ctx.lineTo(aimX - 8, aimY - 10 + wobble); ctx.lineTo(aimX + 8, aimY - 10 + wobble); ctx.closePath(); ctx.fill();

      // Pegs
      for (const peg of st.pegs) {
        const r = PEG_R + peg.hit * 2;
        ctx.fillStyle = peg.hit > 0 ? "#ffd060" : "#b8a088";
        ctx.beginPath(); ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.arc(peg.x - 1, peg.y - 1, r * 0.45, 0, Math.PI * 2); ctx.fill();
      }

      // Slots
      for (let i = 0; i < SLOTS.length; i++) {
        const x = i * st.slotW;
        ctx.fillStyle = SLOTS[i].color;
        ctx.fillRect(x + 2, st.slotsY, st.slotW - 4, HEIGHT - st.slotsY);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 2, HEIGHT - 18, st.slotW - 4, 18);
        ctx.fillStyle = "#1a0e0a"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
        ctx.fillText(SLOTS[i].mult === 0 ? "—" : `×${SLOTS[i].mult}`, x + st.slotW / 2, st.slotsY + 16);
        ctx.fillStyle = "#3a2218"; ctx.fillRect(x, st.slotsY, 2, HEIGHT - st.slotsY);
      }
      // Slot divider walls (so balls don't land between slots awkwardly)
      ctx.fillStyle = "#5a3a22";
      for (let i = 0; i <= SLOTS.length; i++) ctx.fillRect(i * st.slotW - 1, st.slotsY - 18, 2, 18);

      // FX behind pucks
      for (const f of st.fx) { ctx.globalAlpha = Math.max(0, f.life / f.maxLife); ctx.fillStyle = f.color; ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); }
      ctx.globalAlpha = 1;

      // Pucks
      for (const puck of st.pucks) {
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(puck.x + 1, puck.y + 2, PUCK_R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = puck.color; ctx.beginPath(); ctx.arc(puck.x, puck.y, PUCK_R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(puck.x - 2.5, puck.y - 2.5, PUCK_R * 0.4, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
   
  }, [aimX, highCredits]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    setAimX(Math.max(40, Math.min(WIDTH - 40, x)));
  };

  const reset = () => { setCredits(100); setLastWin(null); };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[500px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-x-3 gap-y-1">
        <span><span className="text-[var(--muted)]">CREDITS </span><span className={credits < bet ? "text-[#d63d3d]" : "text-[var(--crt-green)]"}>{credits}</span></span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">BET</span>
          {[1, 5, 10, 25].map((b) => (
            <button key={b} onClick={() => setBet(b)} className={`pixel-edge px-2 py-0.5 rounded text-sm ${bet === b ? "bg-[var(--accent)] text-[var(--background)]" : "bg-[var(--surface-2)]"}`}>{b}</button>
          ))}
        </span>
        {lastWin && <span className="text-base"><span className="text-[var(--muted)]">LAST </span><span style={{ color: lastWin.amount > 0 ? "#7fd650" : "#d63d3d" }}>{lastWin.amount > 0 ? `+${lastWin.amount}` : "0"} (×{lastWin.mult})</span></span>}
        <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{highCredits}</span></span>
      </div>

      <div className="relative w-full max-w-[500px]" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onPointerMove={onMove} onClick={drop}
          className="w-full h-full rounded border-2 border-[var(--border)] cursor-crosshair" />
        {credits < bet && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded">
            <div className="text-center">
              <p className="font-[family-name:var(--font-display)] text-base text-[#d63d3d] mb-2">BROKE!</p>
              <button onClick={reset} className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">RESET TO 100</button>
            </div>
          </div>
        )}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md">
        Move the mouse to aim, click to drop a puck. Land in the outer slots for huge multipliers — center is a bust. Pick your bet wisely!
      </p>
    </div>
  );
}
