import Link from "next/link";
import { categories } from "@/lib/games";
import TokenBalance from "./TokenBalance";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * `activeCat` marks the selected genre chip: "all" on the home page, a genre
 * id on /genre/[cat]. Routes that are not part of the browse hierarchy (e.g.
 * /play/[slug]) omit it entirely so no chip reads as selected.
 */
export default async function Header({ activeCat }: { activeCat?: string }) {
  const user = await getCurrentUser();

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
              aria-current={activeCat === "all" ? "page" : undefined}
              className={`t-body px-3 py-1 rounded transition-colors ${
                activeCat === "all"
                  ? "bg-[var(--surface-2)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)]"
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

          <div className="flex items-center gap-3">
            <TokenBalance />
            {user ? (
              <Link
                href="/account"
                className="t-body px-3 py-1 rounded text-[var(--foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)] transition-colors"
              >
                {user.displayName}
              </Link>
            ) : (
              /* Guest play is the default, so signing in is offered rather
                 than pushed — no modal, no interstitial. */
              <Link
                href="/login"
                className="t-body px-3 py-1 rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)] transition-colors whitespace-nowrap"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
