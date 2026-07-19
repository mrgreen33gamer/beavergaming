import Link from "next/link";
import Image from "next/image";
import Header from "./components/Header";
import Footer from "./components/Footer";
import GameLibrary from "./components/GameLibrary";
import GameCover from "./components/GameCover";
import { getCardImage } from "@/lib/cardImage";
import { games, getFeaturedGame, categories } from "@/lib/games";

export default function Home() {
  const featured = getFeaturedGame();
  const featuredArt = getCardImage(featured);

  return (
    <>
      <Header activeCat="all" />
      <main className="w-full flex-1">
        {/* Hero */}
        <section className="hero-band border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:py-20 lg:grid-cols-5 lg:items-center">
            <div className="lg:col-span-3">
              <p className="t-label mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[var(--crt-green)]">
                <span className="flicker" aria-hidden="true">
                  ●
                </span>
                {games.length} games · free forever
              </p>

              <h2 className="t-display-hero mb-5 text-[var(--foreground)]">
                PLAY INSTANTLY.
                <br />
                <span className="text-[var(--accent)]">NO DOWNLOADS.</span>
              </h2>

              <p className="t-body-lg mb-8 max-w-xl text-[var(--muted)]">
                {/* Explicit {" "} — JSX drops the space between an expression
                    and text that begins a line, which renders "43browser". */}
                {games.length}{" "}
                browser games, ready when you are. No installs, no paywalls, no
                account required — press play and you&apos;re in.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={`/play/${featured.slug}`}
                  className="cta t-display-sm rounded-lg px-8 py-4 text-[var(--background)]"
                  style={{ background: featured.accent }}
                >
                  ▶ PLAY {featured.title.toUpperCase()}
                </Link>
                <Link
                  href="/genre/arcade"
                  className="t-body rounded-lg border border-[var(--border)] px-6 py-4 text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Browse the library
                </Link>
              </div>
            </div>

            {/* Featured cover */}
            <div className="lg:col-span-2">
              <Link
                href={`/play/${featured.slug}`}
                className="game-tile group block overflow-hidden rounded-xl bg-[var(--surface-2)]"
              >
                <div className="crt relative aspect-video overflow-hidden">
                  {featuredArt ? (
                    <Image
                      src={`/game-cards/${featuredArt}`}
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 1024px) 90vw, 420px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                  ) : (
                    <GameCover
                      slug={featured.slug}
                      emoji={featured.emoji}
                      accent={featured.accent}
                      category={featured.category}
                      size="hero"
                    />
                  )}
                  <span className="t-label absolute left-3 top-3 rounded bg-[var(--crt-green)] px-2 py-0.5 text-[#1a0e0a]">
                    Featured
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="t-display-sm text-[var(--foreground)]">
                    {featured.title.toUpperCase()}
                  </h3>
                  <p className="t-caption mt-2 text-[var(--muted)]">{featured.blurb}</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Stat band */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)]/60">
            <dl className="mx-auto grid max-w-6xl grid-cols-2 px-6 sm:grid-cols-4">
              {[
                { k: String(games.length), v: "games" },
                { k: String(categories.length), v: "genres" },
                { k: "0", v: "downloads" },
                { k: "0", v: "paywalls" },
              ].map((s) => (
                <div key={s.v} className="py-5 text-center">
                  <dt className="t-display-md text-[var(--accent)]">{s.k}</dt>
                  <dd className="t-caption mt-1 text-[var(--muted)]">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 py-12">
          <GameLibrary />

          <section className="mt-16 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <h2 className="t-display-md mb-3 text-[var(--foreground)]">KEEP YOUR TOKENS</h2>
            <p className="t-body mx-auto mb-6 max-w-lg text-[var(--muted)]">
              You earn B-Tokens as you play. Make a free account and they follow you to
              any device — or keep playing as a guest, entirely up to you.
            </p>
            <Link
              href="/register"
              className="cta t-display-sm inline-block rounded-lg bg-[var(--accent)] px-7 py-3.5 text-[var(--background)]"
            >
              CREATE FREE ACCOUNT
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
