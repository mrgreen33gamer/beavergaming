import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CategoryCarousel from "./components/CategoryCarousel";
import { games, getFeaturedGame, categories } from "@/lib/games";

export default function Home() {
  const featured = getFeaturedGame();

  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        {/* Hero banner */}
        <section className="mb-10">
          <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
            <div className="grid sm:grid-cols-2">
              <div className="p-8 flex flex-col justify-center">
                <p className="font-[family-name:var(--font-mono)] text-base text-[var(--crt-green)] uppercase tracking-wider mb-2">
                  &gt;&gt; Featured Game
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl text-[var(--foreground)] leading-relaxed mb-3">
                  {featured.title.toUpperCase()}
                </h2>
                <p className="font-[family-name:var(--font-mono)] text-xl text-[var(--muted)] mb-6 leading-snug">
                  {featured.description}
                </p>
                <Link
                  href={`/play/${featured.slug}`}
                  className="pixel-edge inline-block self-start px-6 py-3 rounded-lg font-[family-name:var(--font-display)] text-sm text-[var(--background)] transition-all"
                  style={{ background: featured.accent }}
                >
                  ▶ PLAY NOW
                </Link>
              </div>
              <div
                className="crt min-h-[240px] flex items-center justify-center relative"
                style={{
                  background: `linear-gradient(135deg, ${featured.accent}33 0%, ${featured.accent}11 100%)`,
                }}
              >
                <span
                  className="text-[12rem] drop-shadow-2xl"
                  style={{ filter: `drop-shadow(0 0 32px ${featured.accent})` }}
                >
                  {featured.emoji}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Library summary */}
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-[family-name:var(--font-display)] text-sm text-[var(--foreground)]">BROWSE BY GENRE</h2>
          <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)]">
            {games.length} games &middot; {categories.length} categories
          </p>
        </div>

        {/* One carousel per category */}
        {categories.map((cat) => {
          const inCat = games.filter((g) => g.category === cat.id);
          if (inCat.length === 0) return null;
          return <CategoryCarousel key={cat.id} label={cat.label} games={inCat} />;
        })}

        {/* Retro footer note */}
        <section className="mt-12 text-center">
          <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--muted)]">
            <span className="text-[var(--crt-green)]">█</span> Tip: All games work
            on desktop. Mobile support varies by game.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
