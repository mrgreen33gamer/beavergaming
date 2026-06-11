import type { EnemyType } from "./types";

// First six waves are hand-tuned to ramp difficulty.
// After that, procedural generation kicks in via getWave().
export const WAVES: EnemyType[][] = [
  ["basic", "basic", "basic", "basic"],
  ["basic", "basic", "basic", "basic", "scout", "scout"],
  ["basic", "basic", "basic", "scout", "scout", "scout", "heavy"],
  ["basic", "basic", "scout", "scout", "scout", "heavy", "heavy"],
  ["basic", "basic", "basic", "scout", "scout", "scout", "scout", "heavy", "heavy"],
  ["basic", "basic", "basic", "basic", "scout", "scout", "scout", "heavy", "heavy", "heavy"],
];

export function getWave(n: number): EnemyType[] {
  if (n < WAVES.length) return WAVES[n];
  const total = 11 + (n - WAVES.length) * 2;
  const out: EnemyType[] = [];
  for (let i = 0; i < total; i++) {
    const r = Math.random();
    if (r < 0.3) out.push("heavy");
    else if (r < 0.6) out.push("scout");
    else out.push("basic");
  }
  return out;
}
