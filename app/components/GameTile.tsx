import Link from "next/link";
import Image from "next/image";
import type { Game } from "@/lib/games";

export default function GameTile({ game }: { game: Game }) {
  return (
    <Link
      href={`/play/${game.slug}`}
      className="pixel-edge group block rounded-lg overflow-hidden bg-[var(--surface-2)] transition-all duration-150 h-full"
    >
      <div
        className="crt aspect-video flex items-center justify-center relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${game.accent}22 0%, ${game.accent}08 100%)`,
        }}
      >
        {game.cardImage ? (
          /* Decorative: the title is announced by the heading below, so an
             alt here would just repeat it to screen readers. */
          <Image
            src={`/game-cards/${game.cardImage}`}
            alt=""
            fill
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          /* Framed treatment keeps art-less games visually consistent with the
             ones that have real cards, instead of a bare floating glyph. */
          <div className="tile-emoji-frame">
            <span
              className="tile-emoji text-6xl"
              style={{ filter: `drop-shadow(0 0 12px ${game.accent}88)` }}
            >
              {game.emoji}
            </span>
          </div>
        )}
        <span
          className="t-label absolute top-2 left-2 px-2 py-0.5 rounded z-10"
          style={{ background: game.accent, color: "#1a0e0a" }}
        >
          {game.category}
        </span>
      </div>
      <div className="p-4">
        <h3 className="t-display-sm text-[var(--foreground)] group-hover:text-[var(--accent-hot)] transition-colors">
          {game.title.toUpperCase()}
        </h3>
        <p className="t-caption text-[var(--muted)] mt-2">{game.blurb}</p>
      </div>
    </Link>
  );
}
