export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 text-[var(--muted)]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
          <div>
            <p className="t-body text-[var(--foreground)]">
              <span className="text-[var(--accent)]">&gt;</span> Beaver Gaming v0.1
            </p>
            <p className="t-caption mt-1">
              A games portal in the spirit of the early 2000s.
            </p>
          </div>
          <div className="t-caption sm:text-right">
            {/* This used to read "No cookies", which was untrue — the site sets
                an essential cookie to track your token balance. Claiming
                otherwise is not a promise worth keeping incorrectly. */}
            <p>No Flash required. No ads. No tracking.</p>
            <p className="mt-1">Essential cookies only.</p>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-[var(--border)] t-caption text-center">
          <span className="flicker text-[var(--crt-green)]" aria-hidden="true">●</span> SERVER ONLINE
          <span className="mx-3">|</span>
          <span>Made with 🦫 + Next.js</span>
        </div>
      </div>
    </footer>
  );
}
