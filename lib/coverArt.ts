/**
 * Deterministic generated cover art.
 *
 * One game ships a real card image; the rest previously fell back to a bare
 * emoji on a flat gradient, which is what made a library of real games read as
 * a prototype. Rather than depend on an image service, covers are built from
 * what each game already declares: its accent colour, slug, and genre.
 *
 * A real cardImage always wins where one exists, so this is a floor rather
 * than a ceiling.
 *
 * Everything here is pure and seeded from the slug, so a given game always
 * renders the same cover — across reloads, across server and client, and in
 * snapshots.
 */

export type CoverPattern =
  | "grid"
  | "rays"
  | "orbits"
  | "scanlines"
  | "bricks"
  | "stars"
  | "waves"
  | "circuit";

export const COVER_PATTERNS: CoverPattern[] = [
  "grid",
  "rays",
  "orbits",
  "scanlines",
  "bricks",
  "stars",
  "waves",
  "circuit",
];

/** FNV-1a. Small, fast, and stable across runtimes — unlike hashCode tricks. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — a tiny seeded PRNG so covers are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pattern per game, chosen to suit the game rather than at random.
 *
 * Hashing the slug spread things evenly but produced covers that fought their
 * subject — Breakout drew a starfield while Space Invaders drew bricks. These
 * are assigned by hand so the artwork reads as deliberate.
 */
const PATTERN_BY_SLUG: Record<string, CoverPattern> = {
  // Mazes and boards read as grids.
  snake: "grid",
  pacman: "grid",
  battleship: "grid",
  "tower-defense": "grid",
  "word-search": "grid",
  minesweeper: "grid",
  "crash-course": "grid", // a road receding to the horizon

  // Wiring and routing.
  tron: "circuit",
  pipes: "circuit",
  "lights-out": "circuit",
  mastermind: "circuit",

  // Anything set in space.
  "space-invaders": "stars",
  galaga: "stars",
  asteroids: "stars",
  "lunar-lander": "stars",
  centipede: "stars",

  // Firing outward from a point.
  "missile-command": "rays",
  "apple-shooter": "rays",
  "zombie-shooter": "rays",
  "tank-shooter": "rays",
  simon: "rays",

  // Stacked or tiled blocks.
  breakout: "bricks",
  tetris: "bricks",
  "2048": "bricks",
  "slide-puzzle": "bricks",
  sokoban: "bricks",
  "stack-tower": "bricks",
  "memory-match": "bricks",

  // Flat playfields with travelling lanes.
  pong: "scanlines",
  "air-hockey": "scanlines",
  frogger: "scanlines",
  "dino-runner": "scanlines",
  hangman: "scanlines",

  // Motion that rises and falls.
  "dam-rush": "waves",
  helicopter: "waves",
  "line-rider": "waves",
  "sky-hop": "waves",
  plinko: "waves",

  // Round pieces and radial play.
  "bubble-shooter": "orbits",
  "match-three": "orbits",
  "connect-four": "orbits",
  reversi: "orbits",
  "whack-a-mole": "orbits",
  "mini-golf": "orbits",
};

/** Sensible default per genre when a game has no explicit assignment. */
const PATTERN_BY_CATEGORY: Record<string, CoverPattern> = {
  action: "rays",
  arcade: "stars",
  puzzle: "bricks",
  reflex: "scanlines",
  classic: "grid",
};

