"use client";

import { useEffect, useRef, useState } from "react";

import { useCartridge } from "@/lib/platform/useCartridge";

const SIZE = 10;
const SHIPS: { name: string; length: number }[] = [
  { name: "Carrier", length: 5 },
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Submarine", length: 3 },
  { name: "Destroyer", length: 2 },
];

type Cell = { ship: number | null; hit: boolean; miss: boolean };
type Ship = { length: number; cells: [number, number][]; sunk: boolean; name: string };

function emptyBoard(): Cell[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ ship: null, hit: false, miss: false })));
}

function placeShipsRandom(): { board: Cell[][]; ships: Ship[] } {
  const board = emptyBoard();
  const ships: Ship[] = [];
  for (let i = 0; i < SHIPS.length; i++) {
    const def = SHIPS[i];
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      const cells: [number, number][] = [];
      let ok = true;
      for (let k = 0; k < def.length; k++) {
        const rr = horiz ? r : r + k;
        const cc = horiz ? c + k : c;
        if (rr >= SIZE || cc >= SIZE) { ok = false; break; }
        if (board[rr][cc].ship !== null) { ok = false; break; }
        cells.push([rr, cc]);
      }
      if (!ok) continue;
      for (const [rr, cc] of cells) board[rr][cc].ship = i;
      ships.push({ length: def.length, cells, sunk: false, name: def.name });
      placed = true;
    }
  }
  return { board, ships };
}

