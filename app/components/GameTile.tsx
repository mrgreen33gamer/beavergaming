import Link from "next/link";
import Image from "next/image";
import { getCardImage } from "@/lib/cardImage";
import GameCover from "./GameCover";
import type { Game } from "@/lib/games";

export default function GameTile({ game }: { game: Game }) {
  const cardImage = getCardImage(game);

  return (
    <Link
      href={`/play/${game.slug}`}
      className="game-tile group block h-full overflow-hidden rounded-xl bg-[var(--surface-2)]"
    >
      <div className="crt relative aspect-video overflow-hidden">
        {cardImage ? (
          /* Decorative: the title is announced by the heading below, so alt
             text here would just repeat it to screen readers. */
          <Image
            src={`/game-cards/${cardImage}`}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <GameCover
            slug={game.slug}
            emoji={game.emoji}
            accent={game.accent}
          />
        )}

        <span
          className="t-label absolute left-2.5 top-2.5 z-10 rounded px-2 py-0.5"
          style={{ background: game.accent, color: "#1a0e0a" }}
        >
          {game.category}
        </span>

        {/* Reads as a play affordance on hover without shifting layout. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a0e0a]/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <span
            className="t-display-sm rounded-lg px-5 py-2.5"
            style={{ background: game.accent, color: "#1a0e0a" }}
          >
            ▶ PLAY
          </span>
        </span>
      </div>

      <div className="p-4">
        <h3 className="t-display-sm text-[var(--foreground)] transition-colors group-hover:text-[var(--accent-hot)]">
          {game.title.toUpperCase()}
        </h3>
        <p className="t-caption mt-2 text-[var(--muted)]">{game.blurb}</p>
      </div>
    </Link>
  );
}
