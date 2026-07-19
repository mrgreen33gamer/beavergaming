import Link from "next/link";
import Image from "next/image";
import Header from "./components/Header";
import Footer from "./components/Footer";
import GameLibrary from "./components/GameLibrary";
import { getFeaturedGame } from "@/lib/games";

export default function Home() {
  const featured = getFeaturedGame();

  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        {/* Hero */}
        <section className="mb-12">
          <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
            <div className="grid sm:grid-cols-5">
              <div className="sm:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
                <p className="t-label text-[var(--crt-green)] mb-3">
                  &gt;&gt; Featured Game
                </p>
                <h2 className="t-display-xl text-[var(--foreground)] mb-4">
                  {featured.title.toUpperCase()}
                </h2>
                <p className="t-body-lg text-[var(--muted)] mb-7 max-w-prose">
                  {featured.blurb}
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Link
                    href={`/play/${featured.slug}`}
                    className="pixel-edge t-display-sm inline-block px-7 py-3 rounded-lg text-[var(--background)] transition-all"
                    style={{ background: featured.accent }}
                  >
                    ▶ PLAY NOW
                  </Link>
                  <span className="t-caption text-[var(--muted)]">
                    {featured.controls}
                  </span>
                </div>
              </div>

              <div
                className="crt sm:col-span-2 min-h-[220px] relative"
                style={{
                  background: `linear-gradient(135deg, ${featured.accent}33 0%, ${featured.accent}11 100%)`,
                }}
              >
                {featured.cardImage ? (
                  <Image
                    src={`/game-cards/${featured.cardImage}`}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 640px) 100vw, 40vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="tile-emoji-frame">
                    <span
                      className="text-[7rem]"
                      style={{ filter: `drop-shadow(0 0 28px ${featured.accent})` }}
                    >
                      {featured.emoji}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <GameLibrary />

        <section className="mt-14 text-center">
          <p className="t-body text-[var(--muted)]">
            <span className="text-[var(--crt-green)]">█</span> Tip: All games work
            on desktop. Mobile support varies by game.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
