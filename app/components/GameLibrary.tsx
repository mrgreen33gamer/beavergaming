import CategoryCarousel from "./CategoryCarousel";
import { games, categories, type GameCategory } from "@/lib/games";

/**
 * The browse section shared by the home page and each /genre/[cat] page.
 * Passing `only` narrows it to a single genre; omitting it shows every genre.
 */
export default function GameLibrary({ only }: { only?: GameCategory }) {
  const shown = categories.filter((c) => !only || c.id === only);
  const count = only
    ? games.filter((g) => g.category === only).length
    : games.length;

  return (
    <>
      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <h2 className="t-display-md text-[var(--foreground)]">
          {only
            ? categories.find((c) => c.id === only)!.label.toUpperCase()
            : "BROWSE BY GENRE"}
        </h2>
        <p className="t-body text-[var(--muted)]">
          {only
            ? `${count} games`
            : `${count} games · ${categories.length} categories`}
        </p>
      </div>

      {shown.map((cat) => {
        const inCat = games.filter((g) => g.category === cat.id);
        if (inCat.length === 0) return null;
        return <CategoryCarousel key={cat.id} label={cat.label} games={inCat} />;
      })}
    </>
  );
}
