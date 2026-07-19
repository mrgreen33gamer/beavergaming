"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { gameLoaders } from "./gameRegistry";

/**
 * Per-slug next/dynamic components declared at module scope so React Compiler
 * static-components rules stay happy, while each game remains its own chunk.
 */
export const gameComponents: Record<string, ComponentType> = Object.fromEntries(
  Object.entries(gameLoaders).map(([slug, load]) => [
    slug,
    dynamic(load, { ssr: false }),
  ]),
);
