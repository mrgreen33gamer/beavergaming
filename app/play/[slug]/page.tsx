import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { getGame, games } from "@/lib/games";
import HelicopterGame from "@/app/games/HelicopterGame";
import AppleShooter from "@/app/games/AppleShooter";
import SnakeGame from "@/app/games/SnakeGame";
import MemoryMatch from "@/app/games/MemoryMatch";
import WhackAMole from "@/app/games/WhackAMole";
import TankShooter from "@/app/games/TankShooter";
import SpaceInvaders from "@/app/games/SpaceInvaders";
import Galaga from "@/app/games/Galaga";
import Pacman from "@/app/games/Pacman";
import ZombieShooter from "@/app/games/ZombieShooter";
import LineRider from "@/app/games/LineRider";
import TowerDefense from "@/app/games/TowerDefense";
import Pong from "@/app/games/Pong";
import Breakout from "@/app/games/Breakout";
import Game2048 from "@/app/games/Game2048";
import Minesweeper from "@/app/games/Minesweeper";
import Tetris from "@/app/games/Tetris";
import Asteroids from "@/app/games/Asteroids";
import DinoRunner from "@/app/games/DinoRunner";
import Simon from "@/app/games/Simon";
import Frogger from "@/app/games/Frogger";
import ConnectFour from "@/app/games/ConnectFour";
import DamRush from "@/app/games/DamRush";
import LightsOut from "@/app/games/LightsOut";
import Hangman from "@/app/games/Hangman";
import Reversi from "@/app/games/Reversi";
import Sokoban from "@/app/games/Sokoban";
import LunarLander from "@/app/games/LunarLander";
import Tron from "@/app/games/Tron";
import MiniGolf from "@/app/games/MiniGolf";
import SkyHop from "@/app/games/SkyHop";
import MatchThree from "@/app/games/MatchThree";
import BubbleShooter from "@/app/games/BubbleShooter";
import SlidePuzzle from "@/app/games/SlidePuzzle";
import Mastermind from "@/app/games/Mastermind";
import WordSearch from "@/app/games/WordSearch";
import Battleship from "@/app/games/Battleship";
import StackTower from "@/app/games/StackTower";
import Plinko from "@/app/games/Plinko";
import AirHockey from "@/app/games/AirHockey";
import MissileCommand from "@/app/games/MissileCommand";
import Centipede from "@/app/games/Centipede";
import Pipes from "@/app/games/Pipes";

// Mapping from slug to component
const gameComponents: Record<string, React.ComponentType> = {
  "dam-rush": DamRush,
  "tank-shooter": TankShooter,
  helicopter: HelicopterGame,
  "apple-shooter": AppleShooter,
  snake: SnakeGame,
  "memory-match": MemoryMatch,
  "whack-a-mole": WhackAMole,
  "space-invaders": SpaceInvaders,
  galaga: Galaga,
  pacman: Pacman,
  "zombie-shooter": ZombieShooter,
  "line-rider": LineRider,
  "tower-defense": TowerDefense,
  pong: Pong,
  breakout: Breakout,
  "2048": Game2048,
  minesweeper: Minesweeper,
  tetris: Tetris,
  asteroids: Asteroids,
  "dino-runner": DinoRunner,
  simon: Simon,
  frogger: Frogger,
  "connect-four": ConnectFour,
  "lights-out": LightsOut,
  hangman: Hangman,
  reversi: Reversi,
  sokoban: Sokoban,
  "lunar-lander": LunarLander,
  tron: Tron,
  "mini-golf": MiniGolf,
  "sky-hop": SkyHop,
  "match-three": MatchThree,
  "bubble-shooter": BubbleShooter,
  "slide-puzzle": SlidePuzzle,
  mastermind: Mastermind,
  "word-search": WordSearch,
  battleship: Battleship,
  "stack-tower": StackTower,
  plinko: Plinko,
  "air-hockey": AirHockey,
  "missile-command": MissileCommand,
  centipede: Centipede,
  pipes: Pipes,
};

export async function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame(slug);
  const GameComponent = gameComponents[slug];

  if (!game || !GameComponent) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">
        {/* Game header */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          >
            &larr; back to all games
          </Link>
          <span
            className="px-2 py-0.5 rounded font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider"
            style={{ background: game.accent, color: "#1a0e0a" }}
          >
            {game.category}
          </span>
        </div>

        <div className="mb-4">
          <h1 className="font-[family-name:var(--font-display)] text-lg sm:text-xl text-[var(--accent)] mb-2">
            {game.title.toUpperCase()}
          </h1>
          <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)]">
            {game.controls}
          </p>
        </div>

        {/* Game canvas container */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4 crt">
          <GameComponent />
        </div>

        {/* Description */}
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-[family-name:var(--font-display)] text-xs text-[var(--foreground)] mb-2">
            ABOUT THIS GAME
          </h2>
          <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)] leading-snug">
            {game.description}
          </p>
        </div>

        {/* Other games */}
        <div className="mt-8">
          <h2 className="font-[family-name:var(--font-display)] text-xs text-[var(--accent)] mb-3">
            MORE GAMES
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {games
              .filter((g) => g.slug !== game.slug)
              .map((g) => (
                <Link
                  key={g.slug}
                  href={`/play/${g.slug}`}
                  className="pixel-edge flex-shrink-0 px-3 py-2 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] font-[family-name:var(--font-mono)] text-base flex items-center gap-2"
                >
                  <span className="text-xl">{g.emoji}</span>
                  <span>{g.title}</span>
                </Link>
              ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