export function patternFor(slug: string, category?: string): CoverPattern {
  const explicit = PATTERN_BY_SLUG[slug];
  if (explicit) return explicit;

  const byCategory = category ? PATTERN_BY_CATEGORY[category] : undefined;
  if (byCategory) return byCategory;

  // Last resort for a game added without either — still deterministic.
  return COVER_PATTERNS[hashString(slug) % COVER_PATTERNS.length];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns SVG child markup for the pattern, drawn inside a 320x180 viewBox.
 * Colour is applied by the caller via currentColor so a single generated
 * string works for any accent.
 */
export function patternMarkup(pattern: CoverPattern, seed: number): string {
  const rand = rng(seed);
  const W = 320;
  const H = 180;
  const parts: string[] = [];

  switch (pattern) {
    case "grid": {
      // Perspective floor grid — the arcade/synthwave staple.
      const horizon = 70;
      for (let i = 0; i <= 12; i++) {
        const x = (i / 12) * W;
        parts.push(
          `<line x1="${round(x)}" y1="${H}" x2="${round(W / 2 + (x - W / 2) * 0.18)}" y2="${horizon}" stroke="currentColor" stroke-width="1"/>`,
        );
      }
      for (let i = 1; i <= 7; i++) {
        const t = i / 7;
        const y = horizon + (H - horizon) * t * t;
        parts.push(
          `<line x1="0" y1="${round(y)}" x2="${W}" y2="${round(y)}" stroke="currentColor" stroke-width="1"/>`,
        );
      }
      break;
    }

    case "rays": {
      const cx = W / 2;
      const cy = H * 0.55;
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a0 = (i / count) * Math.PI * 2;
        const a1 = a0 + Math.PI / count;
        parts.push(
          `<path d="M${cx} ${cy} L${round(cx + Math.cos(a0) * 320)} ${round(cy + Math.sin(a0) * 320)} L${round(cx + Math.cos(a1) * 320)} ${round(cy + Math.sin(a1) * 320)} Z" fill="currentColor" opacity="${i % 2 ? 0.5 : 0.18}"/>`,
        );
      }
      break;
    }

    case "orbits": {
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 1; i <= 6; i++) {
        parts.push(
          `<circle cx="${cx}" cy="${cy}" r="${round(i * 16 + rand() * 6)}" fill="none" stroke="currentColor" stroke-width="${i % 2 ? 1.5 : 1}"/>`,
        );
      }
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2;
        const r = 24 + rand() * 80;
        parts.push(
          `<circle cx="${round(cx + Math.cos(a) * r)}" cy="${round(cy + Math.sin(a) * r)}" r="3.5" fill="currentColor"/>`,
        );
      }
      break;
    }

    case "scanlines": {
      for (let y = 0; y < H; y += 9) {
        const w = 40 + rand() * (W - 40);
        const x = rand() * (W - w);
        parts.push(
          `<rect x="${round(x)}" y="${y}" width="${round(w)}" height="3.5" fill="currentColor" opacity="${round(0.25 + rand() * 0.6)}"/>`,
        );
      }
      break;
    }

    case "bricks": {
      const bw = 40;
      const bh = 18;
      for (let row = 0; row * bh < H; row++) {
        const offset = row % 2 ? bw / 2 : 0;
        for (let col = -1; col * bw < W; col++) {
          if (rand() < 0.28) continue;
          parts.push(
            `<rect x="${round(col * bw + offset + 2)}" y="${round(row * bh + 2)}" width="${bw - 4}" height="${bh - 4}" rx="2" fill="currentColor" opacity="${round(0.2 + rand() * 0.55)}"/>`,
          );
        }
      }
      break;
    }

    case "stars": {
      for (let i = 0; i < 70; i++) {
        const r = rand();
        parts.push(
          `<circle cx="${round(rand() * W)}" cy="${round(rand() * H)}" r="${round(0.6 + r * 2.2)}" fill="currentColor" opacity="${round(0.3 + r * 0.7)}"/>`,
        );
      }
      break;
    }

    case "waves": {
      for (let i = 0; i < 5; i++) {
        const amp = 10 + rand() * 22;
        const yBase = 24 + i * 32;
        const phase = rand() * Math.PI * 2;
        const pts: string[] = [];
        for (let x = 0; x <= W; x += 16) {
          pts.push(`${x},${round(yBase + Math.sin(x / 38 + phase) * amp)}`);
        }
        parts.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="2" opacity="${round(0.35 + i * 0.12)}"/>`,
        );
      }
      break;
    }

    case "circuit": {
      // Right-angle traces with junction nodes.
      for (let i = 0; i < 9; i++) {
        let x = round(rand() * W);
        let y = round(rand() * H);
        const d = [`M${x} ${y}`];
        for (let step = 0; step < 4; step++) {
          if (step % 2 === 0) x = round(Math.max(0, Math.min(W, x + (rand() - 0.5) * 130)));
          else y = round(Math.max(0, Math.min(H, y + (rand() - 0.5) * 90)));
          d.push(`L${x} ${y}`);
        }
        parts.push(
          `<path d="${d.join(" ")}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>`,
        );
        parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="currentColor"/>`);
      }
      break;
    }
  }

  return parts.join("");
}

/** Everything a cover needs, derived from the game alone. */
export function coverFor(
  slug: string,
  category?: string,
): { pattern: CoverPattern; seed: number } {
  return { pattern: patternFor(slug, category), seed: hashString(slug) };
}
