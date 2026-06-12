import Link from "next/link";
import Image from "next/image";
import type { Game } from "@/lib/games";

export default function GameTile({ game }: { game: Game }) {
  return (
    <Link
      href={`/play/${game.slug}`}
      className="pixel-edge group block rounded-lg overflow-hidden bg-[var(--surface-2)] transition-all duration-150"
    >
      <div
        className="crt aspect-video flex items-center justify-center relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${game.accent}22 0%, ${game.accent}08 100%)`,
        }}
      >
        {game.cardImage ? (
          <Image
            src={`/game-cards/${game.cardImage}`}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span
            className="tile-emoji text-6xl drop-shadow-lg"
            style={{ filter: "drop-shadow(0 0 12px " + game.accent + "88)" }}
          >
            {game.emoji}
          </span>
        )}
        <span
          className="absolute top-2 left-2 px-2 py-0.5 rounded font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider z-10"
          style={{ background: game.accent, color: "#1a0e0a" }}
        >
          {game.category}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-[family-name:var(--font-display)] text-xs text-[var(--foreground)] group-hover:text-[var(--accent-hot)] transition-colors">
          {game.title.toUpperCase()}
        </h3>
        <p className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mt-1.5 leading-tight">
          {game.blurb}
        </p>
      </div>
    </Link>
  );
}
