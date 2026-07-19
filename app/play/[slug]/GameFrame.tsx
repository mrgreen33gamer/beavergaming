"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import GameShell from "@/app/components/GameShell";
import GameLoading from "@/app/components/GameLoading";
import { gameLoaders } from "./gameRegistry";

/**
 * Lazily loads one game and wraps it in the shared shell. The game itself is
 * unchanged — it gets the loading screen, pause, and fullscreen for free.
 */
export default function GameFrame({
  slug,
  title,
  accent,
}: {
  slug: string;
  title: string;
  accent: string;
}) {
  const Game = useMemo(
    () =>
      dynamic(gameLoaders[slug], {
        loading: () => <GameLoading title={title} accent={accent} />,
        ssr: false,
      }),
    [slug, title, accent],
  );

  return (
    <GameShell meta={{ id: slug, runtime: "canvas" }} accent={accent}>
      <Game />
    </GameShell>
  );
}
