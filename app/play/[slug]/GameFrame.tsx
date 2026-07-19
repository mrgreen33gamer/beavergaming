"use client";

import { Suspense } from "react";
import GameShell from "@/app/components/GameShell";
import GameLoading from "@/app/components/GameLoading";
import { gameComponents } from "./gameComponents";

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
  const Game = gameComponents[slug];
  if (!Game) return null;

  return (
    <GameShell meta={{ id: slug, runtime: "canvas" }} accent={accent}>
      <Suspense fallback={<GameLoading title={title} accent={accent} />}>
        <Game />
      </Suspense>
    </GameShell>
  );
}
