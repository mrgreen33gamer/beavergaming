/**
 * Shown while a game's chunk downloads. Matters more in Phase 4, when Godot
 * builds are 30-100 MB rather than a ~50 KB canvas game.
 */
export default function GameLoading({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 py-24"
    >
      <p className="t-display-sm text-[var(--muted)]">
        LOADING
      </p>
      <p
        className="t-display-md flicker"
        style={{ color: accent }}
      >
        {title.toUpperCase()}
      </p>
      <div className="h-2 w-48 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-2)]">
        <div
          className="h-full w-1/3 animate-pulse"
          style={{ background: accent }}
        />
      </div>
    </div>
  );
}
