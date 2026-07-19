import CategoryCarousel from "./CategoryCarousel";
import GameTile from "./GameTile";
import { games, categories, type GameCategory } from "@/lib/games";

/**
 * The browse section shared by the home page and each /genre/[cat] page.
 *
 * The two views use different forms on purpose. The home page carousels keep
 * all five genres scannable in one screen. A genre page has only one list and
 * no competition for vertical space, so it lays out as a grid — every game is
 * visible at once instead of four at a time behind scroll arrows.
 */
export default function GameLibrary({ only }: { only?: GameCategory }) {
  const inGenre = only ? games.filter((g) => g.category === only) : [];

  if (only) {
    return (
      <>
        <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
          <h2 className="t-display-md text-[var(--foreground)]">
            {categories.find((c) => c.id === only)!.label.toUpperCase()}
          </h2>
          <p className="t-body text-[var(--muted)]">{inGenre.length} games</p>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {inGenre.map((g) => (
            <GameTile key={g.slug} game={g} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <h2 className="t-display-md text-[var(--foreground)]">BROWSE BY GENRE</h2>
        <p className="t-body text-[var(--muted)]">
          {games.length} games &middot; {categories.length} categories
        </p>
      </div>

      {categories.map((cat) => {
        const inCat = games.filter((g) => g.category === cat.id);
        if (inCat.length === 0) return null;
        return <CategoryCarousel key={cat.id} label={cat.label} games={inCat} />;
      })}
    </>
  );
}
