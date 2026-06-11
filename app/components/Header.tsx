import Link from "next/link";
import { categories } from "@/lib/games";

export default function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="text-3xl group-hover:rotate-12 transition-transform">🦫</span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-sm sm:text-base text-[var(--accent)] leading-tight">
              BEAVER GAMING
            </h1>
            <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--muted)] leading-tight">
              free games &middot; no logins &middot; instant fun
            </p>
          </div>
        </Link>
        <nav className="flex flex-wrap gap-1 font-[family-name:var(--font-mono)] text-lg">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/?cat=${c.id}`}
              className="px-3 py-1 rounded hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)] transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