export default function Battleship() {
  // Ref'd for consistency with the other cartridges — the fire handler is
  // recreated each render, but the ref keeps the host stable either way.
  const { host } = useCartridge("battleship");
  const hostRef = useRef(host);
  hostRef.current = host;

  const [enemyBoard, setEnemyBoard] = useState<Cell[][]>(() => placeShipsRandom().board);
  const [enemyShips, setEnemyShips] = useState<Ship[]>([]);
  const [shots, setShots] = useState(0);
  const [hits, setHits] = useState(0);
  const [over, setOver] = useState(false);
  const [bestShots, setBestShots] = useState<number | null>(null);
  const [lastShotInfo, setLastShotInfo] = useState<string>("Pick a square to fire");

  useEffect(() => {
    const b = localStorage.getItem("battleship-best");
    if (b) setBestShots(parseInt(b, 10));
    newGame();
  }, []);

  const newGame = () => {
    const { board, ships } = placeShipsRandom();
    setEnemyBoard(board); setEnemyShips(ships);
    setShots(0); setHits(0); setOver(false);
    setLastShotInfo("Pick a square to fire");
  };

  const fire = (r: number, c: number) => {
    if (over) return;
    const cell = enemyBoard[r][c];
    if (cell.hit || cell.miss) return;
    const nb = enemyBoard.map((row) => row.map((cc) => ({ ...cc })));
    const targ = nb[r][c];
    targ.hit = cell.ship !== null;
    targ.miss = cell.ship === null;
    setEnemyBoard(nb);
    setShots((s) => s + 1);
    if (cell.ship !== null) {
      const newHits = hits + 1; setHits(newHits);
      // Check if the ship is fully sunk
      const ship = enemyShips[cell.ship];
      const allHit = ship.cells.every(([rr, cc]) => nb[rr][cc].hit);
      if (allHit) {
        const ns = enemyShips.map((s, i) => i === cell.ship ? { ...s, sunk: true } : s);
        setEnemyShips(ns);
        setLastShotInfo(`SUNK their ${ship.name}!`);
        // Check win
        const allSunk = ns.every((s) => s.sunk);
        if (allSunk) {
          setOver(true);
          const total = shots + 1;
          if (bestShots === null || total < bestShots) { setBestShots(total); localStorage.setItem("battleship-best", String(total)); }
          hostRef.current.reportEvent("match_won");
        }
      } else {
        setLastShotInfo("HIT!");
      }
    } else {
      setLastShotInfo("Miss.");
    }
  };

  const totalShipCells = SHIPS.reduce((a, s) => a + s.length, 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[480px] font-[family-name:var(--font-mono)] text-lg flex-wrap gap-x-3 gap-y-1">
        <span><span className="text-[var(--muted)]">SHOTS </span><span className="text-[var(--crt-green)]">{shots}</span></span>
        <span><span className="text-[var(--muted)]">HITS </span><span className="text-[var(--foreground)]">{hits}</span>/<span className="text-[var(--muted)]">{totalShipCells}</span></span>
        {bestShots !== null && <span><span className="text-[var(--muted)]">BEST </span><span className="text-[var(--accent)]">{bestShots}</span></span>}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-base h-5" style={{ color: lastShotInfo.includes("SUNK") ? "#ff8a3d" : lastShotInfo === "HIT!" ? "#d63d3d" : "#b8a088" }}>
        {lastShotInfo}
      </p>

      <div className="relative">
        <div
          className="rounded-lg border-2 border-[var(--border)] bg-[#0a2444] p-2 inline-grid"
          style={{ gridTemplateColumns: `repeat(${SIZE + 1}, minmax(0, 1fr))`, gap: 2 }}
        >
          <div />
          {Array.from({ length: SIZE }).map((_, i) => (
            <span key={`h${i}`} className="text-center font-[family-name:var(--font-mono)] text-sm text-[#5fc8e0]">{String.fromCharCode(65 + i)}</span>
          ))}
          {enemyBoard.map((row, r) => (
            <Row key={r} r={r} row={row} ships={enemyShips} over={over} onFire={fire} />
          ))}
        </div>

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 rounded-lg p-4 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-base text-[var(--crt-green)] mb-2">FLEET DESTROYED!</h2>
            <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)] mb-1">{shots} shots</p>
            {bestShots !== null && shots <= bestShots && <p className="font-[family-name:var(--font-mono)] text-base text-[var(--accent)] mb-2 flicker">★ NEW BEST ★</p>}
            <button onClick={newGame} className="pixel-edge mt-2 px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs">NEW BATTLE</button>
          </div>
        )}
      </div>

      {/* Ship status */}
      <div className="flex flex-wrap gap-2 max-w-[480px] justify-center">
        {enemyShips.map((s, i) => (
          <span key={i} className={`px-2 py-1 rounded font-[family-name:var(--font-mono)] text-sm ${s.sunk ? "bg-[#d63d3d]/30 text-[#d63d3d] line-through" : "bg-[var(--surface-2)] text-[var(--foreground)]"}`}>
            {s.name} ({s.length})
          </span>
        ))}
      </div>

      <button onClick={newGame} className="pixel-edge px-4 py-2 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base">↻ New Game</button>

      <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] text-center max-w-md leading-snug">
        Click any square to fire. A small red dot is a hit, an X is a miss. Sink all 5 hidden ships in as few shots as possible.
      </p>
    </div>
  );
}

function Row({ r, row, ships, over, onFire }: { r: number; row: Cell[]; ships: Ship[]; over: boolean; onFire: (r: number, c: number) => void }) {
  return (
    <>
      <span className="text-center font-[family-name:var(--font-mono)] text-sm text-[#5fc8e0] flex items-center justify-center">{r + 1}</span>
      {row.map((cell, c) => {
        const shipSunk = cell.ship !== null && ships[cell.ship]?.sunk;
        let bg = "#1a4878";
        if (cell.miss) bg = "#3a5878";
        if (cell.hit) bg = shipSunk ? "#7a2828" : "#d63d3d";
        return (
          <button key={c} onClick={() => onFire(r, c)} disabled={cell.hit || cell.miss || over}
            className="aspect-square pixel-edge rounded flex items-center justify-center transition-colors hover:bg-[#2a5888]"
            style={{ background: bg, width: 28, height: 28 }}
          >
            {cell.miss && <span className="text-[#f5e8d0] text-base font-bold">×</span>}
            {cell.hit && <span className="block rounded-full" style={{ width: 8, height: 8, background: "#ffd060" }} />}
          </button>
        );
      })}
    </>
  );
}
