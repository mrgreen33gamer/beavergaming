import { coverFor, patternMarkup } from "@/lib/coverArt";

/**
 * Generated cover artwork for a game that has no card image.
 *
 * The pattern is drawn in the game's accent colour behind a vignette, with
 * the emoji kept as the focal point on top. Because the pattern is seeded
 * from the slug it is stable between server and client render, so there is no
 * hydration mismatch and no layout shift.
 */
export default function GameCover({
  slug,
  emoji,
  accent,
  category,
  size = "tile",
}: {
  slug: string;
  emoji: string;
  accent: string;
  category?: string;
  size?: "tile" | "hero";
}) {
  const { pattern, seed } = coverFor(slug, category);
  const markup = patternMarkup(pattern, seed);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id={`glow-${slug}`} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
          </radialGradient>
          <linearGradient id={`fade-${slug}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="55%" stopColor="#1a0e0a" stopOpacity="0" />
            <stop offset="100%" stopColor="#1a0e0a" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        <rect width="320" height="180" fill={`url(#glow-${slug})`} />
        {/* currentColor lets one generated string take any accent. */}
        <g
          style={{ color: accent }}
          opacity="0.55"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
        <rect width="320" height="180" fill={`url(#fade-${slug})`} />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`tile-emoji drop-shadow-2xl ${size === "hero" ? "text-8xl" : "text-6xl"}`}
          style={{ filter: `drop-shadow(0 0 18px ${accent}cc)` }}
        >
          {emoji}
        </span>
      </div>
    </div>
  );
}
