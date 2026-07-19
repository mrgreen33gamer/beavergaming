import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { getGame, games } from "@/lib/games";
import GameFrame from "./GameFrame";
import { gameLoaders } from "./gameRegistry";

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

  if (!game || !(slug in gameLoaders)) {
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
          <GameFrame slug={game.slug} title={game.title} accent={game.accent} />
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
