import Link from "next/link";
import { categories } from "@/lib/games";
import TokenBalance from "./TokenBalance";

/**
 * `activeCat` is passed by the home page so the current genre filter reads as
 * selected. Other routes (e.g. /play/[slug]) omit it and no chip is active.
 */
export default function Header({ activeCat }: { activeCat?: string }) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <span className="text-3xl group-hover:rotate-12 transition-transform">🦫</span>
          <div>
            <h1 className="t-display-md text-[var(--accent)]">BEAVER GAMING</h1>
            <p className="t-caption text-[var(--muted)]">
              free games &middot; instant play &middot; no downloads
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-4 flex-wrap">
          <nav aria-label="Genres" className="flex flex-wrap gap-1">
            <Link
              href="/"
              aria-current={activeCat ? undefined : "page"}
              className={`t-body px-3 py-1 rounded transition-colors ${
                activeCat
                  ? "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)]"
                  : "bg-[var(--surface-2)] text-[var(--accent)]"
              }`}
            >
              All
            </Link>
            {categories.map((c) => {
              const active = activeCat === c.id;
              return (
                <Link
                  key={c.id}
                  href={`/genre/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`t-body px-3 py-1 rounded transition-colors ${
                    active
                      ? "bg-[var(--surface-2)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)]"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
          <TokenBalance />
        </div>
      </div>
    </header>
  );
}
