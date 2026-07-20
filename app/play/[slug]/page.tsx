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
            className="t-body text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          >
            &larr; back to all games
          </Link>
          <span
            className="t-label px-2 py-0.5 rounded"
            style={{ background: game.accent, color: "#1a0e0a" }}
          >
            {game.category}
          </span>
        </div>

        <div className="mb-4">
          <h1 className="t-display-lg text-[var(--accent)] mb-2">
            {game.title.toUpperCase()}
          </h1>
          <p className="t-body text-[var(--muted)]">
            {game.controls}
          </p>
        </div>

        {/* Game canvas container */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
          <GameFrame slug={game.slug} title={game.title} accent={game.accent} />
        </div>

        {/* Description */}
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="t-display-md text-[var(--foreground)] mb-3">
            ABOUT THIS GAME
          </h2>
          <p className="t-body text-[var(--muted)]">
            {game.description}
          </p>
        </div>

        {/* Other games */}
        <div className="mt-8">
          <h2 className="t-display-md text-[var(--accent)] mb-3">
            MORE GAMES
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {games
              .filter((g) => g.slug !== game.slug)
              .map((g) => (
                <Link
                  key={g.slug}
                  href={`/play/${g.slug}`}
                  className="pixel-edge t-body flex-shrink-0 px-3 py-2 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] flex items-center gap-2"
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
