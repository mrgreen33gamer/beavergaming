import type { Direction, Point, Wall } from "./types";

// Three hand-designed maze layouts. All keep the central spawn area
// (x=13..17, y=9..11) clear so the snake has room to start moving.
const LAYOUT_PILLARS: Point[] = (() => {
  const out: Point[] = [];
  const corners = [
    [6, 5], [21, 5], [6, 13], [21, 13],
  ];
  for (const [cx, cy] of corners) {
    out.push({ x: cx, y: cy });
    out.push({ x: cx + 1, y: cy });
    out.push({ x: cx + 2, y: cy });
    out.push({ x: cx, y: cy + 1 });
    out.push({ x: cx + 2, y: cy + 1 });
    out.push({ x: cx, y: cy + 2 });
    out.push({ x: cx + 1, y: cy + 2 });
    out.push({ x: cx + 2, y: cy + 2 });
  }
  return out;
})();

const LAYOUT_BARS: Point[] = (() => {
  const out: Point[] = [];
  // Two vertical bars on the left side, top half and bottom half
  for (let y = 3; y <= 7; y++) out.push({ x: 8, y });
  for (let y = 12; y <= 16; y++) out.push({ x: 8, y });
  // Two vertical bars on the right side
  for (let y = 3; y <= 7; y++) out.push({ x: 21, y });
  for (let y = 12; y <= 16; y++) out.push({ x: 21, y });
  return out;
})();

const LAYOUT_DIAGONALS: Point[] = (() => {
  const out: Point[] = [];
  // Diagonal segments emanating from the four corner areas, not touching center
  for (let i = 0; i < 4; i++) {
    out.push({ x: 4 + i, y: 4 + i });            // top-left
    out.push({ x: 25 - i, y: 4 + i });           // top-right
    out.push({ x: 4 + i, y: 15 - i });           // bottom-left
    out.push({ x: 25 - i, y: 15 - i });          // bottom-right
  }
  return out;
})();

const LAYOUTS = [LAYOUT_PILLARS, LAYOUT_BARS, LAYOUT_DIAGONALS];

export function buildMazeWalls(): Wall[] {
  const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const now = Date.now();
  return layout.map((p) => ({
    x: p.x, y: p.y, spawnedAt: now, expiresAt: null,
  }));
}

// ===== Direction utilities =====
export const dirVec: Record<Direction, Point> = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y:  1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y:  0 },
};

export const opposite: Record<Direction, Direction> = {
  up: "down", down: "up", left: "right", right: "left",
};
