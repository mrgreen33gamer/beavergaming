export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 font-[family-name:var(--font-mono)] text-[var(--muted)] text-base">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <p className="text-lg text-[var(--foreground)]">
              <span className="text-[var(--accent)]">&gt;</span> Beaver Gaming v0.1
            </p>
            <p className="text-sm mt-1">
              Hand-built portal in the spirit of the early 2000s.
            </p>
          </div>
          <div className="text-sm text-right">
            <p>No Flash required. No ads. No cookies.</p>
            <p className="mt-1">
              Best viewed at <span className="text-[var(--crt-green)]">1024&times;768</span>
            </p>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-[var(--border)] text-sm text-center">
          <span className="flicker text-[var(--crt-green)]">●</span> SERVER ONLINE
          <span className="mx-3">|</span>
          <span>Made with 🦫 + Next.js</span>
        </div>
      </div>
    </footer>
  );
}
