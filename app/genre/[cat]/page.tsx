import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import GameLibrary from "@/app/components/GameLibrary";
import { categories, type GameCategory } from "@/lib/games";

/**
 * One statically-generated page per genre. This exists instead of a `?cat=`
 * search param on the home page: reading searchParams would force `/` to
 * render dynamically on every request, and these five pages are perfectly
 * cacheable — and individually indexable.
 */
export function generateStaticParams() {
  return categories.map((c) => ({ cat: c.id }));
}

function find(cat: string) {
  return categories.find((c) => c.id === cat);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  const match = find(cat);
  if (!match) return {};
  return {
    title: `${match.label} Games — Beaver Gaming`,
    description: `Free ${match.label.toLowerCase()} games you can play instantly in your browser. No downloads, no install.`,
  };
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  const match = find(cat);
  if (!match) notFound();

  return (
    <>
      <Header activeCat={match.id} />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        <GameLibrary only={match.id as GameCategory} />
      </main>
      <Footer />
    </>
  );
}
