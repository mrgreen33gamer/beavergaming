import type { ComponentType } from "react";

type Loader = () => Promise<{ default: ComponentType }>;

/**
 * One lazy loader per game. Replaces the 43 static imports that previously
 * forced every visitor to download all 43 games to play one.
 *
 * When adding a game: add a line here and an entry in lib/games.ts. The
 * gameRegistry test fails if the two drift apart.
 *
 * Paths use explicit `/index` so Vite (and Windows case-insensitive FS)
 * does not resolve e.g. `@/app/games/pong` to the `Pong.tsx` re-export shim
 * and create a circular default export.
 */
export const gameLoaders: Record<string, Loader> = {
  "dam-rush": () => import("@/app/games/dam-rush/index"),
  "tank-shooter": () => import("@/app/games/base-command/index"),
  helicopter: () => import("@/app/games/helicopter/index"),
  "apple-shooter": () => import("@/app/games/apple-shooter/index"),
  snake: () => import("@/app/games/snake/index"),
  "memory-match": () => import("@/app/games/memory-match/index"),
  "whack-a-mole": () => import("@/app/games/whack-a-mole/index"),
  "space-invaders": () => import("@/app/games/space-invaders/index"),
  galaga: () => import("@/app/games/galaga/index"),
  pacman: () => import("@/app/games/pacman/index"),
  "zombie-shooter": () => import("@/app/games/zombie-shooter/index"),
  "line-rider": () => import("@/app/games/line-rider/index"),
  "tower-defense": () => import("@/app/games/tower-defense/index"),
  pong: () => import("@/app/games/pong/index"),
  breakout: () => import("@/app/games/breakout/index"),
  "2048": () => import("@/app/games/game-2048/index"),
  minesweeper: () => import("@/app/games/minesweeper/index"),
  tetris: () => import("@/app/games/tetris/index"),
  asteroids: () => import("@/app/games/asteroids/index"),
  "dino-runner": () => import("@/app/games/dino-runner/index"),
  simon: () => import("@/app/games/simon/index"),
  frogger: () => import("@/app/games/frogger/index"),
  "connect-four": () => import("@/app/games/connect-four/index"),
  "lights-out": () => import("@/app/games/lights-out/index"),
  hangman: () => import("@/app/games/hangman/index"),
  reversi: () => import("@/app/games/reversi/index"),
  sokoban: () => import("@/app/games/sokoban/index"),
  "lunar-lander": () => import("@/app/games/lunar-lander/index"),
  tron: () => import("@/app/games/tron/index"),
  "mini-golf": () => import("@/app/games/mini-golf/index"),
  "sky-hop": () => import("@/app/games/sky-hop/index"),
  "match-three": () => import("@/app/games/match-three/index"),
  "bubble-shooter": () => import("@/app/games/bubble-shooter/index"),
  "slide-puzzle": () => import("@/app/games/slide-puzzle/index"),
  mastermind: () => import("@/app/games/mastermind/index"),
  "word-search": () => import("@/app/games/word-search/index"),
  battleship: () => import("@/app/games/battleship/index"),
  "stack-tower": () => import("@/app/games/stack-tower/index"),
  plinko: () => import("@/app/games/plinko/index"),
  "air-hockey": () => import("@/app/games/air-hockey/index"),
  "missile-command": () => import("@/app/games/missile-command/index"),
  centipede: () => import("@/app/games/centipede/index"),
  pipes: () => import("@/app/games/pipes/index"),
};
